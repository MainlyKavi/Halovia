import { AlertTriangle, Check, CheckCheck, Eye, LoaderCircle, MapPin, WifiOff } from "lucide-react";
import { recipientStatuses, sendState, type RecipientState } from "@/lib/ride/live-sos";
import { useNow } from "../hooks";
import { useSafety } from "../state";
import { useLiveSos } from "./LiveSosProvider";

const ICONS: Record<RecipientState, typeof Check> = { waiting: LoaderCircle, pushFailed: AlertTriangle, delivered: CheckCheck, seen: Eye, acknowledged: Check };

/** On the sender's SOS screen: Queued / Sent, then Delivered, Seen by, Acknowledged per person. */
export function SosDeliveryStatus() {
  const { t } = useSafety();
  const { outgoing, outgoingProblem, members, online, lastLocationAt } = useLiveSos();
  const now = useNow(Boolean(outgoing), 1_000);

  if (outgoingProblem) {
    return (
      <div className="m-live-status" role="status">
        <p className={outgoingProblem === "connecting" ? "" : "m-live-status-warn"}>
          {outgoingProblem === "connecting" ? <LoaderCircle className="spin" size={16} /> : <AlertTriangle size={16} />}
          {t(`live.status.${outgoingProblem}`)}
        </p>
      </div>
    );
  }
  if (!outgoing) return null;

  const state = sendState(outgoing, online);
  const people = recipientStatuses(outgoing, members);
  const age = lastLocationAt ? Math.max(0, Math.round((now - lastLocationAt) / 1_000)) : null;

  return (
    <div className="m-live-status" role="status" aria-live="polite">
      <p className={state === "queued" ? "m-live-status-warn" : ""}>
        {state === "sent" ? <Check size={16} /> : state === "queued" ? <WifiOff size={16} /> : <LoaderCircle className="spin" size={16} />}
        {t(`live.status.${state}`)}
      </p>
      {people.map((person) => {
        const Icon = ICONS[person.state];
        return (
          <p key={person.uid} className={person.state === "pushFailed" ? "m-live-status-warn" : ""}>
            <Icon size={16} className={person.state === "waiting" ? "spin" : undefined} />
            {t(`live.recipient.${person.state}`, { name: person.name.split(" ")[0] })}
          </p>
        );
      })}
      {age !== null && <p className="m-live-status-soft"><MapPin size={14} />{t("live.locationAge", { seconds: age })}</p>}
    </div>
  );
}
