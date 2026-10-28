import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { buildDeviationAlert, buildSosAlert, formatDistance, type SafetyAlert } from "@/lib/ride/alerts";
import { DEFAULT_DEVIATION_CONFIG, evaluateDeviation, INITIAL_DEVIATION_STATE, type DeviationState } from "@/lib/ride/deviation";
import { haversineMetres, type LatLng } from "@/lib/ride/geo";
import { DEMO_MEMBERS, reconcileSelection, removeMember, upsertMember, type GroupMember } from "@/lib/ride/group";
import { FALLBACK_SAFETY_PLACES, fetchSafetyPlaces, nearestSafetyPlaces, type NearestSafetyPlaces, type SafetyPlacesResult } from "@/lib/ride/places";
import { DEMO_PICKUP, MockRideProvider, type RideBrand, type RideDetails, type RideProvider } from "@/lib/ride/ride-provider";
import { FALLBACK_PLANNED_ROUTE, fetchPlannedRoute, type PlannedRoute } from "@/lib/ride/route";
import { advanceSimulation, cabPosition, INITIAL_SIMULATION, remainingMetres, startWrongTurn, type CabPosition, type CabSimulation } from "@/lib/ride/simulation";
import { translateRide, type RideLanguage, type RideStringKey } from "@/lib/ride/strings";
import { checkLocationPermission, notify, styleStatusBar, vibrate, watchGps, type GpsFix } from "./native";
import { publishSnapshot, readSnapshot, subscribeSnapshot, clearSnapshot, type SharedSnapshot } from "./sync";

export type Theme = "pink" | "light" | "dark";
export type Speed = "realistic" | "fast" | "veryFast";
export type Screen = "home" | "ride" | "group" | "settings" | "booked" | "script" | "contact";

/** Simulated cab speed in metres per second. "Realistic" is ~40 km/h city traffic. */
export const SPEEDS: Record<Speed, number> = { realistic: 11, fast: 45, veryFast: 110 };
export const SOS_COUNTDOWN_MS = 5_000;
export const DEVIATION_OPTIONS = [150, 300, 500] as const;

export interface Settings {
  version: 1;
  userName: string;
  theme: Theme;
  language: RideLanguage;
  demoMode: boolean;
  deviationMetres: number;
  speed: Speed;
  brand: RideBrand;
  onboarded: boolean;
  /** Which trusted member the demo contact view pretends to be. */
  contactViewerId: string | null;
}

export type SosState =
  | { phase: "idle" }
  | { phase: "countdown"; endsAt: number }
  | { phase: "active"; alertId: string; startedAt: number; silenced: boolean };

export interface Session {
  version: 1;
  ride: RideDetails | null;
  sharing: { recipientIds: string[]; startedAt: number } | null;
  route: PlannedRoute | null;
  simulation: CabSimulation;
  deviation: DeviationState;
  alerts: SafetyAlert[];
  sos: SosState;
  arrivedAt: number | null;
  /** Deviation alert the rider has not dismissed yet. */
  riderDeviationAlertId: string | null;
  /** Alerts the demo contact has acknowledged. */
  contactAcks: string[];
  updatedAt: number;
}

const SETTINGS_KEY = "halovia.ride.settings.v1";
const MEMBERS_KEY = "halovia.ride.members.v1";
const SESSION_KEY = "halovia.ride.session.v1";

function providerFor(brand: RideBrand): RideProvider {
  return new MockRideProvider(brand);
}

const defaultSettings = (): Settings => ({
  version: 1, userName: "Ananya", theme: "pink", language: "en", demoMode: true,
  deviationMetres: DEFAULT_DEVIATION_CONFIG.thresholdMetres, speed: "fast", brand: "rapido", onboarded: false, contactViewerId: DEMO_MEMBERS[1].id,
});

const emptySession = (ride: RideDetails | null): Session => ({
  version: 1, ride, sharing: null, route: null, simulation: INITIAL_SIMULATION, deviation: INITIAL_DEVIATION_STATE,
  alerts: [], sos: { phase: "idle" }, arrivedAt: null, riderDeviationAlertId: null, contactAcks: [], updatedAt: Date.now(),
});

function read<T>(key: string, valid: (value: unknown) => value is T): T | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return valid(value) ? value : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage blocked or full: keep running in memory. */ }
}

