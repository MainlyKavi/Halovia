import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { appendTrail, type CircleMemberInfo, type LivePoint, type LiveSos } from "@/lib/ride/live-sos";
import { nativeStatus, onNativeResume, setAlertMode, vibrate, watchSosLocation, type GpsFix, type NativeStatus } from "../native";
import { useSafety } from "../state";
import { createCircle, joinCircle, leaveCircle, PairingError, saveFcmToken, updateMyMember, watchCircle, watchMyCircleId, type CircleInfo } from "./circle";
import { getCloud, watchUser, type Cloud } from "./firebase";
import { registerPush, type PushStatus } from "./push";
import { createSos, endSos, markReceipt, updateSosLocation, watchActiveSos, watchSos } from "./sos";

/**
 * Live SOS between paired phones. Sits inside SafetyProvider and follows its
 * SOS state: when the local SOS becomes active it is written to Firestore
 * (queued if offline) and the phone's location is streamed until it ends.
 * It also listens for SOS events from the rest of the circle.
 */

export type Availability = "checking" | "unconfigured" | "connecting" | "ready";
export type OutgoingProblem = "notConfigured" | "connecting" | "notPaired" | "alone" | "rejected";

interface LiveSosValue {
  availability: Availability;
  uid: string | null;
  online: boolean;
  native: NativeStatus | null;
  refreshNative: () => void;
  circle: CircleInfo | null;
  members: CircleMemberInfo[];
  phone: string;
  setPhone: (phone: string) => void;
  pushStatus: PushStatus;
  pairing: boolean;
  pairingError: PairingError["reason"] | null;
  create: () => Promise<boolean>;
  join: (code: string) => Promise<boolean>;
  leave: () => Promise<void>;
  outgoing: LiveSos | null;
  outgoingProblem: OutgoingProblem | null;
  lastLocationAt: number | null;
  incoming: LiveSos[];
  acknowledged: readonly string[];
  hidden: readonly string[];
  acknowledge: (sos: LiveSos) => void;
  end: (sos: LiveSos) => void;
  markSeen: (sos: LiveSos) => void;
  setHidden: (sos: LiveSos, hidden: boolean) => void;
}

const LiveSosContext = createContext<LiveSosValue | null>(null);

const PHONE_KEY = "halovia.live.phone.v1";
const OUTGOING_KEY = "halovia.live.outgoing.v1";
const LOCATION_EVERY_MS = 4_000;
const LOCATION_HEARTBEAT_MS = 15_000;

interface OutgoingRecord { alertId: string; circleId: string; sosId: string }

function readJson<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") as T | null; } catch { return null; }
}
function writeJson(key: string, value: unknown): void {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage blocked: keep going in memory. */ }
}

