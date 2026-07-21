import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

const encoder = new TextEncoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

function updateCrc(crc: number, bytes: Uint8Array) {
  let next = crc;
  for (const byte of bytes) {
    next = crcTable[(next ^ byte) & 0xff] ^ (next >>> 8);
  }
  return next >>> 0;
}

function uint16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function join(...chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function safeFilename(filename: string, index: number) {
  const cleaned = filename.replace(/[\\/:*?"<>|]/g, "_").trim() || `photo-${index + 1}.jpg`;
  return `${String(index + 1).padStart(3, "0")}-${cleaned}`;
}

type CentralEntry = {
  filename: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  day: number;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await context.params;
  const { env } = getCloudflareContext();
  const bindings = env as unknown as { DB: D1Database; PHOTOS: R2Bucket };

  const gallery = await bindings.DB.prepare(
    `SELECT id, customer_name, title, status, expires_at
     FROM galleries WHERE public_id = ?`
  ).bind(publicId).first<{
    id: number;
    customer_name: string;
    title: string;
    status: string;
    expires_at: string;
  }>();

  if (!gallery) {
    return NextResponse.json({ error: "ギャラリーが見つかりません" }, { status: 404 });
  }

  if (gallery.status !== "published") {
    return NextResponse.json({ error: "このギャラリーは現在公開されていません" }, { status: 403 });
  }

  const expiresAt = new Date(`${gallery.expires_at}T23:59:59+09:00`);
  if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "このギャラリーの公開期限は終了しました" }, { status: 410 });
  }

  const result = await bindings.DB.prepare(
    `SELECT storage_key, original_filename
     FROM photos WHERE gallery_id = ? ORDER BY display_order, id`
  ).bind(gallery.id).all<{ storage_key: string; original_filename: string }>();

  if (result.results.length === 0) {
    return NextResponse.json({ error: "ダウンロードできる写真がありません" }, { status: 404 });
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  void (async () => {
    let offset = 0;
    const centralEntries: CentralEntry[] = [];

    try {
      for (const [index, photo] of result.results.entries()) {
        const object = await bindings.PHOTOS.get(photo.storage_key);
        if (!object?.body) continue;

        const filename = encoder.encode(safeFilename(photo.original_filename, index));
        const { time, day } = dosDateTime();
        const flags = 0x0808;
        const localOffset = offset;

        const localHeader = join(
          uint32(0x04034b50),
          uint16(20),
          uint16(flags),
          uint16(0),
          uint16(time),
          uint16(day),
          uint32(0),
          uint32(0),
          uint32(0),
          uint16(filename.length),
          uint16(0),
          filename
        );

        await writer.write(localHeader);
        offset += localHeader.length;

        let crc = 0xffffffff;
        let size = 0;
        const reader = object.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          crc = updateCrc(crc, value);
          size += value.length;
          offset += value.length;
          await writer.write(value);
        }

        crc = (crc ^ 0xffffffff) >>> 0;
        const descriptor = join(
          uint32(0x08074b50),
          uint32(crc),
          uint32(size),
          uint32(size)
        );
        await writer.write(descriptor);
        offset += descriptor.length;

        centralEntries.push({ filename, crc, size, offset: localOffset, time, day });
      }

      const centralOffset = offset;

      for (const entry of centralEntries) {
        const centralHeader = join(
          uint32(0x02014b50),
          uint16(20),
          uint16(20),
          uint16(0x0808),
          uint16(0),
          uint16(entry.time),
          uint16(entry.day),
          uint32(entry.crc),
          uint32(entry.size),
          uint32(entry.size),
          uint16(entry.filename.length),
          uint16(0),
          uint16(0),
          uint16(0),
          uint16(0),
          uint32(0),
          uint32(entry.offset),
          entry.filename
        );
        await writer.write(centralHeader);
        offset += centralHeader.length;
      }

      const centralSize = offset - centralOffset;
      const endRecord = join(
        uint32(0x06054b50),
        uint16(0),
        uint16(0),
        uint16(centralEntries.length),
        uint16(centralEntries.length),
        uint32(centralSize),
        uint32(centralOffset),
        uint16(0)
      );
      await writer.write(endRecord);
      await writer.close();
    } catch (error) {
      await writer.abort(error);
    }
  })();

  const archiveName = `${gallery.customer_name}-${gallery.title}.zip`.replace(/[\\/:*?"<>|]/g, "_");
  const encodedName = encodeURIComponent(archiveName);

  return new Response(readable, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="grin-gallery.zip"; filename*=UTF-8''${encodedName}`,
      "cache-control": "private, no-store",
    },
  });
}
