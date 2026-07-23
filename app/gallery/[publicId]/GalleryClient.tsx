"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Gallery = {
  public_id: string;
  customer_name: string;
  title: string;
  shoot_date: string;
  location: string | null;
  cover_message: string | null;
  thank_you_message: string | null;
  expires_at: string;
  cover_photo_id: number | null;
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
  is_slideshow: number;
  slideshow_order: number | null;
  imageUrl: string;
  downloadUrl: string;
};

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div style={{ padding: "22px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ display: "block", color: "#85877e", fontSize: 12, letterSpacing: ".14em", marginBottom: 8 }}>{label}</span>
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.9, margin: 0 }}>{value}</p>
    </div>
  );
}

export default function GalleryClient() {
  const params = useParams<{ publicId: string }>();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);
  const [slideTimerKey, setSlideTimerKey] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const loadGallery = useCallback(async () => {
    try {
      const response = await fetch(`/api/gallery/${params.publicId}`, { cache: "no-store" });
      const data = (await response.json()) as { gallery?: Gallery; photos?: Photo[]; error?: string };
      if (!response.ok) {
        setError(data.error ?? "ページを読み込めませんでした");
        return;
      }
      setGallery(data.gallery ?? null);
      setPhotos(data.photos ?? []);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    }
  }, [params.publicId]);

  useEffect(() => { void loadGallery(); }, [loadGallery]);

  const slideshowPhotos = useMemo(() => {
    const selected = photos.filter((photo) => photo.is_slideshow === 1)
      .sort((a, b) => (a.slideshow_order ?? 9999) - (b.slideshow_order ?? 9999));
    return selected.length > 0 ? selected : photos.slice(0, 12);
  }, [photos]);

  useEffect(() => {
    if (slideshowPhotos.length < 2) return;
    const timer = window.setInterval(() => setCurrent((value) => (value + 1) % slideshowPhotos.length), 8000);
    return () => window.clearInterval(timer);
  }, [slideshowPhotos.length, slideTimerKey]);

  const changeSlide = (next: number) => {
    setCurrent(next);
    setSlideTimerKey((value) => value + 1);
  };

  if (error) return <main className="public-gallery-state"><div className="brand">GRIN</div><h1>お客様専用ページ</h1><p>{error}</p></main>;
  if (!gallery) return <main className="public-gallery-state"><p>ページを読み込んでいます...</p></main>;

  const formattedDate = gallery.shoot_date.replaceAll("-", ".");

  if (gallery.page_stage === "scheduled") {
    return (
      <main className="public-gallery-page">
        <section className="intro section-narrow" style={{ paddingTop: 72 }}>
          <div className="brand">GRIN</div>
          <p className="eyebrow" style={{ marginTop: 42 }}>SHOOTING GUIDE</p>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, marginTop: 16 }}>{gallery.customer_name}様 撮影専用ページ</h1>
          <p style={{ marginTop: 20 }}>ご予約ありがとうございます。当日のご案内をこちらにまとめています。</p>
        </section>
        <section className="section-narrow" style={{ width: "min(100% - 40px, 760px)", paddingBottom: 90 }}>
          <Detail label="撮影日" value={`${formattedDate}${gallery.shoot_time ? ` ${gallery.shoot_time}` : ""}`} />
          <Detail label="撮影プラン" value={gallery.plan_name} />
          <Detail label="撮影場所" value={gallery.location} />
          <Detail label="集合・受付" value={gallery.meeting_details} />
          <Detail label="当日の流れ" value={gallery.schedule_details} />
          <Detail label="持ち物" value={gallery.belongings} />
          <Detail label="雨天時の対応" value={gallery.rain_policy} />
          <Detail label="お支払い" value={gallery.payment_details} />
          <p style={{ marginTop: 44, lineHeight: 1.9, color: "#777970" }}>変更やご不明点は、これまでのLINEトークからご連絡ください。撮影後のお写真も同じURLでご案内します。</p>
        </section>
        <footer><div className="brand">GRIN</div><p>Photo &amp; Memory</p><p className="copyright">© 2026 GRIN</p></footer>
      </main>
    );
  }

  if (gallery.page_stage === "editing") {
    return (
      <main className="public-gallery-page">
        <section className="intro section-narrow" style={{ minHeight: "72vh", display: "grid", placeContent: "center" }}>
          <div className="brand">GRIN</div>
          <p className="eyebrow" style={{ marginTop: 42 }}>NOW EDITING</p>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, marginTop: 16 }}>{gallery.customer_name}様</h1>
          <h2 style={{ marginTop: 28 }}>撮影ありがとうございました。</h2>
          <p style={{ marginTop: 24, lineHeight: 2 }}>現在、お写真を一枚ずつ丁寧に仕上げています。<br />完成しましたらLINEでお知らせします。</p>
          <p style={{ marginTop: 18, color: "#85877e", fontSize: 13 }}>納品後も、このページと同じURLからご覧いただけます。</p>
        </section>
        <footer><div className="brand">GRIN</div><p>Photo &amp; Memory</p><p className="copyright">© 2026 GRIN</p></footer>
      </main>
    );
  }

  const cover = photos.find((photo) => photo.id === gallery.cover_photo_id) ?? photos[0];

  return (
    <main className="public-gallery-page">
      <section className="gallery-cover">
        {cover && <img src={cover.imageUrl} alt="ギャラリー表紙" />}
        <div className="gallery-cover-shade" />
        <div className="brand" style={{ position: "absolute", top: 28, left: 28, zIndex: 2, fontSize: 14 }}>GRIN</div>
        <div className="gallery-cover-content"><h1>{gallery.title}</h1><p className="gallery-customer">{gallery.customer_name}</p><p className="date">{formattedDate}</p><a className="primary-button" href="#slideshow">思い出を見る</a></div>
      </section>

      {slideshowPhotos.length > 0 && (
        <section id="slideshow" className="public-slideshow-section">
          <div className="section-heading"><h2>思い出をゆっくり眺める</h2></div>
          <div className="public-slideshow-card">
            <div style={{ position: "relative", overflow: "hidden", aspectRatio: "3 / 2", background: "#e8e5dc" }}>
              {slideshowPhotos.map((photo, index) => {
                const active = index === current;
                return <img key={photo.id} src={photo.imageUrl} alt={active ? photo.original_filename : ""} aria-hidden={!active} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: active ? 1 : 0, transform: active ? "scale(1.035)" : "scale(1)", transition: "opacity 1.1s ease, transform 8s ease-out" }} />;
              })}
            </div>
            <div className="slide-controls"><button onClick={() => changeSlide((current - 1 + slideshowPhotos.length) % slideshowPhotos.length)} aria-label="前の写真">←</button><span>{String(current + 1).padStart(2, "0")} / {String(slideshowPhotos.length).padStart(2, "0")}</span><button onClick={() => changeSlide((current + 1) % slideshowPhotos.length)} aria-label="次の写真">→</button></div>
          </div>
        </section>
      )}

      <section className="public-photo-section"><div className="section-heading"><h2>すべての写真</h2><p>全{photos.length}枚</p></div><div className="public-photo-grid">{photos.map((photo, index) => <button key={photo.id} onClick={() => setLightbox(index)} aria-label={`${photo.original_filename}を開く`}><img src={photo.imageUrl} alt={photo.original_filename} loading="lazy" /></button>)}</div></section>

      <section className="download section-narrow" style={{ width: "min(100% - 40px, 960px)" }}><h2>大切な写真を保存する</h2><p style={{ maxWidth: 900, fontSize: 14, lineHeight: 1.9, color: "#777970" }}>写真は1枚ずつ保存することも、ZIPファイルでまとめて保存することもできます。</p><p style={{ maxWidth: 760, fontSize: 12, lineHeight: 1.9, color: "#8b8d85" }}>iPhoneでは、写真を開いて「この写真を保存」を押したあと、共有画面から「画像を保存」を選ぶと写真アプリに保存できます。ZIPファイルは「ファイル」アプリに保存されます。</p>{photos.length > 0 && <div className="download-actions"><a className="primary-button" href={`/api/gallery/${params.publicId}/download`}>すべての写真を保存</a></div>}</section>

      <section className="thanks section-narrow"><h2>撮影させていただき、ありがとうございました。</h2>{gallery.thank_you_message && <p style={{ whiteSpace: "pre-wrap", maxWidth: 680, marginTop: 34 }}>{gallery.thank_you_message}</p>}<div style={{ marginTop: 52 }}><span style={{ display: "block", color: "#85877e", fontSize: 12, letterSpacing: ".14em" }}>公開期限</span><span style={{ display: "block", marginTop: 8, fontFamily: "Georgia, serif", letterSpacing: ".12em" }}>{gallery.expires_at.replaceAll("-", ".")}</span></div></section>

      <footer><div className="brand">GRIN</div><p>Photo &amp; Memory</p><p className="copyright">© 2026 GRIN</p></footer>

      {lightbox !== null && photos[lightbox] && <div className="lightbox" role="dialog" aria-modal="true"><button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="閉じる">×</button><button className="lightbox-nav lightbox-prev" onClick={() => setLightbox((lightbox - 1 + photos.length) % photos.length)} aria-label="前の写真">←</button><div className="lightbox-content"><img src={photos[lightbox].imageUrl} alt={photos[lightbox].original_filename} /><div className="lightbox-actions"><span>{lightbox + 1} / {photos.length}</span><a className="primary-button" href={photos[lightbox].downloadUrl}>この写真を保存</a></div></div><button className="lightbox-nav lightbox-next" onClick={() => setLightbox((lightbox + 1) % photos.length)} aria-label="次の写真">→</button></div>}
    </main>
  );
}
