"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Gallery = {
  id: number;
  public_id: string;
  customer_name: string;
  title: string;
  shoot_date: string;
  status: string;
  expires_at: string;
};

type Photo = {
  id: number;
  original_filename: string;
  file_size: number;
  display_order: number;
  created_at: string;
};

async function readJsonSafely(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    return (await response.json()) as { error?: string; uploaded?: unknown[] };
  } catch {
    return null;
  }
}

export default function GalleryAdminPage() {
  const params = useParams<{ id: string }>();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  const loadGallery = useCallback(async () => {
    const response = await fetch(`/api/admin/galleries/${params.id}`, { cache: "no-store" });
    const data = (await response.json()) as {
      gallery?: Gallery;
      photos?: Photo[];
      error?: string;
    };

    if (response.status === 401) {
      window.location.href = "/admin";
      return;
    }

    if (!response.ok) {
      setMessage(data.error ?? "案件を読み込めませんでした");
      return;
    }

    setGallery(data.gallery ?? null);
    setPhotos(data.photos ?? []);
  }, [params.id]);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  async function uploadPhotos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("files") as HTMLInputElement | null;
    const files = Array.from(input?.files ?? []);

    if (files.length === 0) {
      setMessage("写真を選択してください");
      return;
    }

    if (files.length > 50) {
      setMessage("一度に選択できるのは50枚までです");
      return;
    }

    const oversized = files.find((file) => file.size > 25 * 1024 * 1024);
    if (oversized) {
      setMessage(`${oversized.name}は25MBを超えています`);
      return;
    }

    setUploading(true);
    setMessage("");
    let completed = 0;

    try {
      for (const [index, file] of files.entries()) {
        setProgress(`${index + 1} / ${files.length}枚目をアップロード中`);
        const body = new FormData();
        body.append("files", file);

        const response = await fetch(`/api/admin/galleries/${params.id}`, {
          method: "POST",
          body,
        });
        const data = await readJsonSafely(response);

        if (!response.ok) {
          if (response.status === 413) {
            throw new Error(`${file.name}の送信サイズが大きすぎます。25MB未満のJPEGでお試しください。`);
          }
          throw new Error(data?.error ?? `${file.name}のアップロードに失敗しました（${response.status}）`);
        }
        completed += 1;
      }

      form.reset();
      setMessage(`${completed}枚アップロードしました`);
      await loadGallery();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      setProgress("");
    }
  }

  if (!gallery) {
    return <main className="admin-shell"><p>{message || "読み込み中..."}</p></main>;
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <Link className="admin-back-link" href="/admin">← 案件一覧へ</Link>
          <p className="eyebrow">GALLERY DETAIL</p>
          <h1>{gallery.customer_name}</h1>
          <p>{gallery.title} ・ {gallery.shoot_date}</p>
        </div>
        <div className="admin-item-meta">
          <span className={`status status-${gallery.status}`}>{gallery.status}</span>
          <code>{gallery.public_id}</code>
        </div>
      </header>

      <section className="admin-grid">
        <article className="admin-card">
          <p className="eyebrow">UPLOAD</p>
          <h2>写真を追加</h2>
          <p>JPEG・PNG・WebPなどの画像を、一度に50枚まで追加できます。1枚ずつ順番に送信します。</p>
          <form className="admin-form" onSubmit={uploadPhotos}>
            <label>
              写真を選択
              <input type="file" name="files" accept="image/*" multiple required />
            </label>
            <button className="primary-button" type="submit" disabled={uploading}>
              {uploading ? "アップロード中..." : "写真をアップロード"}
            </button>
          </form>
          {progress && <p className="admin-message">{progress}</p>}
          {message && <p className="admin-message">{message}</p>}
        </article>

        <article className="admin-card admin-list-card">
          <p className="eyebrow">PHOTOS</p>
          <h2>登録済み写真</h2>
          {photos.length === 0 ? (
            <p className="admin-empty">まだ写真がありません。</p>
          ) : (
            <div className="admin-list">
              {photos.map((photo, index) => (
                <div className="admin-list-item" key={photo.id}>
                  <div>
                    <strong>{String(index + 1).padStart(2, "0")}　{photo.original_filename}</strong>
                    <span>{(photo.file_size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
