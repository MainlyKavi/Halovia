"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app/AppProvider";
import { LoadingSkeleton } from "@/components/ui/Primitives";
import { resolveLaunchRoute } from "@/lib/state/app-state";

export function LaunchRouter() {
  const { state, ready } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    router.replace(resolveLaunchRoute(state));
  }, [ready, router, state]);
  return <main className="centered-loading"><LoadingSkeleton /></main>;
}
