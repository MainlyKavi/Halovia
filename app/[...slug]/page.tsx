import { HaloviaApp } from "@/components/app/HaloviaApp";

export default async function AppRoute({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <HaloviaApp segments={slug} />;
}
