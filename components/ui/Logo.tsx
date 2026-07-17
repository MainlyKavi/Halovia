import Link from "next/link";

export function Logo({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="brand-lockup" aria-label="Halovia home">
      <span className="logo-mark" aria-hidden="true">
        <span className="logo-route" />
        <span className="logo-point" />
      </span>
      {!compact && <span className="brand-word">Halovia</span>}
    </Link>
  );
}
