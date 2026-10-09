import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { productConfig, siteUrl } from "@/lib/product-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  // Product name and copy come from lib/product-config so a rename is one edit.
  title: {
    default: `${productConfig.name} — ${productConfig.tagline}`,
    template: `%s · ${productConfig.name}`,
  },
  description: productConfig.description,
  applicationName: productConfig.name,
  openGraph: {
    title: productConfig.name,
    description: productConfig.tagline,
    siteName: productConfig.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: productConfig.name,
    description: productConfig.tagline,
    creator: productConfig.twitter,
  },
};

export const viewport: Viewport = {
  // Comfortable tap targets matter more on a phone courtside than on a desk.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

const geistSans = Geist({
  variable: "--font-geist-sans",
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
        className={`${geistSans.className} antialiased flex min-h-dvh flex-col`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
            {children}
          </main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
