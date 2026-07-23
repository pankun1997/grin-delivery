import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import GalleryClient from "./GalleryClient";

const SITE_URL = "https://gallery.grinphotograph-1023.com";
const DEFAULT_DESCRIPTION = "GRINがお届けする、お客様専用のフォトギャラリーです。";

type PageProps = {
  params: Promise<{ publicId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { publicId } = await params;

  try {
    const { env } = getCloudflareContext();
    const bindings = env as unknown as { DB: D1Database };

    const gallery = await bindings.DB.prepare(
      `SELECT id, customer_name, title, cover_photo_id
       FROM galleries
       WHERE public_id = ? AND status = 'published'`
    ).bind(publicId).first<{
      id: number;
      customer_name: string;
      title: string;
      cover_photo_id: number | null;
    }>();

    if (!gallery) {
      return {
        title: "PHOTO GALLERY｜GRIN",
        description: DEFAULT_DESCRIPTION,
      };
    }

    let coverPhotoId = gallery.cover_photo_id;

    if (!coverPhotoId) {
      const firstPhoto = await bindings.DB.prepare(
        `SELECT id FROM photos WHERE gallery_id = ? ORDER BY display_order, id LIMIT 1`
      ).bind(gallery.id).first<{ id: number }>();
      coverPhotoId = firstPhoto?.id ?? null;
    }

    const title = `${gallery.customer_name}様 PHOTO GALLERY｜GRIN`;
    const pageUrl = `${SITE_URL}/gallery/${publicId}`;
    const imageUrl = coverPhotoId
      ? `${SITE_URL}/api/gallery/${publicId}/photos/${coverPhotoId}`
      : undefined;

    return {
      title,
      description: DEFAULT_DESCRIPTION,
      alternates: { canonical: pageUrl },
      openGraph: {
        type: "website",
        locale: "ja_JP",
        siteName: "GRIN",
        title,
        description: DEFAULT_DESCRIPTION,
        url: pageUrl,
        images: imageUrl
          ? [{ url: imageUrl, alt: `${gallery.customer_name}様のフォトギャラリー` }]
          : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: DEFAULT_DESCRIPTION,
        images: imageUrl ? [imageUrl] : undefined,
      },
      robots: {
        index: false,
        follow: false,
      },
    };
  } catch {
    return {
      title: "PHOTO GALLERY｜GRIN",
      description: DEFAULT_DESCRIPTION,
      robots: { index: false, follow: false },
    };
  }
}

export default function PublicGalleryPage() {
  return <GalleryClient />;
}
