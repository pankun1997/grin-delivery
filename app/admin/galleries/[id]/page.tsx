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
    return (await response.json()) as { error?: string; uploaded?: unknown[]; status?: string };
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
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [changingStatus, setChangingStatus] = useState(false);

  const loadGallery = useCallback(async () => {
    const response = await fetch(`/api/admin/galleries/${params.id}`, { cache: "no-store" });
    const data = (await response.json()) as { gallery?: Gallery; photos?: Photo[]; error?: string };
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

  async function changeStatus(status: "published" | "paused") {
    setChangingStatus(true);
    setMessage("");
    const response = await fetch(`/api/admin/galleries/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await readJsonSafely(response);
    setChangingStatus(false);
    if (!response.ok) {
      setMessage(data?.error ?? "公開状態の変更に失敗しました");
      return;
    }
    setGallery((current) => current ? { ...current, status } : current);
    setMessage(status === "published" ? "ギャラリーを公開しました" : "ギャラリーを非公開にしました");
  }

  async function uploadPhotos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("files") as HTMLInputElement | null;
    const files = Array.from(input?.files ?? []);

    if (files.length === 0) return setMessage("写真を選択してください");
    if (files.length > 100) return setMessage("一度に選択できるのは100枚までです");

    const oversized = files.find((file) => file.size > 25 * 1024 * 1024);
    if (oversized) return setMessage(`${oversized.name}は25MBを超えています`);

    setUploading(true);
    setMessage("");
    setProgress(0);
    let completed = 0;
    const failed: string[] = [];

    for (const [index, file] of files.entries()) {
      setProgressText(`${index + 1} / ${files.length}枚　${file.name}`);
      const body = new FormData();
      body.append("files", file);

      try {
        const response = await fetch(`/api/admin/galleries/${params.id}`, { method: "POST", body });
        const data = await readJsonSafely(response);
        if (!response.ok) {
          failed.push(`${file.name}: ${data?.error ?? `エラー ${response.status}`}`);
        } else {
          completed += 1;
        }
      } catch {
        failed.push(`${file.name}: 通信エラー`);
      }
      setProgress(Math.round(((index + 1) / files.length) * 100));
    }

    form.reset();
    setUploading(false);
    setProgressText("");
    setMessage(failed.length === 0
      ? `${completed}枚アップロードしました`
      : `${completed}枚成功・${failed.length}枚失敗（${failed.slice(0, 3).join(" / ")}）`);
    await loadGallery();
  }

  if (!gallery) return <main className="admin-shell"><p>{message || "読み込み中..."}</p></main>;

  const publicPath = `/gallery/${gallery.public_id}`;

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

      <section className="admin-publish-bar">
        <div>
          <strong>お客様向け公開ページ</strong>
          <span>{publicPath}</span>
        </div>
        <div className="admin-publish-actions">
          {gallery.status === "published" && <a className="secondary-button" href={publicPath} target="_blank" rel="noreferrer">公開ページを確認</a>}
          <button
            className="primary-button"
            disabled={changingStatus}
            onClick={() => void changeStatus(gallery.status === "published" ? "paused" : "published")}
          >
            {changingStatus ? "変更中..." : gallery.status === "published" ? "非公開にする" : "公開する"}
          </button>
        </div>
      </section>

      <section className="admin-grid">
        <article className="admin-card">
          <p className="eyebrow">UPLOAD</p>
          <h2>写真を追加</h2>
          <p>一度に100枚まで選択できます。写真は1枚ずつ安全に送信します。</p>
          <form className="admin-form" onSubmit={uploadPhotos}>
            <label>写真を選択<input type="file" name="files" accept="image/*" multiple required /></label>
            <button className="primary-button" type="submit" disabled={uploading}>{uploading ? "アップロード中..." : "写真をアップロード"}</button>
          </form>
          {uploading && (
            <div className="upload-progress">
              <div className="upload-progress-track"><span style={{ width: `${progress}%` }} /></div>
              <p>{progress}%　{progressText}</p>
            </div>
          )}
          {message && <p className="admin-message">{message}</p>}
        </article>

        <article className="admin-card admin-list-card">
          <p className="eyebrow">PHOTOS</p>
          <h2>登録済み写真</h2>
          {photos.length === 0 ? <p className="admin-empty">まだ写真がありません。</p> : (
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
