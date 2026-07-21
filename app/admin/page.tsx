"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Gallery = {
  id: number;
  public_id: string;
  customer_name: string;
  title: string;
  shoot_date: string;
  status: string;
  expires_at: string;
};

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const loadGalleries = useCallback(async () => {
    const response = await fetch("/api/admin/galleries", { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }
    const data = (await response.json()) as { galleries?: Gallery[]; error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "読み込みに失敗しました");
      return;
    }
    setGalleries(data.galleries ?? []);
    setAuthenticated(true);
  }, []);

  useEffect(() => {
    void loadGalleries();
  }, [loadGalleries]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    const form = new FormData(formElement);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.get("password") }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "ログインできませんでした");
        return;
      }
      formElement.reset();
      await loadGalleries();
    } catch {
      setMessage("通信に失敗しました。もう一度お試しください。");
    }
  }

  async function createGallery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setMessage("");
    const form = new FormData(formElement);

    try {
      const response = await fetch("/api/admin/galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.get("customerName"),
          title: form.get("title"),
          shootDate: form.get("shootDate"),
          expiresAt: form.get("expiresAt"),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "作成に失敗しました");
        return;
      }
      formElement.reset();
      setMessage("案件を作成しました");
      await loadGalleries();
    } catch {
      setMessage("通信に失敗しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  if (authenticated === null) {
    return <main className="admin-shell"><p>読み込み中...</p></main>;
  }

  if (!authenticated) {
    return (
      <main className="admin-shell admin-login-shell">
        <section className="admin-card admin-login-card">
          <p className="eyebrow">GRIN DELIVERY</p>
          <h1>管理画面</h1>
          <p>設定した管理パスワードを入力してください。</p>
          <form className="admin-form" onSubmit={login}>
            <label>パスワード<input type="password" name="password" required autoFocus /></label>
            <button className="primary-button" type="submit">ログイン</button>
          </form>
          {message && <p className="admin-message">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p className="eyebrow">GRIN DELIVERY</p><h1>案件管理</h1></div>
        <button className="secondary-button" onClick={async () => {
          await fetch("/api/admin/login", { method: "DELETE" });
          setAuthenticated(false);
        }}>ログアウト</button>
      </header>

      <section className="admin-grid">
        <article className="admin-card">
          <p className="eyebrow">NEW GALLERY</p>
          <h2>新しい案件を作成</h2>
          <form className="admin-form" onSubmit={createGallery}>
            <label>お客様名<input name="customerName" placeholder="山田様" required /></label>
            <label>タイトル<input name="title" placeholder="Family Photo" required /></label>
            <label>撮影日<input type="date" name="shootDate" required /></label>
            <label>公開期限<input type="date" name="expiresAt" required /></label>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? "作成中..." : "案件を作成"}</button>
          </form>
          {message && <p className="admin-message">{message}</p>}
        </article>

        <article className="admin-card admin-list-card">
          <p className="eyebrow">GALLERIES</p>
          <h2>案件一覧</h2>
          {galleries.length === 0 ? <p className="admin-empty">まだ案件がありません。</p> : (
            <div className="admin-list">
              {galleries.map((gallery) => (
                <div className="admin-list-item" key={gallery.id}>
                  <div>
                    <strong>{gallery.customer_name}</strong>
                    <span>{gallery.title} ・ {gallery.shoot_date}</span>
                  </div>
                  <div className="admin-item-meta">
                    <span className={`status status-${gallery.status}`}>{gallery.status}</span>
                    <code>{gallery.public_id}</code>
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
