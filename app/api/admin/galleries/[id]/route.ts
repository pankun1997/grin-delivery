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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const resources = await getResources();
  if (!resources) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await context.params;
  const gallery = await resources.DB.prepare(
    `SELECT id, public_id, customer_name, title, shoot_date, status, expires_at, created_at
     FROM galleries WHERE id = ?`
  ).bind(id).first();

  if (!gallery) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });

  const photos = await resources.DB.prepare(
    `SELECT id, original_filename, file_size, display_order, created_at
     FROM photos WHERE gallery_id = ? ORDER BY display_order, id`
  ).bind(id).all();

  return NextResponse.json({ gallery, photos: photos.results });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const resources = await getResources();
  if (!resources) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await context.params;
  const gallery = await resources.DB.prepare(
    "SELECT id, public_id FROM galleries WHERE id = ?"
  ).bind(id).first<{ id: number; public_id: string }>();

  if (!gallery) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });

  const formData = await request.formData();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "写真を選択してください" }, { status: 400 });
  }

  if (files.length > 50) {
    return NextResponse.json({ error: "一度にアップロードできるのは50枚までです" }, { status: 400 });
  }

  const orderRow = await resources.DB.prepare(
    "SELECT COALESCE(MAX(display_order), -1) AS max_order FROM photos WHERE gallery_id = ?"
  ).bind(gallery.id).first<{ max_order: number }>();
  let displayOrder = (orderRow?.max_order ?? -1) + 1;
  const uploaded: Array<{ id: number; filename: string }> = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: `${file.name}は25MBを超えています` }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `galleries/${gallery.public_id}/${crypto.randomUUID()}-${safeName}`;
    await resources.PHOTOS.put(storageKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalFilename: file.name },
    });

    const result = await resources.DB.prepare(
      `INSERT INTO photos
       (gallery_id, storage_key, thumbnail_key, original_filename, display_order, file_size)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(gallery.id, storageKey, storageKey, file.name, displayOrder, file.size).run();

    uploaded.push({ id: Number(result.meta.last_row_id), filename: file.name });
    displayOrder += 1;
  }

  if (uploaded.length === 0) {
    return NextResponse.json({ error: "画像ファイルを選択してください" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, uploaded }, { status: 201 });
}