export function LiveSosProvider({ children }: { children: React.ReactNode }) {
  const { role, settings, session, cab, location, gps, stopSos, showToast, t } = useSafety();
  const enabled = role === "rider";

  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [availability, setAvailability] = useState<Availability>("checking");
  const [uid, setUid] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  const [native, setNative] = useState<NativeStatus | null>(null);
  const [circleId, setCircleId] = useState<string | null>(null);
  // Tagged with the circle they came from, so leaving or switching circles
  // never shows the old circle's data.
  const [circleState, setCircleState] = useState<{ id: string; circle: CircleInfo | null; members: CircleMemberInfo[] } | null>(null);
  const [phone, setPhoneState] = useState(() => readJson<string>(PHONE_KEY) ?? "");
  const [pushStatus, setPushStatus] = useState<PushStatus>("unsupported");
  const [pairing, setPairing] = useState(false);
  const [pairingError, setPairingError] = useState<PairingError["reason"] | null>(null);
  const [outgoingRecord, setOutgoingRecord] = useState<OutgoingRecord | null>(() => readJson<OutgoingRecord>(OUTGOING_KEY));
  const [outgoing, setOutgoing] = useState<LiveSos | null>(null);
  const [rejectedSosId, setRejectedSosId] = useState<string | null>(null);
  const [lastLocationAt, setLastLocationAt] = useState<number | null>(null);
  const [incomingState, setIncomingState] = useState<{ key: string; list: LiveSos[] }>({ key: "", list: [] });
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [hidden, setHiddenIds] = useState<string[]>([]);

  const db = cloud?.db ?? null;
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);
  const setPhone = useCallback((value: string) => { setPhoneState(value); writeJson(PHONE_KEY, value); }, []);

  // --- Firebase, sign-in, connectivity, native status -----------------------
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void getCloud().then((value) => {
      if (cancelled) return;
      setCloud(value);
      setAvailability(value ? "connecting" : "unconfigured");
    });
    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    if (!cloud) return;
    return watchUser(cloud.auth, (user) => {
      setUid(user?.uid ?? null);
      setAvailability(user ? "ready" : "connecting");
    });
  }, [cloud]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const refreshNative = useCallback(() => { void nativeStatus().then(setNative); }, []);
  useEffect(() => {
    if (!enabled) return;
    refreshNative();
    const onVisible = () => { if (document.visibilityState === "visible") refreshNative(); };
    document.addEventListener("visibilitychange", onVisible);
    const stopResume = onNativeResume(refreshNative);
    return () => { document.removeEventListener("visibilitychange", onVisible); stopResume(); };
  }, [enabled, refreshNative]);

  // --- Circle --------------------------------------------------------------
  useEffect(() => {
    if (!db || !uid) return;
    return watchMyCircleId(db, uid, setCircleId);
  }, [db, uid]);

  useEffect(() => {
    if (!db || !circleId) return;
    return watchCircle(
      db,
      circleId,
      (value) => setCircleState((current) => ({ id: circleId, members: current?.id === circleId ? current.members : [], circle: value })),
      (list) => setCircleState((current) => ({ id: circleId, circle: current?.id === circleId ? current.circle : null, members: list })),
    );
  }, [circleId, db]);
  const circle = circleState && circleState.id === circleId ? circleState.circle : null;
  const members = useMemo(() => (circleState && circleState.id === circleId ? circleState.members : []), [circleId, circleState]);

  // --- Push registration ---------------------------------------------------
  const uidRef = useRef(uid);
  useEffect(() => { uidRef.current = uid; }, [uid]);
  useEffect(() => {
    // After onboarding, so Android's notification prompt never covers it.
    if (!db || !uid || !native?.firebaseConfigured || !settings.onboarded) return;
    return registerPush({
      onStatus: setPushStatus,
      onToken: (token) => { void saveFcmToken(db, uid, token).catch(() => undefined); },
      // The app is open: record delivery straight away (the native service
      // also reports it, so either path is enough).
      onMessage: (data) => {
        if (data.type === "sos" && data.circleId && data.sosId && data.recipientUid === uidRef.current) markReceipt(db, data.circleId, data.sosId, uid, "deliveredTo", "");
      },
    });
  }, [db, native?.firebaseConfigured, settings.onboarded, uid]);

  // Keep the name, phone and push flag the circle sees current.
  const me = members.find((member) => member.uid === uid);
  const pushReady = pushStatus === "ready";
  useEffect(() => {
    if (!db || !uid || !circleId || !me) return;
    if (me.name === (settings.userName.trim() || me.name) && (me.phone ?? "") === phone.trim() && me.pushReady === pushReady) return;
    const timer = window.setTimeout(() => { void updateMyMember(db, uid, circleId, { name: settings.userName, phone, pushReady }).catch(() => undefined); }, 800);
    return () => window.clearTimeout(timer);
  }, [circleId, db, me, phone, pushReady, settings.userName, uid]);

  const profile = useCallback(() => ({ name: settings.userName, phone, pushReady }), [phone, pushReady, settings.userName]);

  const runPairing = useCallback(async (action: () => Promise<string>) => {
    setPairing(true);
    setPairingError(null);
    try {
      setCircleId(await action());
      return true;
    } catch (error) {
      setPairingError(error instanceof PairingError ? error.reason : "network");
      return false;
    } finally {
      setPairing(false);
    }
  }, []);
  const create = useCallback(() => (db && uid ? runPairing(() => createCircle(db, uid, profile(), circleId)) : Promise.resolve(false)), [circleId, db, profile, runPairing, uid]);
  const join = useCallback((code: string) => (db && uid ? runPairing(() => joinCircle(db, uid, code, profile(), circleId)) : Promise.resolve(false)), [circleId, db, profile, runPairing, uid]);
  const leave = useCallback(async () => {
    if (!db || !uid || !circleId) return;
    await leaveCircle(db, uid, circleId);
    setCircleId(null);
  }, [circleId, db, uid]);

  // --- Outgoing SOS --------------------------------------------------------
  // Where "I am" for the SOS: in demo mode with a simulated ride that is the
  // cab (as everywhere else in the app); otherwise the freshest real GPS fix.
  // Outside demo mode nothing but a real fix is ever sent.
  const sosFix = useRef<GpsFix | null>(null);
  const placeRef = useRef<{ demo: boolean; cab: LivePoint | null; gps: GpsFix | null; fallback: LivePoint }>({ demo: true, cab: null, gps: null, fallback: { ...location, accuracy: null, at: 0 } });
  useEffect(() => {
    placeRef.current = {
      demo: settings.demoMode,
      cab: cab && session.sharing ? { ...cab.point, accuracy: null, at: Date.now() } : null,
      gps,
      fallback: { ...location, accuracy: null, at: Date.now() },
    };
  }, [cab, gps, location, session.sharing, settings.demoMode]);
  const currentPoint = useCallback((): LivePoint | null => {
    const { demo, cab: cabPoint, gps: gpsFix, fallback } = placeRef.current;
    const fix = [sosFix.current, gpsFix].filter((item): item is GpsFix => Boolean(item && Date.now() - item.at < 120_000)).sort((a, b) => b.at - a.at)[0];
    if (demo && cabPoint) return { ...cabPoint, at: Date.now() };
    if (fix) return { ...fix.point, accuracy: fix.accuracy, at: fix.at };
    return demo ? { ...fallback, at: Date.now() } : null;
  }, []);

  const sosPhase = session.sos.phase;
  const sosAlertId = session.sos.phase === "active" ? session.sos.alertId : null;
  const outgoingRef = useRef(outgoing);
  useEffect(() => { outgoingRef.current = outgoing; }, [outgoing]);

  // The ref (mirrored in localStorage) is the source of truth, so a re-run
  // of this effect can never create the same SOS twice; state follows it.
  const recordRef = useRef(outgoingRecord);
  useEffect(() => {
    if (!enabled) return;
    const record = recordRef.current;
    if (sosAlertId) {
      if (record?.alertId === sosAlertId || !db || !uid || !circleId) return;
      // Left over from an SOS this phone never got to end (app killed).
      if (record) endSos(db, record.circleId, record.sosId, uid);
      const sosId = createSos(db, circleId, { senderUid: uid, senderName: settings.userName, senderPhone: phone, demo: settings.demoMode, location: currentPoint() }, () => setRejectedSosId(sosId));
      const next = { alertId: sosAlertId, circleId, sosId };
      recordRef.current = next;
      writeJson(OUTGOING_KEY, next);
      queueMicrotask(() => setOutgoingRecord(next));
      return;
    }
    if (sosPhase === "idle" && record) {
      if (db && uid && outgoingRef.current?.status !== "ended") endSos(db, record.circleId, record.sosId, uid);
      recordRef.current = null;
      writeJson(OUTGOING_KEY, null);
      queueMicrotask(() => { setOutgoingRecord(null); setOutgoing(null); setLastLocationAt(null); });
    }
  }, [circleId, currentPoint, db, enabled, outgoingRecord, phone, settings.demoMode, settings.userName, sosAlertId, sosPhase, uid]);

  useEffect(() => {
    if (!db || !outgoingRecord) return;
    return watchSos(db, outgoingRecord.circleId, outgoingRecord.sosId, setOutgoing);
  }, [db, outgoingRecord]);

  // The other phone ended this SOS: stop it here too.
  const endedHandled = useRef<string | null>(null);
  useEffect(() => {
    if (!outgoing || outgoing.status !== "ended" || !outgoing.endedBy || outgoing.endedBy === uid || endedHandled.current === outgoing.id) return;
    endedHandled.current = outgoing.id;
    const name = members.find((member) => member.uid === outgoing.endedBy)?.name ?? "";
    stopSos();
    showToast(tRef.current("live.endedBy", { name: name.split(" ")[0] || "?" }));
  }, [members, outgoing, showToast, stopSos, uid]);

  // Stream location every few seconds while the SOS is active. The native
  // watcher keeps running with the screen locked (foreground service).
  const trailRef = useRef<LivePoint[]>([]);
  const lastWrite = useRef<{ at: number; point: LivePoint | null }>({ at: 0, point: null });
  useEffect(() => {
    if (!db || !outgoingRecord || sosPhase !== "active") return;
    trailRef.current = [];
    lastWrite.current = { at: 0, point: null };
    const { circleId: cid, sosId } = outgoingRecord;
    const maybeWrite = () => {
      const now = Date.now();
      const point = currentPoint();
      const last = lastWrite.current;
      if (!point || now - last.at < LOCATION_EVERY_MS - 300) return;
      const moved = !last.point || last.point.lat !== point.lat || last.point.lng !== point.lng;
      if (!moved && now - last.at < LOCATION_HEARTBEAT_MS) return;
      // The point keeps its fix time, so the other phone's "updated Ns ago"
      // shows a stalled GPS honestly instead of the time of the write.
      trailRef.current = appendTrail(trailRef.current, point);
      lastWrite.current = { at: now, point };
      updateSosLocation(db, cid, sosId, point, trailRef.current);
      setLastLocationAt(now);
    };
    const stopWatch = watchSosLocation(
      { title: tRef.current("live.bgTitle"), message: tRef.current("live.bgMessage") },
      (fix) => { sosFix.current = fix; maybeWrite(); },
      () => undefined,
    );
    const timer = window.setInterval(maybeWrite, 1_000);
    maybeWrite();
    return () => { stopWatch(); window.clearInterval(timer); sosFix.current = null; };
  }, [currentPoint, db, outgoingRecord, sosPhase]);

  const outgoingProblem: OutgoingProblem | null = sosPhase !== "active" ? null
    : availability === "unconfigured" ? "notConfigured"
    : rejectedSosId && rejectedSosId === outgoingRecord?.sosId ? "rejected"
    : outgoingRecord ? null
    : availability !== "ready" ? "connecting"
    : !circleId ? "notPaired"
    : members.filter((member) => member.uid !== uid).length === 0 ? "alone"
    : "connecting";

  // --- Incoming SOS from the rest of the circle -----------------------------
  const incomingKey = db && circleId && uid ? `${circleId}/${uid}` : "";
  useEffect(() => {
    if (!db || !circleId || !uid) return;
    const key = `${circleId}/${uid}`;
    return watchActiveSos(db, circleId, (list) => setIncomingState({ key, list: list.filter((sos) => sos.senderUid !== uid) }));
  }, [circleId, db, uid]);
  const incoming = useMemo(() => (incomingKey && incomingState.key === incomingKey ? incomingState.list : []), [incomingKey, incomingState]);

  const known = useRef(new Map<string, string>());
  useEffect(() => {
    if (!db || !uid) return;
    const current = new Map(incoming.map((sos) => [sos.id, sos.senderName]));
    for (const sos of incoming) {
      if (known.current.has(sos.id)) continue;
      if (!sos.deliveredTo[uid]) markReceipt(db, sos.circleId, sos.id, uid, "deliveredTo", "");
      void vibrate("sos");
      void setAlertMode(true);
    }
    for (const [id, name] of known.current) {
      if (current.has(id)) continue;
      showToast(tRef.current("live.alert.ended", { name: name.split(" ")[0] }));
      setAcknowledged((ids) => ids.filter((item) => item !== id));
      setHiddenIds((ids) => ids.filter((item) => item !== id));
    }
    if (!incoming.length && known.current.size) void setAlertMode(false);
    known.current = current;
  }, [db, incoming, showToast, uid]);

  const seen = useRef(new Set<string>());
  const markSeen = useCallback((sos: LiveSos) => {
    if (!db || !uid || seen.current.has(sos.id) || sos.seenBy[uid]) return;
    seen.current.add(sos.id);
    markReceipt(db, sos.circleId, sos.id, uid, "seenBy", settings.userName);
  }, [db, settings.userName, uid]);
  const acknowledge = useCallback((sos: LiveSos) => {
    if (!db || !uid) return;
    markReceipt(db, sos.circleId, sos.id, uid, "ackBy", settings.userName);
    setAcknowledged((ids) => (ids.includes(sos.id) ? ids : [...ids, sos.id]));
    void setAlertMode(false);
  }, [db, settings.userName, uid]);
  const end = useCallback((sos: LiveSos) => { if (db && uid) endSos(db, sos.circleId, sos.id, uid); }, [db, uid]);
  const setHidden = useCallback((sos: LiveSos, hide: boolean) => setHiddenIds((ids) => (hide ? [...new Set([...ids, sos.id])] : ids.filter((id) => id !== sos.id))), []);

  const value = useMemo<LiveSosValue>(() => ({
    availability, uid, online, native, refreshNative, circle, members, phone, setPhone, pushStatus, pairing, pairingError, create, join, leave,
    outgoing, outgoingProblem, lastLocationAt, incoming, acknowledged, hidden, acknowledge, end, markSeen, setHidden,
  }), [acknowledge, acknowledged, availability, circle, create, end, hidden, incoming, join, lastLocationAt, leave, markSeen, members, native, online, outgoing,
    outgoingProblem, pairing, pairingError, phone, pushStatus, refreshNative, setHidden, setPhone, uid]);

  return <LiveSosContext.Provider value={value}>{children}</LiveSosContext.Provider>;
}

export function useLiveSos(): LiveSosValue {
  const context = useContext(LiveSosContext);
  if (!context) throw new Error("useLiveSos must be used inside LiveSosProvider");
  return context;
}
