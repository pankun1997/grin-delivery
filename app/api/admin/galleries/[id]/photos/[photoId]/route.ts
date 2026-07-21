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
  context: { params: Promise<{ id: string; photoId: string }> }
) {
  const resources = await getResources();
  if (!resources) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id, photoId } = await context.params;
  const photo = await resources.DB.prepare(
    `SELECT storage_key FROM photos WHERE gallery_id = ? AND id = ?`
  ).bind(id, photoId).first<{ storage_key: string }>();

  if (!photo) return NextResponse.json({ error: "写真が見つかりません" }, { status: 404 });

  const object = await resources.PHOTOS.get(photo.storage_key);
  if (!object?.body) return NextResponse.json({ error: "写真データが見つかりません" }, { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=3600");

  return new Response(object.body, { headers });
}
