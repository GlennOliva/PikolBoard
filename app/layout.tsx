import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { RetroBackground } from "@/components/layout/retro-background";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { productConfig, siteUrl } from "@/lib/product-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${productConfig.name} — ${productConfig.tagline}`,
    template: `%s · ${productConfig.name}`,
  },
  description: productConfig.description,
  applicationName: productConfig.name,
  category: "sports",
  manifest: "/manifest.webmanifest",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: `${productConfig.name} — ${productConfig.tagline}`,
    description: productConfig.description,
    siteName: productConfig.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${productConfig.name} — ${productConfig.tagline}`,
    description: productConfig.description,
    creator: productConfig.twitter,
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F4EC" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0B18" },
  ],
};

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} flex min-h-dvh flex-col antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <RetroBackground />
          <SiteHeader />
          <main className="retro-page flex-1 py-8 sm:py-10">{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
