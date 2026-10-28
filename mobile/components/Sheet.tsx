import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export function Sheet({ open, title, onClose, closeLabel, children }: { open: boolean; title: string; onClose: () => void; closeLabel: string; children: React.ReactNode }) {
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    queueMicrotask(() => panel.current?.querySelector<HTMLElement>("[data-autofocus], button, input")?.focus());
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("dialog-open");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("dialog-open"); previous?.focus(); };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="m-sheet-backdrop" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panel} className="m-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="m-sheet-grip" aria-hidden="true" />
        <header className="m-sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={closeLabel}><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
