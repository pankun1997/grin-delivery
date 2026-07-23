import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getResources() {
  const { env } = getCloudflareContext();
  const bindings = env as unknown as {
    DB: D1Database;
    PHOTOS: R2Bucket;
    ADMIN_PASSWORD?: string;
  };
  const password = bindings.ADMIN_PASSWORD;
  const cookieStore = await cookies();
  const session = cookieStore.get("grin_admin")?.value;

  if (!password || !session || session !== (await digest(password))) return null;
  return bindings;
}

function cleanText(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (cleaned.length > maxLength) throw new Error(`入力内容は${maxLength}文字以内にしてください`);
  return cleaned || null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const resources = await getResources();
  if (!resources) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await context.params;
  const gallery = await resources.DB.prepare(
    `SELECT id, public_id, customer_name, title, shoot_date, status, expires_at,
            cover_photo_id, thank_you_message, created_at, location, page_stage,
            shoot_time, plan_name, meeting_details, schedule_details, belongings,
            rain_policy, payment_details
     FROM galleries WHERE id = ?`
  ).bind(id).first();

  if (!gallery) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });

  const photos = await resources.DB.prepare(
    `SELECT id, original_filename, file_size, display_order, created_at
     FROM photos WHERE gallery_id = ? ORDER BY display_order, id`
  ).bind(id).all();

  return NextResponse.json({ gallery, photos: photos.results });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const resources = await getResources();
  if (!resources) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as {
    status?: string;
    coverPhotoId?: number;
    thankYouMessage?: string;
    pageStage?: string;
    bookingDetails?: {
      shootTime?: string;
      planName?: string;
      location?: string;
      meetingDetails?: string;
      scheduleDetails?: string;
      belongings?: string;
      rainPolicy?: string;
      paymentDetails?: string;
    };
  };

  if (body.bookingDetails) {
    try {
      const details = body.bookingDetails;
      const values = [
        cleanText(details.shootTime, 100),
        cleanText(details.planName, 200),
        cleanText(details.location, 500),
        cleanText(details.meetingDetails),
        cleanText(details.scheduleDetails),
        cleanText(details.belongings),
        cleanText(details.rainPolicy),
        cleanText(details.paymentDetails),
        id,
      ];
      const result = await resources.DB.prepare(
        `UPDATE galleries SET shoot_time = ?, plan_name = ?, location = ?, meeting_details = ?,
          schedule_details = ?, belongings = ?, rain_policy = ?, payment_details = ?,
          updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(...values).run();
      if (!result.meta.changes) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "入力内容が正しくありません" }, { status: 400 });
    }
  }

  if (typeof body.pageStage === "string") {
    const allowedStages = new Set(["scheduled", "editing", "delivered"]);
    if (!allowedStages.has(body.pageStage)) {
      return NextResponse.json({ error: "ページ表示状態が正しくありません" }, { status: 400 });
    }
    if (body.pageStage === "delivered") {
      const count = await resources.DB.prepare("SELECT COUNT(*) AS count FROM photos WHERE gallery_id = ?")
        .bind(id).first<{ count: number }>();
      if (!count?.count) return NextResponse.json({ error: "写真を1枚以上登録してから納品済みにしてください" }, { status: 400 });
    }
    const result = await resources.DB.prepare(
      "UPDATE galleries SET page_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(body.pageStage, id).run();
    if (!result.meta.changes) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
    return NextResponse.json({ ok: true, pageStage: body.pageStage });
  }

  if (typeof body.thankYouMessage === "string") {
    const message = body.thankYouMessage.trim();
    if (message.length > 1000) return NextResponse.json({ error: "メッセージは1000文字以内で入力してください" }, { status: 400 });
    const result = await resources.DB.prepare(
      "UPDATE galleries SET thank_you_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(message || null, id).run();
    if (!result.meta.changes) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
    return NextResponse.json({ ok: true, thankYouMessage: message });
  }

  if (typeof body.coverPhotoId === "number") {
    const photo = await resources.DB.prepare("SELECT id FROM photos WHERE id = ? AND gallery_id = ?")
      .bind(body.coverPhotoId, id).first<{ id: number }>();
    if (!photo) return NextResponse.json({ error: "この案件の写真が見つかりません" }, { status: 404 });
    const result = await resources.DB.prepare(
      "UPDATE galleries SET cover_photo_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(body.coverPhotoId, id).run();
    if (!result.meta.changes) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
    return NextResponse.json({ ok: true, coverPhotoId: body.coverPhotoId });
  }

  const allowed = new Set(["draft", "published", "paused"]);
  if (!body.status || !allowed.has(body.status)) {
    return NextResponse.json({ error: "公開状態が正しくありません" }, { status: 400 });
  }

  if (body.status === "published") {
    const gallery = await resources.DB.prepare("SELECT page_stage FROM galleries WHERE id = ?")
      .bind(id).first<{ page_stage: string }>();
    if (!gallery) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
    if (gallery.page_stage === "delivered") {
      const count = await resources.DB.prepare("SELECT COUNT(*) AS count FROM photos WHERE gallery_id = ?")
        .bind(id).first<{ count: number }>();
      if (!count?.count) return NextResponse.json({ error: "納品ページは写真を1枚以上登録してから公開してください" }, { status: 400 });
    }
  }

  const result = await resources.DB.prepare(
    "UPDATE galleries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(body.status, id).run();
  if (!result.meta.changes) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
  return NextResponse.json({ ok: true, status: body.status });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const resources = await getResources();
  if (!resources) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  const { id } = await context.params;
  const body = (await request.json()) as { photoId?: number; deleteAll?: boolean };

  if (body.deleteAll === true) {
    const result = await resources.DB.prepare("SELECT storage_key FROM photos WHERE gallery_id = ?").bind(id).all<{ storage_key: string }>();
    await Promise.all(result.results.map((photo) => resources.PHOTOS.delete(photo.storage_key)));
    await resources.DB.prepare("DELETE FROM photos WHERE gallery_id = ?").bind(id).run();
    await resources.DB.prepare("UPDATE galleries SET cover_photo_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
    return NextResponse.json({ ok: true, deleted: result.results.length });
  }

  if (typeof body.photoId === "number") {
    const photo = await resources.DB.prepare("SELECT id, storage_key FROM photos WHERE id = ? AND gallery_id = ?")
      .bind(body.photoId, id).first<{ id: number; storage_key: string }>();
    if (!photo) return NextResponse.json({ error: "写真が見つかりません" }, { status: 404 });
    await resources.PHOTOS.delete(photo.storage_key);
    await resources.DB.prepare("DELETE FROM photos WHERE id = ? AND gallery_id = ?").bind(body.photoId, id).run();
    await resources.DB.prepare(
      `UPDATE galleries SET cover_photo_id = CASE WHEN cover_photo_id = ? THEN NULL ELSE cover_photo_id END,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(body.photoId, id).run();
    return NextResponse.json({ ok: true, deleted: 1 });
  }
  return NextResponse.json({ error: "削除対象が指定されていません" }, { status: 400 });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const resources = await getResources();
  if (!resources) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  const { id } = await context.params;
  const gallery = await resources.DB.prepare("SELECT id, public_id FROM galleries WHERE id = ?")
    .bind(id).first<{ id: number; public_id: string }>();
  if (!gallery) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });

  const formData = await request.formData();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (!files.length) return NextResponse.json({ error: "写真を選択してください" }, { status: 400 });
  if (files.length > 50) return NextResponse.json({ error: "一度に送信できるのは50枚までです" }, { status: 400 });

  const orderRow = await resources.DB.prepare("SELECT COALESCE(MAX(display_order), -1) AS max_order FROM photos WHERE gallery_id = ?")
    .bind(gallery.id).first<{ max_order: number }>();
  let displayOrder = (orderRow?.max_order ?? -1) + 1;
  const uploaded: Array<{ id: number; filename: string }> = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: `${file.name}は25MBを超えています` }, { status: 400 });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `galleries/${gallery.public_id}/${crypto.randomUUID()}-${safeName}`;
    await resources.PHOTOS.put(storageKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalFilename: file.name },
    });
    const result = await resources.DB.prepare(
      `INSERT INTO photos (gallery_id, storage_key, thumbnail_key, original_filename, display_order, file_size)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(gallery.id, storageKey, storageKey, file.name, displayOrder, file.size).run();
    uploaded.push({ id: Number(result.meta.last_row_id), filename: file.name });
    displayOrder += 1;
  }

  if (!uploaded.length) return NextResponse.json({ error: "画像ファイルを選択してください" }, { status: 400 });
  return NextResponse.json({ ok: true, uploaded }, { status: 201 });
}
