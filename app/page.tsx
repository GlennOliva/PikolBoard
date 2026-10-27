import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

const title = "PickleBoard — Live Pickleball Queues, Courts and Leaderboards";
const description =
  "Run organized pickleball sessions with smart matchmaking, live court tracking, player queues, public QR boards and real-time leaderboards.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "https://pikol-board.vercel.app",
  },
  openGraph: {
    title,
    description,
    url: "https://pikol-board.vercel.app",
    siteName: "PickleBoard",
    type: "website",
    images: ["/opengraph-image.png"],
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
