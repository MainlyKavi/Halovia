import { Check } from "lucide-react";
import type { RideStringKey } from "@/lib/ride/strings";
import { openNativeSettings, type NativeSettingsPage } from "../native";
import { useSafety } from "../state";
import { useLiveSos } from "./LiveSosProvider";

/**
 * Android settings that decide whether an SOS alarm gets through in the
 * background: battery optimisation, full-screen alerts (Android 14+) and
 * "Allow all the time" location. Each row links to the exact settings page.
 */
export function AlertSetupRows() {
  const { t } = useSafety();
  const { native, refreshNative } = useLiveSos();
  if (!native) return null;

  const rows: Array<{ key: RideStringKey; text: RideStringKey; ok: boolean; page: NativeSettingsPage; show: boolean }> = [
    { key: "live.battery", text: "live.batteryText", ok: native.ignoringBatteryOptimizations, page: "battery", show: true },
    { key: "live.fullScreen", text: "live.fullScreenText", ok: native.canUseFullScreenIntent, page: "fullScreen", show: native.sdkInt >= 34 },
    { key: "live.bgLocation", text: "live.bgLocationText", ok: native.backgroundLocation, page: "app", show: native.sdkInt >= 29 },
  ];

  return (
    <div className="m-stack m-alert-setup">
      <h4 className="m-card-title">{t("live.setupTitle")}</h4>
      {rows.filter((row) => row.show).map((row) => (
        <div key={row.key} className="m-alert-setup-row">
          <div><strong>{t(row.key)}</strong><small>{t(row.text)}</small></div>
          {row.ok
            ? <span className="m-perm m-perm-granted"><Check size={13} />{t("settings.status.granted")}</span>
            : <button type="button" className="button button-secondary button-sm" onClick={() => { void openNativeSettings(row.page).then(refreshNative); }}>{t("live.fix")}</button>}
        </div>
      ))}
      <small className="field-hint">{t("live.oemHint")}</small>
    </div>
  );
}
