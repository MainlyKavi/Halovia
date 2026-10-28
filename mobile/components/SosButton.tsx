import { useEffect, useRef, useState } from "react";
import { unlockAudio } from "../audio";
import { vibrate } from "../native";

const HOLD_MS = 2_000;
const DOUBLE_TAP_MS = 380;
const RING = 2 * Math.PI * 92;

/** Hold for 2 seconds, or double-tap, to start the SOS countdown. A single tap does nothing. */
export function SosButton({ label, hint, ariaLabel, disabled, onTrigger }: { label: string; hint: string; ariaLabel: string; disabled?: boolean; onTrigger: () => void }) {
  const [progress, setProgress] = useState(0);
  const holdStart = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const lastTap = useRef(0);
  const fired = useRef(false);

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
        fired.current = true;
        stopHold();
        onTrigger();
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    if (disabled) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    unlockAudio();
    fired.current = false;
    const now = performance.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      fired.current = true;
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
    <div className="m-sos-wrap">
      <button
        type="button"
        className={`m-sos-button ${progress > 0 ? "holding" : ""}`}
        aria-label={`${ariaLabel}. ${hint}`}
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => event.preventDefault()}
      >
        <svg className="m-sos-ring" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="92" className="m-sos-ring-track" />
          <circle cx="100" cy="100" r="92" className="m-sos-ring-fill" style={{ strokeDasharray: RING, strokeDashoffset: RING * (1 - progress) }} />
        </svg>
        <span className="m-sos-core"><strong>{label}</strong></span>
      </button>
      <p className="m-sos-hint">{hint}</p>
    </div>
  );
}
