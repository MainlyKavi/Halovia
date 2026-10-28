import { Bell, LoaderCircle, MapPin } from "lucide-react";
import { useState } from "react";
import { requestLocationPermission, requestNotificationPermission } from "../native";
import { useSafety } from "../state";

/** Explains why each permission is needed before the system prompt appears. Denial never blocks the app. */
export function PermissionScreen() {
  const { t, updateSettings, setGpsEnabled, showToast } = useSafety();
  const [busy, setBusy] = useState(false);

  const allow = async () => {
    setBusy(true);
    const location = await requestLocationPermission();
    const notifications = await requestNotificationPermission();
    setBusy(false);
    if (location === "granted") setGpsEnabled(true);
    else showToast(t("perm.locationDenied"), "warning");
    if (notifications !== "granted" && location === "granted") showToast(t("perm.notifyDenied"), "warning");
    updateSettings({ onboarded: true });
  };

  return (
    <div className="m-screen m-permissions">
      <span className="logo-mark m-perm-logo" aria-hidden="true"><span className="logo-route" /><span className="logo-point" /></span>
      <h1>{t("perm.title")}</h1>
      <p>{t("perm.text")}</p>
      <ul className="m-perm-list">
        <li className="card"><span><MapPin size={20} /></span><div><strong>{t("perm.locationTitle")}</strong><small>{t("perm.locationText")}</small></div></li>
        <li className="card"><span><Bell size={20} /></span><div><strong>{t("perm.notifyTitle")}</strong><small>{t("perm.notifyText")}</small></div></li>
      </ul>
      <div className="m-perm-actions">
        <button type="button" className="button button-primary button-lg m-block" disabled={busy} onClick={() => void allow()}>{busy && <LoaderCircle className="spin" size={18} />}{t("perm.allow")}</button>
        <button type="button" className="button button-ghost m-block" onClick={() => updateSettings({ onboarded: true })}>{t("perm.skip")}</button>
      </div>
    </div>
  );
}