const isVersioned = (value: unknown): value is { version: 1 } => Boolean(value) && typeof value === "object" && (value as { version?: unknown }).version === 1;
const isSettings = (value: unknown): value is Settings => isVersioned(value) && typeof (value as Settings).userName === "string";
const isSession = (value: unknown): value is Session => isVersioned(value) && Array.isArray((value as Session).alerts) && typeof (value as Session).sos === "object";
const isMembers = (value: unknown): value is GroupMember[] => Array.isArray(value) && value.every((item) => item && typeof item.id === "string" && typeof item.name === "string");

/** The cab has the user in it, so in demo mode its simulated position is "where the user is". */
function currentLocation(session: Session, demoMode: boolean, gps: GpsFix | null): LatLng {
  const cab = session.sharing && session.route ? cabPosition(session.route.points, session.simulation).point : null;
  const freshGps = gps && Date.now() - gps.at < 120_000 ? gps.point : null;
  if (demoMode) return cab ?? freshGps ?? session.ride?.pickup.location ?? DEMO_PICKUP.location;
  return freshGps ?? cab ?? session.ride?.pickup.location ?? DEMO_PICKUP.location;
}

let alertCounter = 0;
const alertId = (kind: string) => `${kind}-${Date.now().toString(36)}-${(alertCounter += 1)}`;

export type GpsStatus = "idle" | "watching" | "denied" | "unavailable";

interface ToastMessage { id: number; text: string; tone: "calm" | "warning" }

interface SafetyContextValue {
  role: "rider" | "contact";
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  members: GroupMember[];
  saveMember: (member: GroupMember) => void;
  deleteMember: (id: string) => void;
  t: (key: RideStringKey, values?: Record<string, string | number>) => string;
  locale: string;
  screen: Screen;
  navigate: (screen: Screen) => void;
  shareSheetOpen: boolean;
  setShareSheetOpen: (open: boolean) => void;
  session: Session;
  cab: CabPosition | null;
  remaining: number;
  etaMinutes: number;
  location: LatLng;
  gps: GpsFix | null;
  gpsStatus: GpsStatus;
  setGpsEnabled: (enabled: boolean) => void;
  places: SafetyPlacesResult | null;
  nearest: NearestSafetyPlaces;
  snapshot: SharedSnapshot | null;
  changeBrand: (brand: RideBrand) => void;
  startSharing: (recipientIds: string[]) => Promise<void>;
  endRide: () => void;
  simulateWrongTurn: () => void;
  triggerSos: () => void;
  cancelSos: () => void;
  stopSos: () => void;
  silenceSiren: () => void;
  dismissDeviation: () => void;
  acknowledgeAlert: (id: string) => void;
  resetDemo: () => void;
  toast: ToastMessage | null;
  showToast: (text: string, tone?: "calm" | "warning") => void;
}

const SafetyContext = createContext<SafetyContextValue | null>(null);

