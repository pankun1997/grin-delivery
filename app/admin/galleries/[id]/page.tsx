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
  cover_photo_id: number | null;
  thank_you_message: string | null;
  location: string | null;
  page_stage: "scheduled" | "editing" | "delivered";
  shoot_time: string | null;
  plan_name: string | null;
  meeting_details: string | null;
  schedule_details: string | null;
  belongings: string | null;
  rain_policy: string | null;
  payment_details: string | null;
};

type Photo = {
  id: number;
  original_filename: string;
  file_size: number;
  display_order: number;
  created_at: string;
};

type ApiData = {
  error?: string;
  uploaded?: unknown[];
  status?: string;
  pageStage?: Gallery["page_stage"];
  coverPhotoId?: number;
  thankYouMessage?: string;
  deleted?: number;
  ok?: boolean;
};

async function readJsonSafely(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try { return (await response.json()) as ApiData; } catch { return null; }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function uploadFileWithRetry(galleryId: string, file: File, maxAttempts = 3) {
  let lastError = "アップロードに失敗しました";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const body = new FormData();
    body.append("files", file);
    try {
      const response = await fetch(`/api/admin/galleries/${galleryId}`, { method: "POST", body });
      const data = await readJsonSafely(response);
      if (response.ok) return;
      lastError = data?.error ?? `エラー ${response.status}`;
      if (![429, 502, 503, 504].includes(response.status) || attempt === maxAttempts) throw new Error(lastError);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "通信エラー";
      if (attempt === maxAttempts) throw new Error(lastError);
    }
    await wait(1000 * 2 ** (attempt - 1));
  }
}

const textareaStyle = { width: "100%", resize: "vertical" as const, minHeight: 110, padding: 14, border: "1px solid var(--line)", borderRadius: 10, font: "inherit", lineHeight: 1.8 };
const inputStyle = { width: "100%", padding: 12, border: "1px solid var(--line)", borderRadius: 10, font: "inherit" };

