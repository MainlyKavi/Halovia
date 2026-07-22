import { HaloviaApp } from "@/components/app/HaloviaApp";
import { SignInRequired } from "@/components/public/SignInRequired";
import { headers } from "next/headers";
import type { Metadata } from "next";

const publicRoutes = new Set(["viewer", "privacy", "terms", "safety-limitations", "feedback", "report-problem", "offline"]);

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  return slug[0] === "viewer" ? { title: "Shared journey · Halovia", robots: { index: false, follow: false, nocache: true } } : {};
}

export default async function AppRoute({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const route = `/${slug.join("/")}`;
  if (!publicRoutes.has(slug[0])) {
    const incoming = await headers();
    const authenticated = Boolean(incoming.get("oai-authenticated-user-email") || process.env.HALOVIA_LOCAL_USER_EMAIL);
    if (!authenticated) return <SignInRequired returnTo={route} />;
  }
  return <HaloviaApp segments={slug} />;
}
