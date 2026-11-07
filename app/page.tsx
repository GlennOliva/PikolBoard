import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { absoluteUrl, productConfig, siteUrl } from "@/lib/product-config";

const title = `${productConfig.name} — Live Pickleball Queues, Courts and Leaderboards`;
const description =
  "Run organized pickleball sessions with smart matchmaking, live court tracking, player queues, public QR boards and real-time leaderboards.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: siteUrl(),
  },
  openGraph: {
    title,
    description,
    url: absoluteUrl("/"),
    siteName: productConfig.name,
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: `${productConfig.name} courtside operations`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/twitter-image.png"],
  },
};

export default function Page() {
  return <LandingPage />;
}
