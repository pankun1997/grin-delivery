const photos = [
  "photo-one",
  "photo-two",
  "photo-three",
  "photo-four",
  "photo-five",
  "photo-six",
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="brand">GRIN</div>
        <p className="eyebrow">PHOTO GALLERY</p>
        <h1>Our Family Story</h1>
        <p className="date">2026.07.20</p>
        <div className="cover-photo" aria-label="表紙写真のサンプル" />
        <a className="primary-button" href="#slideshow">思い出を見る</a>
      </section>

      <section className="intro section-narrow">
        <p className="eyebrow">A LITTLE STORY</p>
        <h2>今日という日が、<br />いつまでもやさしく残りますように。</h2>
        <p>撮影の時間も、写真を見返す時間も、ご家族の大切な思い出になりますように。</p>
      </section>

      <section id="slideshow" className="slideshow-section">
        <div className="section-heading">
          <p className="eyebrow">SLIDESHOW</p>
          <h2>思い出をゆっくり眺める</h2>
        </div>
        <div className="slideshow-card">
          <div className="slide-image" />
          <div className="slide-controls">
            <button aria-label="前の写真">←</button>
            <span>01 / 06</span>
            <button aria-label="次の写真">→</button>
          </div>
        </div>
      </section>

      <section className="gallery-section">
        <div className="section-heading">
          <p className="eyebrow">ALL PHOTOS</p>
          <h2>すべての写真</h2>
        </div>
        <div className="photo-grid">
          {photos.map((photo, index) => (
            <button className={`gallery-photo ${photo}`} key={photo} aria-label={`写真 ${index + 1} を開く`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="download section-narrow">
        <p className="eyebrow">DOWNLOAD</p>
        <h2>大切な写真を保存する</h2>
        <p>写真は1枚ずつ、またはまとめて保存できます。</p>
        <div className="download-actions">
          <button className="primary-button">すべて保存する</button>
          <button className="secondary-button">保存方法を見る</button>
        </div>
      </section>

      <section className="thanks section-narrow">
        <p className="eyebrow">THANK YOU</p>
        <h2>撮影させていただき、<br />ありがとうございました。</h2>
        <p>また少し大きくなった皆さまに、お会いできる日を楽しみにしています。</p>
        <a className="primary-button" href="#contact">LINEで相談する</a>
      </section>

      <footer id="contact">
        <div className="brand">GRIN</div>
        <p>Photo &amp; Memory</p>
        <p className="copyright">© 2026 GRIN</p>
      </footer>
    </main>
  );
}
