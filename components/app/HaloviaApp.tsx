"use client";

import { AppShell } from "@/components/app/AppShell";
import { HomeView } from "@/components/app/views/HomeView";
import { StartJourneyView } from "@/components/app/views/StartJourneyView";
import { ActiveJourneyView } from "@/components/app/views/ActiveJourneyView";
import { EmergencyView } from "@/components/app/views/EmergencyView";
import { CircleView } from "@/components/app/views/CircleView";
import { JourneysView } from "@/components/app/views/JourneysView";
import { JourneyDetailView } from "@/components/app/views/JourneyDetailView";
import { SettingsView } from "@/components/app/views/SettingsView";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { LaunchRouter } from "@/components/public/LaunchRouter";
import { PublicInfoPage, type PublicPageKind } from "@/components/public/PublicInfoPage";
import { TrustedViewer } from "@/components/public/TrustedViewer";

const publicPages: Record<string, PublicPageKind> = {
  privacy: "privacy",
  terms: "terms",
  "safety-limitations": "safety",
  feedback: "feedback",
  "report-problem": "report",
  offline: "offline",
};

export function HaloviaApp({ segments }: { segments: string[] }) {
  const route = `/${segments.join("/")}`;
  if (segments[0] === "onboarding") return <OnboardingFlow />;
  if (segments[0] === "launch") return <LaunchRouter />;
  if (segments[0] === "viewer" && segments[1]) return <TrustedViewer token={segments[1]} />;
  if (publicPages[segments[0]]) return <PublicInfoPage kind={publicPages[segments[0]]} />;
  let view: React.ReactNode = <HomeView />;
  if (segments[0] === "start") view = <StartJourneyView />;
  else if (segments[0] === "active") view = <ActiveJourneyView />;
  else if (segments[0] === "emergency") view = <EmergencyView />;
  else if (segments[0] === "circle") view = <CircleView />;
  else if (segments[0] === "journeys" && segments[1]) view = <JourneyDetailView id={segments[1]} />;
  else if (segments[0] === "journeys") view = <JourneysView />;
  else if (segments[0] === "settings") view = <SettingsView />;
  return <AppShell route={route}>{view}</AppShell>;
}
