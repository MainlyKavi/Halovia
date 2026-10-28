import { Car, Check, LoaderCircle, MapPin, Route, UserRound } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Primitives";
import { defaultRecipients, toggleSelection } from "@/lib/ride/group";
import { useSafety } from "../state";
import { Sheet } from "./Sheet";

/** Opened from "Share with Halovia". Remounted each time it opens, so the selection starts fresh. */
export function ShareSheet() {
  const { shareSheetOpen, setShareSheetOpen, t } = useSafety();
  return (
    <Sheet open={shareSheetOpen} title={t("share.title")} onClose={() => setShareSheetOpen(false)} closeLabel={t("common.close")}>
      {shareSheetOpen && <ShareSheetBody />}
    </Sheet>
  );
}

function ShareSheetBody() {
  const { members, t, startSharing, setShareSheetOpen, navigate, showToast } = useSafety();
  const [selected, setSelected] = useState<string[]>(() => defaultRecipients(members));
  const [busy, setBusy] = useState(false);
  const items = [
    { icon: MapPin, label: t("share.liveLocation") },
    { icon: UserRound, label: t("share.driverDetails") },
    { icon: Car, label: t("share.plate") },
    { icon: Route, label: t("share.journey") },
  ];

  const start = async () => {
    setBusy(true);
    await startSharing(selected);
    setBusy(false);
    setShareSheetOpen(false);
    showToast(selected.length === 1 ? t("track.sharingWithOne") : t("share.started", { count: selected.length }));
    navigate("ride");
  };

  return (
    <div className="m-share">
      <h3>{t("share.whatTitle")}</h3>
      <ul className="m-share-items">
        {items.map(({ icon: Icon, label }) => <li key={label}><span><Icon size={17} /></span>{label}<Check size={16} className="m-share-check" /></li>)}
      </ul>
      <h3>{t("share.whoTitle")}</h3>
      {members.length === 0 ? (
        <div className="m-empty-inline">
          <p>{t("share.noMembers")}</p>
          <button type="button" className="button button-secondary" onClick={() => { setShareSheetOpen(false); navigate("group"); }}>{t("group.add")}</button>
        </div>
      ) : (
        <div className="m-member-picks" role="group" aria-label={t("share.whoTitle")}>
          {members.map((member) => {
            const on = selected.includes(member.id);
            return (
              <button key={member.id} type="button" className={`m-member-pick ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setSelected((current) => toggleSelection(current, member.id))}>
                <Avatar initials={member.initials} color={member.color} />
                <span><strong>{member.name}</strong><small>{member.relation}</small></span>
                <span className="m-check" aria-hidden="true">{on && <Check size={15} />}</span>
              </button>
            );
          })}
        </div>
      )}
      <button type="button" className="button button-primary button-lg m-block" disabled={!selected.length || busy} onClick={() => void start()}>
        {busy ? <LoaderCircle className="spin" size={18} /> : null}
        {selected.length ? t("share.startCount", { count: selected.length }) : t("share.noneSelected")}
      </button>
    </div>
  );
}
