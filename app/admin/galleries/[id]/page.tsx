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

export default function GalleryAdminPage() {
  const params = useParams<{ id: string }>();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

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
    const formData = new FormData(form);
    const files = formData.getAll("files").filter((entry) => entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      setMessage("写真を選択してください");
      return;
    }

    setUploading(true);
    setMessage("");

    const response = await fetch(`/api/admin/galleries/${params.id}`, {
      method: "POST",
      body: formData,
    });
    const data = (await response.json()) as { error?: string; uploaded?: unknown[] };
    setUploading(false);

    if (!response.ok) {
      setMessage(data.error ?? "アップロードに失敗しました");
      return;
    }

    form.reset();
    setMessage(`${data.uploaded?.length ?? files.length}枚アップロードしました`);
    await loadGallery();
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
          <p>JPEG・PNG・WebPなどの画像を、一度に50枚まで追加できます。</p>
          <form className="admin-form" onSubmit={uploadPhotos}>
            <label>
              写真を選択
              <input type="file" name="files" accept="image/*" multiple required />
            </label>
            <button className="primary-button" type="submit" disabled={uploading}>
              {uploading ? "アップロード中..." : "写真をアップロード"}
            </button>
          </form>
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
