import { ArrowLeft, Play } from "lucide-react";
import type { RideStringKey } from "@/lib/ride/strings";
import { useSafety } from "../state";

interface Step { title: RideStringKey; text: RideStringKey; run: () => void; disabled?: boolean }

/** The guided walkthrough used in front of an audience. Each button performs its step. */
export function ScriptScreen() {
  const { t, navigate, session, members, settings, startSharing, simulateWrongTurn, triggerSos, resetDemo, showToast } = useSafety();
  const riding = Boolean(session.sharing && session.route);
  const viewer = members.find((member) => member.id === settings.contactViewerId) ?? members[0];
  const needsRide = () => showToast(t("script.needsRide"), "warning");

  const steps: Step[] = [
    { title: "script.step1", text: "script.step1Text", run: () => navigate("booked"), disabled: !session.ride },
    { title: "script.step2", text: "script.step2Text", run: () => { void startSharing(members.map((member) => member.id)).then(() => navigate("ride")); }, disabled: !session.ride || !members.length },
    { title: "script.step3", text: "script.step3Text", run: () => { if (!riding) return needsRide(); simulateWrongTurn(); navigate("ride"); } },
    { title: "script.step4", text: "script.step4Text", run: () => { triggerSos(); navigate("home"); }, disabled: session.sos.phase !== "idle" },
    { title: "script.step5", text: "script.step5Text", run: () => navigate("contact") },
    { title: "script.step6", text: "script.step6Text", run: resetDemo },
  ];

  return (
    <div className="m-screen m-script">
      <div className="m-topbar"><button type="button" className="icon-button" onClick={() => navigate("home")} aria-label={t("common.back")}><ArrowLeft size={20} /></button></div>
      <header className="m-page-head"><div><h1>{t("script.title")}</h1><p>{t("script.intro")}</p></div></header>
      <ol className="m-steps">
        {steps.map((step, index) => (
          <li key={step.title} className="card m-step">
            <span className="m-step-number">{index + 1}</span>
            <div><strong>{t(step.title)}</strong><small>{t(step.text, { name: viewer?.name.split(" ")[0] ?? "" })}</small></div>
            <button type="button" className="button button-secondary button-sm" disabled={step.disabled} onClick={step.run}><Play size={15} />{t("script.run")}</button>
          </li>
        ))}
      </ol>
    </div>
  );
}
