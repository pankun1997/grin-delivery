"use client";

import { useState } from "react";

type ViewStatus = "scheduled" | "editing" | "delivered";

const samplePhotos = [
  "linear-gradient(135deg, #d9d0c3, #9b8b78)",
  "linear-gradient(135deg, #c8d3cc, #7f9487)",
  "linear-gradient(135deg, #d6c5bd, #9c7669)",
  "linear-gradient(135deg, #d9d4bd, #999166)",
  "linear-gradient(135deg, #c5c9d7, #747e9b)",
  "linear-gradient(135deg, #d7c8d1, #977788)",
];

export default function PreviewPage() {
  const [status, setStatus] = useState<ViewStatus>("scheduled");

  return (
    <main style={{ minHeight: "100vh", background: "#f5f2eb", color: "#30322f" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 20, padding: "14px 18px", background: "rgba(255,255,255,.94)", borderBottom: "1px solid #ddd8ce", backdropFilter: "blur(12px)" }}>
        <div style={{ width: "min(100%, 980px)", margin: "0 auto", display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <strong>GRIN 画面プレビュー</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {([
              ["scheduled", "撮影予定"],
              ["editing", "編集中"],
              ["delivered", "納品済み"],
            ] as const).map(([value, label]) => (
              <button key={value} onClick={() => setStatus(value)} style={{ border: "1px solid #bbb6ab", borderRadius: 999, padding: "9px 14px", background: status === value ? "#30322f" : "#fff", color: status === value ? "#fff" : "#30322f", cursor: "pointer" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {status === "scheduled" && <ScheduledPreview />}
      {status === "editing" && <EditingPreview />}
      {status === "delivered" && <DeliveredPreview />}
    </main>
  );
}

function BrandHeader({ label }: { label: string }) {
  return (
    <header style={{ textAlign: "center", padding: "74px 20px 38px" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 20, letterSpacing: ".22em" }}>GRIN</div>
      <p style={{ marginTop: 28, fontSize: 11, letterSpacing: ".22em", color: "#85877e" }}>{label}</p>
      <h1 style={{ margin: "18px 0 0", fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "clamp(34px, 8vw, 66px)" }}>宮本様</h1>
    </header>
  );
}

function ScheduledPreview() {
  return (
    <>
      <BrandHeader label="SHOOTING INFORMATION" />
      <section style={{ width: "min(100% - 36px, 760px)", margin: "0 auto 70px", background: "#fff", borderRadius: 24, padding: "clamp(24px, 5vw, 48px)", boxShadow: "0 24px 70px rgba(80,70,55,.08)" }}>
        <p style={{ textAlign: "center", lineHeight: 2, color: "#6f716b" }}>ご予約ありがとうございます。<br />当日はどうぞよろしくお願いいたします。</p>
        <div style={{ display: "grid", gap: 20, marginTop: 42 }}>
          <Info label="撮影日時" value="2026年8月9日（日） 10:00〜11:30" />
          <Info label="撮影プラン" value="ファミリーフォト 90分" />
          <Info label="撮影場所" value="長崎県佐世保市 九十九島周辺" />
          <Info label="集合・受付" value="開始10分前を目安に、現地駐車場へお越しください。" />
        </div>
      </section>
      <section style={{ width: "min(100% - 36px, 760px)", margin: "0 auto 100px", display: "grid", gap: 18 }}>
        <Detail title="当日の流れ" text="ご挨拶・撮影内容の確認 → 撮影 → 写真の確認 → お支払い" />
        <Detail title="持ち物" text="お子さまのお飲み物、タオル、お気に入りのおもちゃなどをご用意ください。" />
        <Detail title="雨天時の対応" text="前日の天気予報を確認し、延期または屋内撮影をご相談します。" />
        <Detail title="お支払い方法" text="撮影当日に現金または指定のキャッシュレス決済でお願いいたします。" />
      </section>
    </>
  );
}

function EditingPreview() {
  return (
    <>
      <BrandHeader label="NOW EDITING" />
      <section style={{ width: "min(100% - 36px, 720px)", margin: "30px auto 110px", textAlign: "center", background: "#fff", borderRadius: 24, padding: "70px 28px", boxShadow: "0 24px 70px rgba(80,70,55,.08)" }}>
        <div style={{ width: 74, height: 74, margin: "0 auto 30px", borderRadius: "50%", border: "1px solid #bbb6ab", display: "grid", placeItems: "center", fontSize: 26 }}>✦</div>
        <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "clamp(26px, 6vw, 42px)", lineHeight: 1.5 }}>ただいま写真を<br />仕上げています。</h2>
        <p style={{ marginTop: 28, lineHeight: 2, color: "#777970" }}>撮影ありがとうございました。<br />完成まで、もうしばらくお待ちください。</p>
        <p style={{ marginTop: 40, fontSize: 13, color: "#92948d" }}>納品予定：撮影日から約2週間以内</p>
      </section>
    </>
  );
}

function DeliveredPreview() {
  return (
    <>
      <section style={{ minHeight: "78vh", position: "relative", display: "grid", placeItems: "center", background: "linear-gradient(135deg, #a9a092, #514a43)", color: "#fff", textAlign: "center", padding: 30 }}>
        <div style={{ position: "absolute", top: 28, left: 28, fontFamily: "Georgia, serif", letterSpacing: ".18em" }}>GRIN</div>
        <div>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "clamp(42px, 10vw, 82px)", margin: 0 }}>Our Family Story</h1>
          <p style={{ letterSpacing: ".18em" }}>宮本様</p>
          <p>2026.08.09</p>
        </div>
      </section>
      <section style={{ width: "min(100% - 36px, 980px)", margin: "80px auto" }}>
        <div style={{ textAlign: "center", marginBottom: 38 }}><h2 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 38 }}>すべての写真</h2><p>全6枚</p></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {samplePhotos.map((background, index) => <div key={index} style={{ aspectRatio: "3 / 2", borderRadius: 12, background }} />)}
        </div>
      </section>
      <section style={{ textAlign: "center", padding: "30px 20px 110px" }}>
        <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 36 }}>大切な写真を保存する</h2>
        <button style={{ marginTop: 24, border: 0, borderRadius: 999, padding: "14px 28px", background: "#30322f", color: "#fff" }}>すべての写真を保存</button>
      </section>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div style={{ borderBottom: "1px solid #e5e0d7", paddingBottom: 18 }}><span style={{ display: "block", fontSize: 11, letterSpacing: ".16em", color: "#92948d" }}>{label}</span><strong style={{ display: "block", marginTop: 8, lineHeight: 1.8 }}>{value}</strong></div>;
}

function Detail({ title, text }: { title: string; text: string }) {
  return <article style={{ background: "#fff", borderRadius: 18, padding: 24 }}><h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontWeight: 400 }}>{title}</h2><p style={{ marginBottom: 0, lineHeight: 1.9, color: "#6f716b" }}>{text}</p></article>;
}