export function SafetyProvider({ role, children }: { role: "rider" | "contact"; children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...defaultSettings(), ...read(SETTINGS_KEY, isSettings) }));
  const [members, setMembers] = useState<GroupMember[]>(() => read(MEMBERS_KEY, isMembers) ?? DEMO_MEMBERS);
  const [session, setSession] = useState<Session>(() => read(SESSION_KEY, isSession) ?? emptySession(null));
  const sessionRef = useRef(session);
  const [screen, setScreen] = useState<Screen>(role === "contact" ? "contact" : "home");
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [places, setPlaces] = useState<SafetyPlacesResult | null>(null);
  const placesCenter = useRef<LatLng | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [remoteSnapshot, setRemoteSnapshot] = useState<SharedSnapshot | null>(() => (role === "contact" ? readSnapshot() : null));

  const settingsRef = useRef(settings);
  const membersRef = useRef(members);
  const gpsRef = useRef(gps);
  const placesRef = useRef(places);
  useEffect(() => { settingsRef.current = settings; write(SETTINGS_KEY, settings); }, [settings]);
  useEffect(() => { membersRef.current = members; write(MEMBERS_KEY, members); }, [members]);
  useEffect(() => { gpsRef.current = gps; }, [gps]);
  useEffect(() => { placesRef.current = places; }, [places]);

  /** Every session change goes through here so timers never act on stale state. */
  const mutate = useCallback((update: (current: Session) => Session) => {
    const updated = update(sessionRef.current);
    if (updated === sessionRef.current) return updated;
    const next = { ...updated, updatedAt: Date.now() };
    sessionRef.current = next;
    setSession(next);
    return next;
  }, []);

  useEffect(() => { if (role === "rider") write(SESSION_KEY, session); }, [role, session]);

  const t = useCallback((key: RideStringKey, values?: Record<string, string | number>) => translateRide(settings.language, key, values), [settings.language]);
  const locale = settings.language === "hi" ? "hi-IN" : settings.language === "es" ? "es-ES" : "en-IN";
  const showToast = useCallback((text: string, tone: "calm" | "warning" = "calm") => setToast({ id: Date.now(), text, tone }), []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3_600); return () => window.clearTimeout(timer); }, [toast]);

  // Theme, language and the Android status bar follow settings and SOS state.
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.language;
    const sos = session.sos.phase === "active" && screen !== "contact";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", sos ? "#c81e3a" : settings.theme === "dark" ? "#17171c" : settings.theme === "light" ? "#f7f6f2" : "#fff7f8");
    void styleStatusBar(settings.theme, sos);
  }, [screen, session.sos.phase, settings.language, settings.theme]);

  // Seed a booked ride on first launch so the demo opens "full".
  useEffect(() => {
    if (role !== "rider" || sessionRef.current.ride) return;
    void providerFor(settingsRef.current.brand).getActiveRide().then((ride) => { mutate((current) => (current.ride ? current : { ...current, ride })); });
  }, [mutate, role]);

  // Real device GPS (after the permission screen). Never required for the demo.
  const enableGps = useCallback((enabled: boolean) => {
    setGpsEnabled(enabled);
    setGpsStatus(enabled ? "watching" : "idle");
  }, []);
  useEffect(() => {
    if (role !== "rider") return;
    void checkLocationPermission().then((state) => { if (state === "granted") enableGps(true); });
  }, [enableGps, role]);
  useEffect(() => {
    if (!gpsEnabled) return;
    return watchGps((fix) => { setGps(fix); setGpsStatus("watching"); }, (denied) => setGpsStatus(denied ? "denied" : "unavailable"));
  }, [gpsEnabled]);

  const route = session.route?.points ?? null;
  const cab = useMemo(() => (session.sharing && route ? cabPosition(route, session.simulation) : null), [route, session.sharing, session.simulation]);
  const location = useMemo(() => currentLocation(session, settings.demoMode, gps), [gps, session, settings.demoMode]);
  const remaining = route ? remainingMetres(route, session.simulation) : session.ride ? FALLBACK_PLANNED_ROUTE.distanceMetres : 0;
  const etaMinutes = Math.max(0, Math.round(remaining / SPEEDS.realistic / 60));

  // Nearby police and hospitals: refetch only after moving ~2.5 km. The
  // location changes every tick, so a request is not cancelled by the next
  // tick; only the newest request may update state.
  const placesRequest = useRef(0);
  useEffect(() => {
    if (role !== "rider") return;
    if (placesCenter.current && haversineMetres(placesCenter.current, location) < 2_500) return;
    placesCenter.current = location;
    const request = (placesRequest.current += 1);
    void fetchSafetyPlaces(location, { store: localStorage }).then((result) => { if (request === placesRequest.current) setPlaces(result); });
  }, [location, role]);

  // Until the first lookup finishes, alerts still carry the offline list.
  const nearest = useMemo(() => nearestSafetyPlaces(places?.places ?? FALLBACK_SAFETY_PLACES, location), [location, places]);
  const nearestRef = useRef(nearest);
  useEffect(() => { nearestRef.current = nearest; }, [nearest]);

  const recipientsFor = useCallback((current: Session) => current.sharing?.recipientIds ?? membersRef.current.map((member) => member.id), []);

  const raiseDeviation = useCallback((current: Session, distance: number): Session => {
    const s = settingsRef.current;
    const alert = buildDeviationAlert({
      id: alertId("deviation"), userName: s.userName, location: currentLocation(current, s.demoMode, gpsRef.current), ride: current.ride,
      nearest: nearestRef.current, recipientIds: recipientsFor(current), distanceOffRouteMetres: distance,
    });
    void vibrate("warning");
    void notify(translateRide(s.language, "notify.deviationTitle"), translateRide(s.language, "notify.deviationBody", { name: alert.userName, distance: formatDistance(distance) }));
    return { ...current, alerts: [alert, ...current.alerts], riderDeviationAlertId: alert.id };
  }, [recipientsFor]);

  // DEMO: drive the simulated cab and run deviation detection on each step.
  useEffect(() => {
    if (role !== "rider" || !session.sharing || !session.route || session.simulation.arrived) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const seconds = Math.min(2, (now - last) / 1_000);
      last = now;
      mutate((current) => {
        if (!current.route || !current.sharing) return current;
        const points = current.route.points;
        const simulation = advanceSimulation(points, current.simulation, SPEEDS[settingsRef.current.speed] * seconds);
        const position = cabPosition(points, simulation).point;
        const { state: deviation, event } = evaluateDeviation(current.deviation, points, position, Date.now(), { ...DEFAULT_DEVIATION_CONFIG, thresholdMetres: settingsRef.current.deviationMetres });
        let next: Session = { ...current, simulation, deviation };
        if (event === "deviationStarted") next = raiseDeviation(next, deviation.distanceMetres);
        if (event === "backOnRoute") { showToast(translateRide(settingsRef.current.language, "deviation.back")); next = { ...next, riderDeviationAlertId: null }; }
        if (simulation.arrived && !current.simulation.arrived) next = { ...next, arrivedAt: Date.now() };
        return next;
      });
    }, 400);
    return () => window.clearInterval(timer);
  }, [mutate, raiseDeviation, role, session.route, session.sharing, session.simulation.arrived, showToast]);

  const activateSos = useCallback(() => {
    mutate((current) => {
      if (current.sos.phase === "active") return current;
      const s = settingsRef.current;
      const alert = buildSosAlert({ id: alertId("sos"), userName: s.userName, location: currentLocation(current, s.demoMode, gpsRef.current), ride: current.ride, nearest: nearestRef.current, recipientIds: recipientsFor(current) });
      void notify(translateRide(s.language, "notify.sosTitle", { name: alert.userName }), translateRide(s.language, "notify.sosBody"));
      return { ...current, alerts: [alert, ...current.alerts], sos: { phase: "active", alertId: alert.id, startedAt: Date.now(), silenced: false }, riderDeviationAlertId: null };
    });
  }, [mutate, recipientsFor]);

  // SOS countdown: fires once the 5 second cancel window passes.
  useEffect(() => {
    if (role !== "rider" || session.sos.phase !== "countdown") return;
    const timer = window.setTimeout(activateSos, Math.max(0, session.sos.endsAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [activateSos, role, session.sos]);

  const snapshot = useMemo<SharedSnapshot | null>(() => {
    if (role === "contact") return remoteSnapshot;
    return {
      version: 1, updatedAt: session.updatedAt, userName: settings.userName, members, ride: session.ride, sharing: session.sharing,
      route: session.route?.points ?? [], cab, offRouteMetres: session.deviation.distanceMetres, deviated: session.deviation.deviated,
      arrived: session.simulation.arrived, alerts: session.alerts, sosActiveAlertId: session.sos.phase === "active" ? session.sos.alertId : null, nearest,
    };
  }, [cab, members, nearest, remoteSnapshot, role, session, settings.userName]);

  useEffect(() => { if (role === "rider" && snapshot) publishSnapshot(snapshot); }, [role, snapshot]);
  useEffect(() => (role === "contact" ? subscribeSnapshot(setRemoteSnapshot) : undefined), [role]);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch })), []);

  const saveMember = useCallback((member: GroupMember) => setMembers((current) => upsertMember(current, member)), []);
  const deleteMember = useCallback((id: string) => {
    const next = removeMember(membersRef.current, id);
    membersRef.current = next;
    setMembers(next);
    mutate((s) => (s.sharing ? { ...s, sharing: { ...s.sharing, recipientIds: reconcileSelection(s.sharing.recipientIds, next) } } : s));
  }, [mutate]);

  const changeBrand = useCallback((brand: RideBrand) => {
    updateSettings({ brand });
    void providerFor(brand).getActiveRide().then((ride) => mutate((current) => (current.sharing ? current : { ...current, ride })));
  }, [mutate, updateSettings]);

  const startSharing = useCallback(async (recipientIds: string[]) => {
    const ride = sessionRef.current.ride;
    if (!ride || !recipientIds.length) return;
    const planned = await fetchPlannedRoute(ride.pickup.location, ride.drop.location);
    mutate((current) => ({ ...current, route: planned, sharing: { recipientIds, startedAt: Date.now() }, simulation: INITIAL_SIMULATION, deviation: INITIAL_DEVIATION_STATE, arrivedAt: null, riderDeviationAlertId: null }));
    void vibrate("tap");
    enableGps(true);
  }, [enableGps, mutate]);

  const endRide = useCallback(() => {
    void providerFor(settingsRef.current.brand).getActiveRide().then((ride) => {
      mutate((current) => ({ ...emptySession(ride), alerts: current.alerts, contactAcks: current.contactAcks }));
    });
  }, [mutate]);

  const simulateWrongTurn = useCallback(() => {
    mutate((current) => (current.route ? { ...current, simulation: startWrongTurn(current.route.points, current.simulation) } : current));
    void vibrate("tap");
  }, [mutate]);

  const triggerSos = useCallback(() => {
    mutate((current) => (current.sos.phase === "idle" ? { ...current, sos: { phase: "countdown", endsAt: Date.now() + SOS_COUNTDOWN_MS } } : current));
    void vibrate("warning");
  }, [mutate]);
  const cancelSos = useCallback(() => {
    mutate((current) => (current.sos.phase === "countdown" ? { ...current, sos: { phase: "idle" } } : current));
    showToast(translateRide(settingsRef.current.language, "sos.cancelled"));
  }, [mutate, showToast]);
  const stopSos = useCallback(() => mutate((current) => ({ ...current, sos: { phase: "idle" } })), [mutate]);
  const silenceSiren = useCallback(() => mutate((current) => (current.sos.phase === "active" ? { ...current, sos: { ...current.sos, silenced: true } } : current)), [mutate]);
  const dismissDeviation = useCallback(() => mutate((current) => ({ ...current, riderDeviationAlertId: null })), [mutate]);
  // In a separate contact tab this only updates that tab's own copy, which is
  // what a second phone would do.
  const acknowledgeAlert = useCallback((id: string) => {
    mutate((current) => (current.contactAcks.includes(id) ? current : { ...current, contactAcks: [...current.contactAcks, id] }));
  }, [mutate]);

  const resetDemo = useCallback(() => {
    const keepLanguage = settingsRef.current.language;
    const keepTheme = settingsRef.current.theme;
    setSettings({ ...defaultSettings(), language: keepLanguage, theme: keepTheme, onboarded: true });
    setMembers(DEMO_MEMBERS);
    clearSnapshot();
    mutate(() => emptySession(null));
    void providerFor("rapido").getActiveRide().then((ride) => mutate((current) => ({ ...current, ride })));
    setShareSheetOpen(false);
    setScreen("home");
  }, [mutate]);

  const navigate = useCallback((next: Screen) => { setScreen(next); window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  const value = useMemo<SafetyContextValue>(() => ({
    role, settings, updateSettings, members, saveMember, deleteMember, t, locale, screen, navigate, shareSheetOpen, setShareSheetOpen,
    session, cab, remaining, etaMinutes, location, gps, gpsStatus, setGpsEnabled: enableGps, places, nearest, snapshot, changeBrand, startSharing, endRide,
    simulateWrongTurn, triggerSos, cancelSos, stopSos, silenceSiren, dismissDeviation, acknowledgeAlert, resetDemo, toast, showToast,
  }), [role, settings, updateSettings, members, saveMember, deleteMember, t, locale, screen, navigate, shareSheetOpen, session, cab, remaining, etaMinutes,
    location, gps, gpsStatus, enableGps, places, nearest, snapshot, changeBrand, startSharing, endRide, simulateWrongTurn, triggerSos, cancelSos, stopSos,
    silenceSiren, dismissDeviation, acknowledgeAlert, resetDemo, toast, showToast]);

  return <SafetyContext.Provider value={value}>{children}</SafetyContext.Provider>;
}

export function useSafety(): SafetyContextValue {
  const context = useContext(SafetyContext);
  if (!context) throw new Error("useSafety must be used inside SafetyProvider");
  return context;
}
