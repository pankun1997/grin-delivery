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
  const bindings = env as unknown as { DB: D1Database; ADMIN_PASSWORD?: string };
  const password = bindings.ADMIN_PASSWORD;
  const cookieStore = await cookies();
  const session = cookieStore.get("grin_admin")?.value;

  if (!password || !session || session !== (await digest(password))) return null;
  return bindings;
}

export async function GET() {
  const resources = await getResources();
  if (!resources) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const result = await resources.DB.prepare(
    `SELECT id, public_id, customer_name, title, shoot_date, status, expires_at, created_at
     FROM galleries ORDER BY created_at DESC`
  ).all();

  return NextResponse.json({ galleries: result.results });
}

export async function POST(request: Request) {
  const resources = await getResources();
  if (!resources) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body = (await request.json()) as {
    customerName?: string;
    title?: string;
    shootDate?: string;
    expiresAt?: string;
  };

  if (!body.customerName || !body.title || !body.shootDate || !body.expiresAt) {
    return NextResponse.json({ error: "必須項目を入力してください" }, { status: 400 });
  }

  const publicId = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  await resources.DB.prepare(
    `INSERT INTO galleries (public_id, customer_name, title, shoot_date, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(publicId, body.customerName.trim(), body.title.trim(), body.shootDate, body.expiresAt)
    .run();

  return NextResponse.json({ ok: true, publicId }, { status: 201 });
}
