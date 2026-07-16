"use client";

import { useApp } from "@/components/app/AppProvider";
import { Button, Dialog } from "@/components/ui/Primitives";

export function EndJourneyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, completeJourney, showToast } = useApp();
  return <Dialog open={open} onClose={onClose} title={t("journeyEnd.title")} description={t("journeyEnd.description")}>
    <ul className="dialog-list"><li>{t("journeyEnd.stop")}</li><li>{t("journeyEnd.history")}</li><li>{t("journeyEnd.sharing")}</li><li>{t("journeyEnd.cancelCheck")}</li></ul>
    <div className="dialog-actions"><Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => { completeJourney("endedManually"); onClose(); showToast(t("active.endedToast")); }}>{t("journeyEnd.confirm")}</Button></div>
  </Dialog>;
}
