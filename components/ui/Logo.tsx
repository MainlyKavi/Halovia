"use client";

import Link from "next/link";
import { useApp } from "@/components/app/AppProvider";

export function Logo({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  const { t } = useApp();
  return (
    <Link href={href} className="brand-lockup" aria-label={t("logo.home")}>
      <span className="logo-mark" aria-hidden="true">
        <span className="logo-route" />
        <span className="logo-point" />
      </span>
      {!compact && <span className="brand-word">Halovia</span>}
    </Link>
  );
}
