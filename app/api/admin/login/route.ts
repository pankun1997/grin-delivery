import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const { env } = getCloudflareContext();
  const password = (env as CloudflareEnv & { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD;

  if (!password) {
    return NextResponse.json({ error: "ADMIN_PASSWORDが未設定です" }, { status: 503 });
  }

  const body = (await request.json()) as { password?: string };
  if (!body.password || body.password !== password) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("grin_admin", await digest(password), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("grin_admin", "", { httpOnly: true, secure: true, path: "/", maxAge: 0 });
  return response;
}
