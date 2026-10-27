"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app/AppProvider";
import { LoadingSkeleton } from "@/components/ui/Primitives";

export function LaunchRouter() {
  const { state, ready } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (state.activeJourney) router.replace("/active");
    else if (state.user.onboardingComplete) router.replace("/home");
    else router.replace("/");
  }, [ready, router, state.activeJourney, state.user.onboardingComplete]);
  return <main className="centered-loading"><LoadingSkeleton /></main>;
}
