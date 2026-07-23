import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await context.params;
  const { env } = getCloudflareContext();
  const bindings = env as unknown as { DB: D1Database };

  const gallery = await bindings.DB.prepare(
    `SELECT id, public_id, customer_name, title, shoot_date, location,
            cover_message, thank_you_message, status, expires_at, cover_photo_id,
            page_stage, shoot_time, plan_name, meeting_details, schedule_details,
            belongings, rain_policy, payment_details
     FROM galleries WHERE public_id = ?`
  ).bind(publicId).first<{
    id: number;
    public_id: string;
    customer_name: string;
    title: string;
    shoot_date: string;
    location: string | null;
    cover_message: string | null;
    thank_you_message: string | null;
    status: string;
    expires_at: string;
    cover_photo_id: number | null;
    page_stage: "scheduled" | "editing" | "delivered";
    shoot_time: string | null;
    plan_name: string | null;
    meeting_details: string | null;
    schedule_details: string | null;
    belongings: string | null;
    rain_policy: string | null;
    payment_details: string | null;
  }>();

  if (!gallery) {
    return NextResponse.json({ error: "ギャラリーが見つかりません" }, { status: 404 });
  }

  if (gallery.status !== "published") {
    return NextResponse.json({ error: "このページは現在公開されていません" }, { status: 403 });
  }

  if (gallery.page_stage === "delivered") {
    const expiresAt = new Date(`${gallery.expires_at}T23:59:59+09:00`);
    if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "このギャラリーの公開期限は終了しました" }, { status: 410 });
    }
  }

  const result = await bindings.DB.prepare(
    `SELECT id, original_filename, file_size, display_order, is_slideshow, slideshow_order
     FROM photos WHERE gallery_id = ? ORDER BY display_order, id`
  ).bind(gallery.id).all<{
    id: number;
    original_filename: string;
    file_size: number;
    display_order: number;
    is_slideshow: number;
    slideshow_order: number | null;
  }>();

  const photos = result.results.map((photo) => ({
    ...photo,
    imageUrl: `/api/gallery/${publicId}/photos/${photo.id}`,
    downloadUrl: `/api/gallery/${publicId}/photos/${photo.id}?download=1`,
  }));

  return NextResponse.json({ gallery, photos });
}
