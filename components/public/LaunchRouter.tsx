"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app/AppProvider";
import { LoadingSkeleton } from "@/components/ui/Primitives";
import { resolveLaunchRoute } from "@/lib/state/app-state";

export function LaunchRouter() {
  const { state, ready, backendStatus } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!ready || backendStatus === "loading") return;
    if (backendStatus === "authentication_required") {
      window.location.assign("/signin-with-chatgpt?return_to=/launch");
      return;
    }
    router.replace(resolveLaunchRoute(state));
  }, [backendStatus, ready, router, state]);
  return <main className="centered-loading"><LoadingSkeleton /></main>;
}
