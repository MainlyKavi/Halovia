import type { Metadata } from "next";
import { headers } from "next/headers";
import { AppProvider } from "@/components/app/AppProvider";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const title = "Halovia — Protection that travels with you";
  const description = "Share your journey with people you trust, check in along the way, and get support quickly when you need it.";
  const socialImage = new URL("/og-protection-v2.png", base).toString();
  return {
    metadataBase: base,
    title: { default: title, template: "%s · Halovia" },
    description,
    applicationName: "Halovia",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "Halovia", statusBarStyle: "default" },
    formatDetection: { telephone: false },
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
      { media: "(prefers-color-scheme: dark)", color: "#17171c" },
    ],
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/icons/icon-192.png" },
    openGraph: { title, description, type: "website", siteName: "Halovia", images: [{ url: socialImage, width: 1672, height: 941, alt: "Halovia — protection that travels with you" }] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const preferenceScript = `(function(){try{var raw=localStorage.getItem('halovia.preferences.v3');if(!raw)return;var state=JSON.parse(raw);var theme=['pink','light','dark'].includes(state.theme)?state.theme:'pink';var language=['en','hi','es','fr','ru','ur','bn','ta','ar'].includes(state.language)?state.language:'en';document.documentElement.dataset.theme=theme;document.documentElement.lang=language;document.documentElement.dir=(language==='ar'||language==='ur')?'rtl':'ltr';}catch(_){}})();`;
  return (
    <html lang="en" dir="ltr" data-theme="pink" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: preferenceScript }} /></head>
      <body><AppProvider>{children}</AppProvider></body>
    </html>
  );
}
