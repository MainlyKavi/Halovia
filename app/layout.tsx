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
  const description = "An installable journey-safety web app for on-device journey setup, safety check-ins, and clearly labelled emergency-action previews.";
  const socialImage = new URL("/og-halovia.png", base).toString();
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
    openGraph: { title, description, type: "website", siteName: "Halovia", images: [{ url: socialImage, width: 1731, height: 909, alt: "Halovia — Protection that travels with you" }] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const preferenceScript = `(function(){try{var raw=localStorage.getItem('halovia.prototype.v2');if(!raw)return;var state=JSON.parse(raw);var user=state&&state.user;if(!user)return;var theme=['pink','light','dark'].includes(user.theme)?user.theme:'pink';var language=['en','hi','es','fr','ru','ar'].includes(user.language)?user.language:'en';document.documentElement.dataset.theme=theme;document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';}catch(_){}})();`;
  return (
    <html lang="en" dir="ltr" data-theme="pink" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: preferenceScript }} /></head>
      <body><AppProvider>{children}</AppProvider></body>
    </html>
  );
}
