import { AlertTriangle, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { unlockAudio } from "../audio";
import { vibrate } from "../native";

const HOLD_MS = 2_000;
const DOUBLE_TAP_MS = 380;

/**
 * The HELP bar. Hold for 2 seconds, or double-tap, to start the SOS
 * countdown; a single tap does nothing. The fill shows hold progress.
 */
export function SosButton({ label, hint, ariaLabel, disabled, onTrigger }: { label: string; hint: string; ariaLabel: string; disabled?: boolean; onTrigger: () => void }) {
  const [progress, setProgress] = useState(0);
  const holdStart = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const lastTap = useRef(0);

  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  const stopHold = () => {
    holdStart.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setProgress(0);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const step = (time: number) => {
      if (holdStart.current === null) return;
      const value = Math.min(1, (time - holdStart.current) / HOLD_MS);
      setProgress(value);
      if (value >= 1) {
        stopHold();
        onTrigger();
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    if (disabled) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    unlockAudio();
    const now = performance.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      stopHold();
      onTrigger();
      return;
    }
    lastTap.current = now;
    void vibrate("tap");
    holdStart.current = now;
    frame.current = requestAnimationFrame(step);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    // Keyboard and screen-reader users confirm with Enter or Space twice.
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastTap.current < DOUBLE_TAP_MS * 2) { lastTap.current = 0; onTrigger(); } else lastTap.current = now;
  };

  return (
    <div className="m-help-wrap">
      <button
        type="button"
        className={`m-help ${progress > 0 ? "holding" : ""}`}
        aria-label={`${ariaLabel}. ${hint}`}
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className="m-help-fill" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
        <span className="m-help-icon" aria-hidden="true"><AlertTriangle size={34} strokeWidth={2.4} fill="currentColor" stroke="var(--help-a)" /></span>
        <span className="m-help-divider" aria-hidden="true" />
        <strong className="m-help-label">{label}</strong>
        <ArrowRight className="m-help-arrow" size={24} aria-hidden="true" />
      </button>
      <p className="m-help-hint">{hint}</p>
    </div>
  );
}
