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
  const [progress, setProgress] = useState({ current: 0, total: 0, filename: "" });

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

    if (files.length > 100) {
      setMessage("一度に選択できるのは100枚までです");
      return;
    }

    const oversized = files.find((file) => file.size > 25 * 1024 * 1024);
    if (oversized) {
      setMessage(`${oversized.name}は25MBを超えています`);
      return;
    }

    setUploading(true);
    setMessage("");
    setProgress({ current: 0, total: files.length, filename: "" });

    let succeeded = 0;
    const failed: string[] = [];

    for (const [index, file] of files.entries()) {
      setProgress({ current: index + 1, total: files.length, filename: file.name });
      const body = new FormData();
      body.append("files", file);

      try {
        const response = await fetch(`/api/admin/galleries/${params.id}`, {
          method: "POST",
          body,
        });
        const data = await readJsonSafely(response);

        if (!response.ok) {
          const reason = response.status === 413
            ? "送信サイズが大きすぎます"
            : data?.error ?? `エラー ${response.status}`;
          failed.push(`${file.name}：${reason}`);
          continue;
        }

        succeeded += 1;
      } catch {
        failed.push(`${file.name}：通信に失敗しました`);
      }
    }

    setUploading(false);
    setProgress({ current: 0, total: 0, filename: "" });

    if (succeeded > 0) {
      form.reset();
      await loadGallery();
    }

    if (failed.length === 0) {
      setMessage(`${succeeded}枚アップロードしました`);
    } else {
      const preview = failed.slice(0, 3).join(" / ");
      const remaining = failed.length > 3 ? ` ほか${failed.length - 3}枚` : "";
      setMessage(`${succeeded}枚成功・${failed.length}枚失敗。${preview}${remaining}`);
    }
  }

  if (!gallery) {
    return <main className="admin-shell"><p>{message || "読み込み中..."}</p></main>;
  }

  const progressPercent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

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
          <p>JPEG・PNG・WebPなどの画像を、一度に100枚まで選択できます。写真は1枚ずつ安全に送信します。</p>
          <form className="admin-form" onSubmit={uploadPhotos}>
            <label>
              写真を選択
              <input type="file" name="files" accept="image/*" multiple required disabled={uploading} />
            </label>
            <button className="primary-button" type="submit" disabled={uploading}>
              {uploading ? "アップロード中..." : "写真をアップロード"}
            </button>
          </form>

          {uploading && (
            <div className="upload-progress" aria-live="polite">
              <div className="upload-progress-header">
                <strong>{progressPercent}%</strong>
                <span>{progress.current} / {progress.total}枚</span>
              </div>
              <div className="upload-progress-track" aria-hidden="true">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <p>{progress.filename}</p>
            </div>
          )}

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
