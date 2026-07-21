import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GRIN Photo Gallery",
  description: "GRINからお届けする、写真のための小さなアルバム。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
