import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ publicId: string; photoId: string }> }
) {
  const { publicId, photoId } = await context.params;
  const { env } = getCloudflareContext();
  const bindings = env as unknown as { DB: D1Database; PHOTOS: R2Bucket };

  const row = await bindings.DB.prepare(
    `SELECT g.status, g.expires_at, p.storage_key, p.original_filename
     FROM photos p
     INNER JOIN galleries g ON g.id = p.gallery_id
     WHERE g.public_id = ? AND p.id = ?`
  ).bind(publicId, photoId).first<{
    status: string;
    expires_at: string;
    storage_key: string;
    original_filename: string;
  }>();

  if (!row) return NextResponse.json({ error: "写真が見つかりません" }, { status: 404 });
  if (row.status !== "published") {
    return NextResponse.json({ error: "このギャラリーは現在公開されていません" }, { status: 403 });
  }

  const expiresAt = new Date(`${row.expires_at}T23:59:59+09:00`);
  if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "公開期限は終了しました" }, { status: 410 });
  }

  const object = await bindings.PHOTOS.get(row.storage_key);
  if (!object?.body) return NextResponse.json({ error: "写真データが見つかりません" }, { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=3600");

  const url = new URL(request.url);
  if (url.searchParams.get("download") === "1") {
    const encoded = encodeURIComponent(row.original_filename);
    headers.set("content-disposition", `attachment; filename*=UTF-8''${encoded}`);
  }

  return new Response(object.body, { headers });
}
