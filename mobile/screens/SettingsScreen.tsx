import { CarTaxiFront, Check, ChevronRight, Eye, Info, ListChecks, RotateCcw, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Field, TextInput, Toggle } from "@/components/ui/Primitives";
import { RIDE_LANGUAGES } from "@/lib/ride/strings";
import { DEFAULT_DEVIATION_CONFIG } from "@/lib/ride/deviation";
import { checkLocationPermission, checkNotificationPermission, requestLocationPermission, requestNotificationPermission, type PermissionState } from "../native";
import { DEVIATION_OPTIONS, useSafety, type Speed, type Theme } from "../state";

export function SettingsScreen() {
  const { t, settings, updateSettings, resetDemo, showToast, setGpsEnabled, navigate } = useSafety();
  const [location, setLocation] = useState<PermissionState>("prompt");
  const [notifications, setNotifications] = useState<PermissionState>("prompt");
  useEffect(() => {
    void checkLocationPermission().then(setLocation);
    void checkNotificationPermission().then(setNotifications);
  }, []);

  const themes: Theme[] = ["pink", "light", "dark"];
  const speeds: Speed[] = ["realistic", "fast", "veryFast"];

  return (
    <div className="m-screen m-settings">
      <header className="m-page-head"><div><h1>{t("settings.title")}</h1></div></header>

      <button type="button" className="card m-card m-settings-link" onClick={() => navigate("rapido")}>
        <span className="m-settings-link-icon" aria-hidden="true"><CarTaxiFront size={22} /></span>
        <span><strong>{t("rapido.entry")}</strong><small>{t("rapido.entryText")}</small></span>
        <ChevronRight size={20} />
      </button>

      <section className="card m-card m-stack">
        <Field label={t("settings.yourName")}>
          <TextInput value={settings.userName} onChange={(event) => updateSettings({ userName: event.target.value })} autoComplete="given-name" />
        </Field>
        <div className="m-setting">
          <span className="field-label">{t("settings.theme")}</span>
          <div className="m-segmented">{themes.map((theme) => <button key={theme} type="button" className={settings.theme === theme ? "on" : ""} aria-pressed={settings.theme === theme} onClick={() => updateSettings({ theme })}>{t(`theme.${theme}`)}</button>)}</div>
        </div>
        <div className="m-setting">
          <span className="field-label">{t("settings.language")}</span>
          <div className="m-segmented">{RIDE_LANGUAGES.map(({ value, nativeLabel }) => <button key={value} type="button" lang={value} className={settings.language === value ? "on" : ""} aria-pressed={settings.language === value} onClick={() => updateSettings({ language: value })}>{nativeLabel}</button>)}</div>
        </div>
      </section>

      <section className="card m-card m-stack">
        <Toggle checked={settings.demoMode} onChange={(demoMode) => updateSettings({ demoMode })} label={t("settings.demoMode")} description={t("settings.demoModeText")} />
        <div className="m-sim-label"><ShieldAlert size={18} /><div><strong>{t("sos.demoLabel")}</strong><p>{t("settings.sosSimulatedText")}</p></div></div>
        {settings.demoMode && (
          <div className="m-demo-links">
            <button type="button" className="button button-secondary m-block" onClick={() => navigate("contact")}><Eye size={18} />{t("demo.contactView")}</button>
            <button type="button" className="button button-ghost m-block" onClick={() => navigate("script")}><ListChecks size={18} />{t("home.demoScript")}</button>
            <small className="field-hint">{t("dev.hint")}</small>
          </div>
        )}
        <div className="m-setting">
          <span className="field-label">{t("settings.deviation")}</span>
          <div className="m-segmented">{DEVIATION_OPTIONS.map((metres) => <button key={metres} type="button" className={settings.deviationMetres === metres ? "on" : ""} aria-pressed={settings.deviationMetres === metres} onClick={() => updateSettings({ deviationMetres: metres })}>{metres} m</button>)}</div>
          <small className="field-hint">{t("settings.deviationText", { seconds: DEFAULT_DEVIATION_CONFIG.graceMs / 1_000 })}</small>
        </div>
        {settings.demoMode && (
          <div className="m-setting">
            <span className="field-label">{t("settings.speed")}</span>
            <div className="m-segmented">{speeds.map((speed) => <button key={speed} type="button" className={settings.speed === speed ? "on" : ""} aria-pressed={settings.speed === speed} onClick={() => updateSettings({ speed })}>{t(`settings.speed.${speed}`)}</button>)}</div>
          </div>
        )}
      </section>

      <section className="card m-card m-stack">
        <h3 className="m-card-title">{t("settings.permissions")}</h3>
        <PermissionRow label={t("settings.location")} state={location} onAsk={async () => { const next = await requestLocationPermission(); setLocation(next); if (next === "granted") setGpsEnabled(true); }} />
        <PermissionRow label={t("settings.notifications")} state={notifications} onAsk={async () => setNotifications(await requestNotificationPermission())} />
      </section>

      <section className="card m-card m-stack">
        <div className="m-reset">
          <div><strong>{t("settings.reset")}</strong><small>{t("settings.resetText")}</small></div>
          <button type="button" className="button button-secondary button-sm" onClick={() => { resetDemo(); showToast(t("settings.resetDone")); }}><RotateCcw size={16} />{t("settings.reset")}</button>
        </div>
      </section>
      <p className="m-fineprint"><Info size={14} />{t("settings.about")}</p>
    </div>
  );
}

function PermissionRow({ label, state, onAsk }: { label: string; state: PermissionState; onAsk: () => void }) {
  const { t } = useSafety();
  return (
    <div className="m-permission-row">
      <span>{label}</span>
      <span className={`m-perm m-perm-${state}`}>{state === "granted" && <Check size={13} />}{t(`settings.status.${state}`)}</span>
      {state !== "granted" && state !== "unavailable" && <button type="button" className="button button-ghost button-sm" onClick={onAsk}>{t("settings.ask")}</button>}
    </div>
  );
}