function stageLabel(stage: Gallery["page_stage"]) {
  if (stage === "scheduled") return "撮影予定";
  if (stage === "editing") return "編集中";
  return "納品済み";
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
  const [changingStage, setChangingStage] = useState(false);
  const [changingCoverId, setChangingCoverId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  const loadGallery = useCallback(async () => {
    const response = await fetch(`/api/admin/galleries/${params.id}`, { cache: "no-store" });
    const data = (await response.json()) as { gallery?: Gallery; photos?: Photo[]; error?: string };
    if (response.status === 401) return void (window.location.href = "/admin");
    if (!response.ok) return setMessage(data.error ?? "案件を読み込めませんでした");
    setGallery(data.gallery ?? null);
    setPhotos(data.photos ?? []);
  }, [params.id]);

  useEffect(() => { void loadGallery(); }, [loadGallery]);

  async function patch(body: object) {
    const response = await fetch(`/api/admin/galleries/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { response, data: await readJsonSafely(response) };
  }

  async function changeStatus(status: "published" | "paused") {
    setChangingStatus(true); setMessage("");
    const { response, data } = await patch({ status });
    setChangingStatus(false);
    if (!response.ok) return setMessage(data?.error ?? "公開状態の変更に失敗しました");
    setGallery((current) => current ? { ...current, status } : current);
    setMessage(status === "published" ? "お客様向けページを公開しました" : "お客様向けページを非公開にしました");
  }

  async function changeStage(pageStage: Gallery["page_stage"]) {
    setChangingStage(true); setMessage("");
    const { response, data } = await patch({ pageStage });
    setChangingStage(false);
    if (!response.ok) return setMessage(data?.error ?? "表示内容の変更に失敗しました");
    setGallery((current) => current ? { ...current, page_stage: pageStage } : current);
    setMessage(`表示内容を「${stageLabel(pageStage)}」へ変更しました`);
  }

  async function saveBookingDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const bookingDetails = Object.fromEntries(["shootTime", "planName", "location", "meetingDetails", "scheduleDetails", "belongings", "rainPolicy", "paymentDetails"].map((key) => [key, String(form.get(key) ?? "")]));
    setSavingDetails(true); setMessage("");
    const { response, data } = await patch({ bookingDetails });
    setSavingDetails(false);
    if (!response.ok) return setMessage(data?.error ?? "撮影案内の保存に失敗しました");
    setMessage("撮影案内を保存しました");
    await loadGallery();
  }

  async function saveCustomerMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const thankYouMessage = String(new FormData(event.currentTarget).get("thankYouMessage") ?? "");
    setSavingMessage(true); setMessage("");
    const { response, data } = await patch({ thankYouMessage });
    setSavingMessage(false);
    if (!response.ok) return setMessage(data?.error ?? "メッセージの保存に失敗しました");
    setGallery((current) => current ? { ...current, thank_you_message: data?.thankYouMessage || null } : current);
    setMessage("お客様へのメッセージを保存しました");
  }

  async function changeCover(photoId: number) {
    setChangingCoverId(photoId); setMessage("");
    const { response, data } = await patch({ coverPhotoId: photoId });
    setChangingCoverId(null);
    if (!response.ok) return setMessage(data?.error ?? "表紙写真の変更に失敗しました");
    setGallery((current) => current ? { ...current, cover_photo_id: photoId } : current);
    setMessage("表紙写真を変更しました");
  }

  async function deletePhoto(photoId: number, filename: string) {
    if (!window.confirm(`${filename}を削除しますか？\nこの操作は元に戻せません。`)) return;
    setDeleting(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/galleries/${params.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId }) });
      const data = await readJsonSafely(response);
      if (!response.ok) return setMessage(data?.error ?? "写真の削除に失敗しました");
      setMessage("写真を削除しました"); await loadGallery();
    } finally { setDeleting(false); }
  }

  async function deleteAllPhotos() {
    if (!window.confirm("この案件の写真をすべて削除しますか？\nこの操作は元に戻せません。")) return;
    setDeleting(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/galleries/${params.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleteAll: true }) });
      const data = await readJsonSafely(response);
      if (!response.ok) return setMessage(data?.error ?? "写真の一括削除に失敗しました");
      setMessage(`${data?.deleted ?? 0}枚の写真を削除しました`); await loadGallery();
    } finally { setDeleting(false); }
  }

  async function uploadPhotos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const files = Array.from((form.elements.namedItem("files") as HTMLInputElement | null)?.files ?? []);
    if (!files.length) return setMessage("写真を選択してください");
    if (files.length > 100) return setMessage("一度に選択できるのは100枚までです");
    const oversized = files.find((file) => file.size > 25 * 1024 * 1024);
    if (oversized) return setMessage(`${oversized.name}は25MBを超えています`);

    setUploading(true); setMessage(""); setProgress(0);
    let completed = 0; const failed: string[] = [];
    for (const [index, file] of files.entries()) {
      setProgressText(`${index + 1} / ${files.length}枚　${file.name}`);
      try { await uploadFileWithRetry(params.id, file); completed += 1; }
      catch (error) { failed.push(`${file.name}: ${error instanceof Error ? error.message : "通信エラー"}`); }
      setProgress(Math.round(((index + 1) / files.length) * 100));
      await wait(200);
    }
    form.reset(); setUploading(false); setProgressText("");
    setMessage(failed.length === 0 ? `${completed}枚アップロードしました` : `${completed}枚成功・${failed.length}枚失敗（${failed.slice(0, 3).join(" / ")}）`);
    await loadGallery();
  }

  if (!gallery) return <main className="admin-shell"><p>{message || "読み込み中..."}</p></main>;
  const publicPath = `/gallery/${gallery.public_id}`;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><Link className="admin-back-link" href="/admin">← 案件一覧へ</Link><p className="eyebrow">GALLERY DETAIL</p><h1>{gallery.customer_name}</h1><p>{gallery.title} ・ {gallery.shoot_date}</p></div>
        <div className="admin-item-meta"><span className={`status status-${gallery.status}`}>{gallery.status}</span><code>{gallery.public_id}</code></div>
      </header>

      <section className="admin-publish-bar">
        <div><strong>お客様向けページ</strong><span>{publicPath}</span><span>現在の表示：{stageLabel(gallery.page_stage)}</span></div>
        <div className="admin-publish-actions">{gallery.status === "published" && <a className="secondary-button" href={publicPath} target="_blank" rel="noreferrer">公開ページを確認</a>}<button className="primary-button" disabled={changingStatus} onClick={() => void changeStatus(gallery.status === "published" ? "paused" : "published")}>{changingStatus ? "変更中..." : gallery.status === "published" ? "非公開にする" : "公開する"}</button></div>
      </section>

      {message && <p className="admin-message">{message}</p>}

      <section className="admin-grid">
        <article className="admin-card">
          <p className="eyebrow">PAGE STAGE</p><h2>表示内容を切り替える</h2><p>URLは変えず、予約案内・編集中・写真納品の表示を切り替えます。</p>
          <div className="admin-publish-actions" style={{ flexWrap: "wrap" }}>
            {(["scheduled", "editing", "delivered"] as const).map((stage) => <button key={stage} className={gallery.page_stage === stage ? "secondary-button" : "primary-button"} disabled={changingStage || gallery.page_stage === stage} onClick={() => void changeStage(stage)}>{stageLabel(stage)}</button>)}
          </div>
        </article>

        <article className="admin-card">
          <p className="eyebrow">SHOOTING GUIDE</p><h2>当日のご案内</h2><p>「撮影予定」のページに表示されます。未入力の項目は表示されません。</p>
          <form className="admin-form" onSubmit={saveBookingDetails}>
            <label>撮影時間<input style={inputStyle} name="shootTime" defaultValue={gallery.shoot_time ?? ""} placeholder="10:00〜11:30" /></label>
            <label>撮影プラン<input style={inputStyle} name="planName" defaultValue={gallery.plan_name ?? ""} placeholder="ファミリープラン" /></label>
            <label>撮影場所<input style={inputStyle} name="location" defaultValue={gallery.location ?? ""} placeholder="佐世保公園" /></label>
            <label>集合・受付<textarea style={textareaStyle} name="meetingDetails" defaultValue={gallery.meeting_details ?? ""} placeholder="開始10分前に○○入口へお越しください。" /></label>
            <label>当日の流れ<textarea style={textareaStyle} name="scheduleDetails" defaultValue={gallery.schedule_details ?? ""} placeholder="ご挨拶・内容確認 → 撮影 → 写真確認" /></label>
            <label>持ち物<textarea style={textareaStyle} name="belongings" defaultValue={gallery.belongings ?? ""} placeholder="飲み物、お子さまのお気に入りのおもちゃなど" /></label>
            <label>雨天時の対応<textarea style={textareaStyle} name="rainPolicy" defaultValue={gallery.rain_policy ?? ""} placeholder="前日までにLINEでご相談します。" /></label>
            <label>お支払い<textarea style={textareaStyle} name="paymentDetails" defaultValue={gallery.payment_details ?? ""} placeholder="撮影当日に現金または○○でお支払いください。" /></label>
            <button className="primary-button" type="submit" disabled={savingDetails}>{savingDetails ? "保存中..." : "撮影案内を保存"}</button>
          </form>
        </article>

        <article className="admin-card"><p className="eyebrow">MESSAGE</p><h2>納品時のメッセージ</h2><p>納品ページの「撮影させていただき、ありがとうございました。」の下に表示されます。</p><form className="admin-form" onSubmit={saveCustomerMessage}><label>メッセージ<textarea name="thankYouMessage" defaultValue={gallery.thank_you_message ?? ""} maxLength={1000} rows={6} placeholder="本日は撮影をご依頼いただき、ありがとうございました。" style={textareaStyle} /></label><button className="primary-button" type="submit" disabled={savingMessage}>{savingMessage ? "保存中..." : "メッセージを保存"}</button></form></article>

        <article className="admin-card"><p className="eyebrow">UPLOAD</p><h2>写真を追加</h2><p>アップロードしても自動公開されません。確認後に「納品済み」へ切り替えてください。</p><form className="admin-form" onSubmit={uploadPhotos}><label>写真を選択<input type="file" name="files" accept="image/*" multiple required /></label><button className="primary-button" type="submit" disabled={uploading}>{uploading ? "アップロード中..." : "写真をアップロード"}</button></form>{uploading && <div className="upload-progress"><div className="upload-progress-track"><span style={{ width: `${progress}%` }} /></div><p>{progress}%　{progressText}</p></div>}</article>

        <article className="admin-card admin-list-card"><p className="eyebrow">PHOTOS</p><div className="admin-publish-actions"><h2>登録済み写真</h2>{photos.length > 0 && <button className="secondary-button" disabled={deleting} onClick={() => void deleteAllPhotos()}>{deleting ? "削除中..." : "すべて削除"}</button>}</div><p>写真を確認しながら、表紙設定や削除ができます。</p>
          {photos.length === 0 ? <p className="admin-empty">まだ写真がありません。</p> : <div className="admin-list">{photos.map((photo, index) => { const isCover = gallery.cover_photo_id === photo.id || (gallery.cover_photo_id === null && index === 0); return <div className="admin-list-item" key={photo.id} style={{ display: "grid", gridTemplateColumns: "88px minmax(0, 1fr)", alignItems: "center", columnGap: 14, rowGap: 14 }}><img src={`/api/admin/galleries/${params.id}/photos/${photo.id}`} alt={photo.original_filename} loading="lazy" style={{ width: 88, height: 66, objectFit: "cover", borderRadius: 8, background: "#e8e5dc" }} /><div style={{ minWidth: 0 }}><strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(index + 1).padStart(2, "0")}　{photo.original_filename}</strong><span>{(photo.file_size / 1024 / 1024).toFixed(2)} MB</span></div><div className="admin-publish-actions" style={{ gridColumn: "1 / -1", flexWrap: "nowrap", width: "100%" }}><button className={isCover ? "secondary-button" : "primary-button"} style={{ flex: 1, minWidth: 0, paddingInline: 14, whiteSpace: "nowrap" }} disabled={isCover || changingCoverId !== null || deleting} onClick={() => void changeCover(photo.id)}>{isCover ? "現在の表紙" : changingCoverId === photo.id ? "変更中..." : "表紙にする"}</button><button className="secondary-button" style={{ flex: 1, minWidth: 0, paddingInline: 14, whiteSpace: "nowrap" }} disabled={deleting} onClick={() => void deletePhoto(photo.id, photo.original_filename)}>削除</button></div></div>; })}</div>}
        </article>
      </section>
    </main>
  );
}
