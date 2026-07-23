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
        setError(data.error ?? "ギャラリーを読み込めませんでした");
        return;
      }
      setGallery(data.gallery ?? null);
      setPhotos(data.photos ?? []);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    }
  }, [params.publicId]);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  const slideshowPhotos = useMemo(() => {
    const selected = photos
      .filter((photo) => photo.is_slideshow === 1)
      .sort((a, b) => (a.slideshow_order ?? 9999) - (b.slideshow_order ?? 9999));
    return selected.length > 0 ? selected : photos.slice(0, 12);
  }, [photos]);

  useEffect(() => {
    if (slideshowPhotos.length < 2) return;
    const timer = window.setInterval(() => {
      setCurrent((value) => (value + 1) % slideshowPhotos.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [slideshowPhotos.length, slideTimerKey]);

  const changeSlide = (next: number) => {
    setCurrent(next);
    setSlideTimerKey((value) => value + 1);
  };

  if (error) {
    return (
      <main className="public-gallery-state">
        <div className="brand">GRIN</div>
        <h1>ギャラリー</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!gallery) {
    return <main className="public-gallery-state"><p>ギャラリーを読み込んでいます...</p></main>;
  }

  const cover = photos.find((photo) => photo.id === gallery.cover_photo_id) ?? photos[0];
  const formattedDate = gallery.shoot_date.replaceAll("-", ".");

  return (
    <main className="public-gallery-page">
      <section className="gallery-cover">
        {cover && <img src={cover.imageUrl} alt="ギャラリー表紙" />}
        <div className="gallery-cover-shade" />
        <div className="brand" style={{ position: "absolute", top: 28, left: 28, zIndex: 2, fontSize: 14 }}>GRIN</div>
        <div className="gallery-cover-content">
          <h1>{gallery.title}</h1>
          <p className="gallery-customer">{gallery.customer_name}</p>
          <p className="date">{formattedDate}</p>
          <a className="primary-button" href="#slideshow">思い出を見る</a>
        </div>
      </section>

      {slideshowPhotos.length > 0 && (
        <section id="slideshow" className="public-slideshow-section">
          <div className="section-heading"><h2>思い出をゆっくり眺める</h2></div>
          <div className="public-slideshow-card">
            <div style={{ position: "relative", overflow: "hidden", aspectRatio: "3 / 2", background: "#e8e5dc" }}>
              {slideshowPhotos.map((photo, index) => {
                const active = index === current;
                return (
                  <img
                    key={photo.id}
                    src={photo.imageUrl}
                    alt={active ? photo.original_filename : ""}
                    aria-hidden={!active}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      opacity: active ? 1 : 0,
                      transform: active ? "scale(1.035)" : "scale(1)",
                      transition: "opacity 1.1s ease, transform 8s ease-out",
                    }}
                  />
                );
              })}
            </div>
            <div className="slide-controls">
              <button onClick={() => changeSlide((current - 1 + slideshowPhotos.length) % slideshowPhotos.length)} aria-label="前の写真">←</button>
              <span>{String(current + 1).padStart(2, "0")} / {String(slideshowPhotos.length).padStart(2, "0")}</span>
              <button onClick={() => changeSlide((current + 1) % slideshowPhotos.length)} aria-label="次の写真">→</button>
            </div>
          </div>
        </section>
      )}

      <section className="public-photo-section">
        <div className="section-heading"><h2>すべての写真</h2><p>全{photos.length}枚</p></div>
        <div className="public-photo-grid">
          {photos.map((photo, index) => (
            <button key={photo.id} onClick={() => setLightbox(index)} aria-label={`${photo.original_filename}を開く`}>
              <img src={photo.imageUrl} alt={photo.original_filename} loading="lazy" />
            </button>
          ))}
        </div>
      </section>

      <section className="download section-narrow" style={{ width: "min(100% - 40px, 960px)" }}>
        <h2>大切な写真を保存する</h2>
        <p style={{ maxWidth: 900, fontSize: 14, lineHeight: 1.9, color: "#777970" }}>写真は1枚ずつ保存することも、ZIPファイルでまとめて保存することもできます。</p>
        <p style={{ maxWidth: 760, fontSize: 12, lineHeight: 1.9, color: "#8b8d85" }}>iPhoneでは、写真を開いて「この写真を保存」を押したあと、共有画面から「画像を保存」を選ぶと写真アプリに保存できます。ZIPファイルは「ファイル」アプリに保存されます。</p>
        {photos.length > 0 && <div className="download-actions"><a className="primary-button" href={`/api/gallery/${params.publicId}/download`}>すべての写真を保存</a></div>}
        <p style={{ maxWidth: 900, fontSize: 13, lineHeight: 1.9, color: "#888a82" }}>写真枚数や通信環境によって、ダウンロード開始まで時間がかかる場合があります。</p>
      </section>

      <section className="thanks section-narrow">
        <h2>撮影させていただき、ありがとうございました。</h2>
        {gallery.thank_you_message && <p style={{ whiteSpace: "pre-wrap", maxWidth: 680, marginTop: 34 }}>{gallery.thank_you_message}</p>}
        <div style={{ marginTop: 52 }}>
          <span style={{ display: "block", color: "#85877e", fontSize: 12, letterSpacing: ".14em" }}>公開期限</span>
          <span style={{ display: "block", marginTop: 8, fontFamily: "Georgia, serif", letterSpacing: ".12em" }}>{gallery.expires_at.replaceAll("-", ".")}</span>
        </div>
      </section>

      <footer>
        <div className="brand">GRIN</div>
        <p>Photo &amp; Memory</p>
        <p className="copyright">© 2026 GRIN</p>
      </footer>

      {lightbox !== null && photos[lightbox] && (
        <div className="lightbox" role="dialog" aria-modal="true">
          <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="閉じる">×</button>
          <button className="lightbox-nav lightbox-prev" onClick={() => setLightbox((lightbox - 1 + photos.length) % photos.length)} aria-label="前の写真">←</button>
          <div className="lightbox-content">
            <img src={photos[lightbox].imageUrl} alt={photos[lightbox].original_filename} />
            <div className="lightbox-actions">
              <span>{lightbox + 1} / {photos.length}</span>
              <a className="primary-button" href={photos[lightbox].downloadUrl}>この写真を保存</a>
            </div>
          </div>
          <button className="lightbox-nav lightbox-next" onClick={() => setLightbox((lightbox + 1) % photos.length)} aria-label="次の写真">→</button>
        </div>
      )}
    </main>
  );
}
