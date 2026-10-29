import { BellOff, BellRing, Copy, Link2, LoaderCircle, LogOut, Smartphone } from "lucide-react";
import { useState } from "react";
import { Field, TextInput } from "@/components/ui/Primitives";
import { useSafety } from "../state";
import { useLiveSos } from "./LiveSosProvider";

/**
 * Pairing for the live SOS, at the top of the Trusted group screen: create a
 * circle and show its invite code, or join one by typing a code.
 */
export function PairingCard() {
  const { t, settings, showToast } = useSafety();
  const { availability, uid, circle, members, phone, setPhone, pushStatus, pairing, pairingError, create, join, leave, online } = useLiveSos();
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");

  if (availability === "unconfigured") {
    return (
      <section className="card m-card m-stack m-live-card">
        <h3 className="m-card-title"><Smartphone size={20} />{t("live.title")}</h3>
        <p className="m-live-note">{t("live.notConfigured")}</p>
      </section>
    );
  }

  const others = members.filter((member) => member.uid !== uid);
  const copy = async () => {
    try { await navigator.clipboard.writeText(circle?.inviteCode ?? ""); showToast(t("live.copied")); } catch { /* Clipboard blocked; the code is on screen. */ }
  };
  const onJoin = async () => {
    if (await join(code)) { setJoining(false); setCode(""); showToast(t("live.joined")); }
  };

  return (
    <section className="card m-card m-stack m-live-card" aria-busy={pairing}>
      <div>
        <h3 className="m-card-title"><Smartphone size={20} />{t("live.title")}</h3>
        <p className="m-live-note">{t("live.subtitle")}</p>
      </div>

      {availability !== "ready" || !uid ? (
        <p className="m-live-note"><LoaderCircle className="spin" size={16} /> {online ? t("live.connecting") : t("live.offline")}</p>
      ) : circle ? (
        <>
          <div className="m-invite">
            <span className="field-label">{t("live.inviteTitle")}</span>
            <button type="button" className="m-invite-code" onClick={() => void copy()} aria-label={`${t("live.inviteTitle")} ${circle.inviteCode.split("").join(" ")}`}>
              {circle.inviteCode}<Copy size={18} aria-hidden="true" />
            </button>
            <small className="field-hint">{t("live.inviteHint")}</small>
          </div>
          <ul className="m-live-members" aria-label={t("live.members")}>
            {members.map((member) => (
              <li key={member.uid}>
                <strong>{member.name}{member.uid === uid ? ` (${t("live.you")})` : ""}</strong>
                {member.uid === uid
                  ? <PushBadge ready={pushStatus === "ready"} />
                  : <PushBadge ready={member.pushReady} />}
              </li>
            ))}
          </ul>
          {!others.length && <p className="m-live-note">{t("live.alone")}</p>}
          {pushStatus === "denied" && <p className="m-live-warn">{t("live.push.denied")}</p>}
          {pushStatus === "error" && <p className="m-live-warn">{t("live.push.error")}</p>}
          <Field label={t("live.phone")}>
            <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="+91" />
          </Field>
          <button type="button" className="button button-ghost button-sm" onClick={() => { void leave(); showToast(t("live.left")); }}><LogOut size={16} />{t("live.leave")}</button>
        </>
      ) : joining ? (
        <form className="m-stack" onSubmit={(event) => { event.preventDefault(); void onJoin(); }}>
          <Field label={t("live.codeLabel")}>
            <TextInput value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={8} placeholder="K7P2QM" className="input m-code-input" />
          </Field>
          <p className="m-live-note">{t("live.joinAs", { name: settings.userName || "?" })}</p>
          {pairingError && <p className="m-live-warn" role="alert">{t(`live.error.${pairingError}`)}</p>}
          <div className="m-form-actions">
            <button type="button" className="button button-ghost" onClick={() => setJoining(false)}>{t("common.cancel")}</button>
            <button type="submit" className="button button-primary" disabled={pairing || code.trim().length < 6}>{pairing && <LoaderCircle className="spin" size={16} />}{t("live.joinButton")}</button>
          </div>
        </form>
      ) : (
        <div className="m-stack">
          <p className="m-live-note">{t("live.joinAs", { name: settings.userName || "?" })}</p>
          {pairingError && <p className="m-live-warn" role="alert">{t(`live.error.${pairingError}`)}</p>}
          <button type="button" className="button button-primary m-block" disabled={pairing} onClick={() => void create()}>{pairing ? <LoaderCircle className="spin" size={18} /> : <Smartphone size={18} />}{t("live.create")}</button>
          <button type="button" className="button button-secondary m-block" disabled={pairing} onClick={() => setJoining(true)}><Link2 size={18} />{t("live.join")}</button>
        </div>
      )}
    </section>
  );
}

function PushBadge({ ready }: { ready: boolean }) {
  const { t } = useSafety();
  return <span className={`m-perm ${ready ? "m-perm-granted" : "m-perm-denied"}`}>{ready ? <BellRing size={13} /> : <BellOff size={13} />}{t(ready ? "live.pushOn" : "live.pushOff")}</span>;
}
