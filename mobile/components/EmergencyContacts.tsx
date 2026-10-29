import { Ambulance, Baby, ChevronRight, ShieldHalf, ShieldPlus, UserRound } from "lucide-react";
import type { RideStringKey } from "@/lib/ride/strings";
import { useSafety } from "../state";

// National helplines in India. Tiles are tel: links: Android opens the dialer
// with the number filled in and the user still has to press call. In demo
// mode they never dial; a toast says what would have happened.
const LINES: ReadonlyArray<{ key: RideStringKey; number: string; icon: typeof Baby }> = [
  { key: "emergency.child", number: "1098", icon: Baby },
  { key: "emergency.women", number: "181", icon: UserRound },
  { key: "emergency.police", number: "112", icon: ShieldHalf },
  { key: "emergency.ambulance", number: "108", icon: Ambulance },
];

export function EmergencyContactsCard({ onMore }: { onMore?: () => void }) {
  const { t, settings, showToast } = useSafety();
  return (
    <section className="card m-card m-emergency-card" aria-labelledby="emergency-contacts-title">
      <header className="m-card-head">
        <h3 id="emergency-contacts-title" className="m-pink-title"><ShieldPlus size={22} />{t("emergency.contacts")}</h3>
        {onMore && <button type="button" className="m-link" onClick={onMore}>{t("emergency.quick")}<ChevronRight size={15} /></button>}
      </header>
      <div className="m-lines">
        {LINES.map(({ key, number, icon: Icon }) => (
          <a key={number} className="m-line" href={settings.demoMode ? undefined : `tel:${number}`} role={settings.demoMode ? "button" : undefined} tabIndex={0} onClick={settings.demoMode ? (event) => { event.preventDefault(); showToast(t("sos.simulatedCall", { number }), "warning"); } : undefined} aria-label={t("emergency.callAria", { name: t(key), number })}>
            <Icon size={28} strokeWidth={1.8} />
            <small>{t(key)}</small>
            <strong>{number}</strong>
          </a>
        ))}
      </div>
    </section>
  );
}
