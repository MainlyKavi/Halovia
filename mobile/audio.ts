// Siren and alert tones generated with the Web Audio API, so the APK needs
// no audio files. Browsers only allow sound after a user gesture, so
// `unlockAudio()` is called from the first pointer event.

type SoundKind = "siren" | "alarm" | "chime";

let context: AudioContext | null = null;
let stopCurrent: (() => void) | null = null;
let currentKind: SoundKind | null = null;

function getContext(): AudioContext | null {
  if (context) return context;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try { context = new Ctor(); } catch { context = null; }
  return context;
}

export function unlockAudio(): void {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => undefined);
}

export function audioUnlocked(): boolean {
  return context?.state === "running";
}

export function stopSound(): void {
  stopCurrent?.();
  stopCurrent = null;
  currentKind = null;
}

export function playingSound(): SoundKind | null {
  return currentKind;
}

/**
 * siren: rising and falling wail for the user's own SOS.
 * alarm: fast two-tone alarm for a trusted contact receiving an SOS.
 * chime: short three-beep warning for a route deviation (plays once).
 */
export function playSound(kind: SoundKind): void {
  const ctx = getContext();
  if (!ctx) return;
  if (currentKind === kind && kind !== "chime") return;
  stopSound();
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);

  const master = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  master.gain.value = kind === "chime" ? 0.5 : 0.9;
  master.connect(compressor).connect(ctx.destination);

  const oscillators: OscillatorNode[] = [];
  const timers: number[] = [];
  const now = ctx.currentTime;

  if (kind === "chime") {
    [0, 0.22, 0.44].forEach((offset, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = index === 2 ? 1_180 : 880;
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(1, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
      osc.connect(gain).connect(master);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
      oscillators.push(osc);
    });
    timers.push(window.setTimeout(() => { if (currentKind === "chime") stopSound(); }, 900));
  } else {
    const osc = ctx.createOscillator();
    const second = ctx.createOscillator();
    osc.type = "sawtooth";
    second.type = "square";
    second.detune.value = 8;
    const blend = ctx.createGain();
    blend.gain.value = 0.35;
    osc.connect(master);
    second.connect(blend).connect(master);
    const schedule = (start: number) => {
      // Schedule ~4 s ahead and top up, so long sirens keep going.
      for (let t = 0; t < 4; t += kind === "siren" ? 1 : 0.5) {
        const at = start + t;
        if (kind === "siren") {
          osc.frequency.setValueAtTime(650, at);
          osc.frequency.linearRampToValueAtTime(1_450, at + 0.5);
          osc.frequency.linearRampToValueAtTime(650, at + 1);
        } else {
          osc.frequency.setValueAtTime(960, at);
          osc.frequency.setValueAtTime(770, at + 0.25);
        }
      }
      second.frequency.cancelScheduledValues(start);
      second.frequency.setValueAtTime(kind === "siren" ? 325 : 480, start);
    };
    schedule(now);
    let next = now + 4;
    timers.push(window.setInterval(() => { if (ctx.currentTime > next - 1.5) { schedule(next); next += 4; } }, 500));
    osc.start(now);
    second.start(now);
    oscillators.push(osc, second);
  }

  currentKind = kind;
  stopCurrent = () => {
    timers.forEach((timer) => { window.clearInterval(timer); window.clearTimeout(timer); });
    const at = ctx.currentTime;
    master.gain.cancelScheduledValues(at);
    master.gain.setValueAtTime(master.gain.value, at);
    master.gain.linearRampToValueAtTime(0, at + 0.08);
    oscillators.forEach((osc) => { try { osc.stop(at + 0.1); } catch { /* Already stopped. */ } });
    window.setTimeout(() => { try { master.disconnect(); compressor.disconnect(); } catch { /* Already disconnected. */ } }, 200);
  };
}
