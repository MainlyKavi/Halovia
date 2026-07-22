"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createDemoState, createEmptyState } from "@/lib/mock-data";
import { translations, type TranslationKey } from "@/lib/i18n/translations";
import { applyHistoryRetention, calculateJourneyProgress, createId, LEGACY_STORAGE_KEY, STORAGE_KEY } from "@/lib/state/app-state";
import { clearVehicleImages, pruneVehicleImages } from "@/lib/storage/vehicle-images";
import { clearPreferences, readPreferences, writePreferences } from "@/lib/storage/preferences";
import { clearLocationQueue, useJourneyTracking, type JourneyTrackingState } from "@/hooks/useJourneyTracking";
import { HaloviaApiError, haloviaApi } from "@/lib/api-client";
import type { BackendContact, BackendJourney, BackendProfile, BackendShareSession } from "@/lib/api-types";
import type { AppState, HistoryRetention, Journey, JourneyEventType, Language, SafetyCheckReason, Theme, TrustedContact } from "@/lib/types";

interface ToastMessage { id: string; text: string }
type BackendStatus = "loading" | "ready" | "authentication_required" | "configuration_required" | "error";

interface AppContextValue {
  state: AppState;
  ready: boolean;
  backendStatus: BackendStatus;
  backendJourney: BackendJourney | null;
  tracking: JourneyTrackingState;
  shareSessions: BackendShareSession[];
  viewerUrl: string | null;
  toast: ToastMessage | null;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  updateState: (updater: (current: AppState) => AppState) => void;
  setActiveJourney: (journey: Journey | null) => void;
  createBackendJourney: (input: Record<string, unknown>, image?: File) => Promise<BackendJourney>;
  refreshBackend: () => Promise<void>;
  completeJourney: (status: "arrivedSafely" | "endedManually") => void;
  recordSafeCheckIn: () => void;
  triggerSafetyCheck: (reason: SafetyCheckReason) => void;
  extendSafetyCheck: () => void;
  requestHelp: () => void;
  triggerPrototypeEscalation: () => void;
  clearSafetyCheck: () => void;
  createShare: () => Promise<string>;
  revokeShare: (sessionId?: string) => Promise<void>;
  setConnectionStatus: (connected: boolean) => void;
  recordJourneyEvent: (type: JourneyEventType, detail?: string) => void;
  updateRetention: (retention: HistoryRetention) => void;
  saveContact: (contact: TrustedContact) => void;
  removeContact: (id: string) => void;
  showToast: (text: string) => void;
  clearToast: () => void;
  beginCleanSetup: () => void;
  loadDemo: () => void;
  resetState: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function eventType(type: string): JourneyEventType {
  const map: Record<string, JourneyEventType> = {
    journey_started: "journeyStarted",
    sharing_enabled: "onRoute",
    sharing_revoked: "connectionLost",
    safe_check_in: "safeCheckIn",
    safety_check_started: "safetyCheckRequested",
    safety_check_extended: "safetyCheckExtended",
    safety_check_expired: "prototypeEscalated",
    help_requested: "helpRequested",
    arrived_safely: "arrivedSafely",
    journey_ended: "endedManually",
  };
  return map[type] ?? "onRoute";
}

function legacyJourney(journey: BackendJourney): Journey {
  const status = journey.status !== "active"
    ? journey.status === "completed" ? "arrivedSafely" : "endedManually"
    : journey.safetyStatus === "help_requested" ? "helpRequested"
    : journey.safetyStatus === "attention_required" ? "prototypeEscalated"
    : journey.safetyStatus === "check_pending" ? "safetyCheckRequested"
    : "onRoute";
  const latest = journey.latestLocation ?? undefined;
  return {
    id: journey.id,
    origin: journey.originName,
    destination: journey.destinationName,
    originCoordinate: journey.origin,
    destinationCoordinate: journey.destination,
    startedAt: journey.startedAt,
    eta: journey.safetyEta,
    routeEta: journey.routeEta ?? undefined,
    remainingDistanceMetres: journey.remainingDistanceMetres ?? undefined,
    endedAt: journey.completedAt ?? undefined,
    durationMinutes: Math.max(0, Math.round(((journey.completedAt ? new Date(journey.completedAt).getTime() : Date.now()) - new Date(journey.startedAt).getTime()) / 60_000)),
    travelType: journey.transportType,
    status,
    contactIds: [],
    safetyCheckOccurred: journey.events.some((item) => item.type === "safety_check_started"),
    prototypeEscalationTriggered: journey.safetyStatus === "attention_required",
    progress: calculateJourneyProgress({ startedAt: journey.startedAt, eta: journey.safetyEta, endedAt: journey.completedAt ?? undefined }),
    vehicleNumber: journey.vehicleNumber ?? undefined,
    driverName: journey.driverName ?? undefined,
    vehicleDescription: journey.vehicleDescription ?? undefined,
    vehicleImageId: journey.hasVehicleImage ? journey.id : undefined,
    note: journey.notes ?? undefined,
    lastLocationUpdateAt: journey.lastLocationAt ?? journey.startedAt,
    lastServerUpdateAt: journey.lastServerUpdateAt ?? undefined,
    latestCoordinate: latest,
    sharingStatus: journey.sharingStatus,
    backendSafetyStatus: journey.safetyStatus,
    connectionStatus: "online",
    emergencyState: journey.safetyStatus === "help_requested" ? "helpRequested" : journey.safetyStatus === "attention_required" ? "prototypeEscalated" : "none",
    events: journey.events.map((item) => ({ id: item.id, type: eventType(item.type), timestamp: item.createdAt, detail: item.detail ? JSON.stringify(item.detail) : undefined })),
  };
}

function backendContact(contact: BackendContact, index: number): TrustedContact {
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    relationship: contact.relationship,
    initials: contact.name.split(/\s+/u).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?",
    color: ["#ce6685", "#6f63d9", "#23866d", "#b66c27"][index % 4],
    preference: contact.emergencyAlerts ? "all" : "emergency",
    active: contact.active,
    defaultForJourneys: contact.defaultForJourneys,
    emergencyAlerts: contact.emergencyAlerts,
  };
}

function mergeBootstrap(current: AppState, profile: BackendProfile, contacts: BackendContact[], activeJourney: BackendJourney | null, history: BackendJourney[]): AppState {
  return {
    ...current,
    mode: "clean",
    user: {
      ...current.user,
      id: profile.id,
      name: profile.displayName,
      language: (["en", "hi", "es", "fr", "ru", "ur", "bn", "ta", "ar"].includes(profile.language) ? profile.language : current.user.language) as Language,
      locale: profile.locale as AppState["user"]["locale"],
      country: profile.country as AppState["user"]["country"],
      dateFormat: profile.dateFormat as AppState["user"]["dateFormat"],
      onboardingComplete: profile.onboardingComplete,
    },
    emergency: { ...current.emergency, number: profile.emergencyNumber, country: profile.country as AppState["emergency"]["country"] },
    privacy: { ...current.privacy, historyRetention: String(profile.retentionDays) as HistoryRetention },
    contacts: contacts.map(backendContact),
    activeJourney: activeJourney ? legacyJourney(activeJourney) : null,
    history: history.map(legacyJourney),
    safetyCheck: activeJourney?.safetyCheck?.status === "pending" ? {
      id: activeJourney.safetyCheck.id,
      reason: "manualDemo",
      startedAt: activeJourney.events.find((item) => item.type === "safety_check_started")?.createdAt ?? new Date().toISOString(),
      deadlineAt: activeJourney.safetyCheck.deadlineAt,
      responseSeconds: current.privacy.safetyResponseSeconds,
      extensionUsed: activeJourney.safetyCheck.extensionCount > 0,
      escalated: false,
    } : null,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(createEmptyState);
  const [ready, setReady] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("loading");
  const [backendJourney, setBackendJourney] = useState<BackendJourney | null>(null);
  const [shareSessions, setShareSessions] = useState<BackendShareSession[]>([]);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const profileSyncTimer = useRef<number | null>(null);

  const t = useCallback((key: TranslationKey, values?: Record<string, string | number>) => {
    let text: string = translations[state.user.language][key];
    if (values) Object.entries(values).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
    return text;
  }, [state.user.language]);

  useEffect(() => {
    const preferences = readPreferences();
    try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* Old prototype state is non-authoritative and optional. */ }
    queueMicrotask(() => {
      setState((current) => ({
        ...current,
        user: { ...current.user, theme: preferences.theme, language: preferences.language, locale: preferences.locale, country: preferences.country, dateFormat: preferences.dateFormat },
        privacy: { ...current.privacy, reducedMotion: preferences.reducedMotion },
      }));
      setReady(true);
    });
  }, []);

  const showToast = useCallback((text: string) => setToast({ id: createId("toast"), text }), []);
  const clearToast = useCallback(() => setToast(null), []);

  const applyBackendJourney = useCallback((journey: BackendJourney) => {
    setBackendJourney(journey.status === "active" ? journey : null);
    setState((current) => journey.status === "active"
      ? { ...current, activeJourney: legacyJourney(journey), safetyCheck: journey.safetyCheck?.status === "pending" ? {
        id: journey.safetyCheck.id,
        reason: "manualDemo",
        startedAt: journey.events.find((item) => item.type === "safety_check_started")?.createdAt ?? new Date().toISOString(),
        deadlineAt: journey.safetyCheck.deadlineAt,
        responseSeconds: current.privacy.safetyResponseSeconds,
        extensionUsed: journey.safetyCheck.extensionCount > 0,
        escalated: false,
      } : null }
      : { ...current, activeJourney: null, safetyCheck: null, history: [legacyJourney(journey), ...current.history.filter((item) => item.id !== journey.id)] });
  }, []);

  const tracking = useJourneyTracking(backendJourney, applyBackendJourney);

  const refreshBackend = useCallback(async () => {
    setBackendStatus((current) => current === "ready" ? current : "loading");
    try {
      const payload = await haloviaApi.bootstrap();
      setBackendJourney(payload.activeJourney);
      setState((current) => mergeBootstrap(current, payload.profile, payload.contacts, payload.activeJourney, payload.history));
      setBackendStatus("ready");
      if (payload.activeJourney) {
        const shares = await haloviaApi.listShares(payload.activeJourney.id).catch(() => ({ sessions: [] }));
        setShareSessions(shares.sessions);
      } else setShareSessions([]);
    } catch (error) {
      if (error instanceof HaloviaApiError && error.status === 401) setBackendStatus("authentication_required");
      else if (error instanceof HaloviaApiError && error.code === "service_unavailable") setBackendStatus("configuration_required");
      else setBackendStatus("error");
    }
  }, []);

  useEffect(() => { if (ready) queueMicrotask(() => void refreshBackend()); }, [ready, refreshBackend]);

  useEffect(() => {
    if (!ready) return;
    writePreferences({
      theme: state.user.theme,
      language: state.user.language,
      locale: state.user.locale,
      country: state.user.country,
      dateFormat: state.user.dateFormat,
      reducedMotion: state.privacy.reducedMotion,
    });
    document.documentElement.dataset.theme = state.user.theme;
    document.documentElement.lang = state.user.language;
    document.documentElement.dir = state.user.language === "ar" || state.user.language === "ur" ? "rtl" : "ltr";
    document.documentElement.classList.toggle("reduced-motion", state.privacy.reducedMotion);
    document.body.dataset.mode = state.mode;
  }, [ready, state.user.theme, state.user.language, state.user.locale, state.user.country, state.user.dateFormat, state.privacy.reducedMotion, state.mode]);

  useEffect(() => {
    if (!ready || backendStatus !== "ready" || state.mode === "demo") return;
    if (profileSyncTimer.current !== null) window.clearTimeout(profileSyncTimer.current);
    profileSyncTimer.current = window.setTimeout(() => {
      void haloviaApi.updateProfile({
        displayName: state.user.name,
        language: state.user.language,
        locale: state.user.locale,
        country: state.user.country,
        dateFormat: state.user.dateFormat,
        emergencyNumber: state.emergency.number,
        retentionDays: state.privacy.historyRetention === "7" ? 7 : 30,
        onboardingComplete: state.user.onboardingComplete,
      }).catch(() => undefined);
    }, 500);
    return () => { if (profileSyncTimer.current !== null) window.clearTimeout(profileSyncTimer.current); };
  }, [backendStatus, ready, state.emergency.number, state.mode, state.privacy.historyRetention, state.user]);

  const retainedImageIds = useMemo(() => state.mode === "demo" ? [state.activeJourney, ...state.history].flatMap((journey) => journey?.vehicleImageId ? [journey.vehicleImageId] : []) : [], [state.activeJourney, state.history, state.mode]);
  useEffect(() => { if (ready && state.mode === "demo") pruneVehicleImages(retainedImageIds).catch(() => undefined); }, [ready, retainedImageIds, state.mode]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (import.meta.env.DEV) return;
    navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch(() => undefined);
  }, []);

  const updateState = useCallback((updater: (current: AppState) => AppState) => setState(updater), []);
  const setLanguage = useCallback((language: Language) => setState((current) => ({ ...current, user: { ...current.user, language } })), []);
  const setTheme = useCallback((theme: Theme) => setState((current) => ({ ...current, user: { ...current.user, theme } })), []);
  const setActiveJourney = useCallback((activeJourney: Journey | null) => setState((current) => ({ ...current, activeJourney })), []);

  const createBackendJourney = useCallback(async (input: Record<string, unknown>, image?: File) => {
    const result = await haloviaApi.createJourney(input);
    if (image) await haloviaApi.uploadVehicleImage(result.journey.id, image);
    const refreshed = image ? await haloviaApi.getJourney(result.journey.id) : result;
    applyBackendJourney(refreshed.journey);
    return refreshed.journey;
  }, [applyBackendJourney]);

  const completeJourney = useCallback((status: "arrivedSafely" | "endedManually") => {
    if (state.mode === "demo") {
      setState((current) => ({ ...current, activeJourney: null, safetyCheck: null }));
      return;
    }
    if (!backendJourney) return;
    void haloviaApi.endJourney(backendJourney.id, status === "arrivedSafely" ? "completed" : "ended")
      .then(({ journey }) => { clearLocationQueue(); applyBackendJourney(journey); setShareSessions([]); setViewerUrl(null); })
      .catch(() => showToast(t("journey.serverError")));
  }, [applyBackendJourney, backendJourney, showToast, state.mode, t]);

  const performSafetyAction = useCallback((action: "start" | "safe" | "help" | "extend" | "expire", extra: Record<string, unknown> = {}) => {
    if (!backendJourney) return;
    void haloviaApi.safetyAction(backendJourney.id, action, extra).then(({ journey }) => applyBackendJourney(journey))
      .catch(() => showToast(t("journey.serverError")));
  }, [applyBackendJourney, backendJourney, showToast, t]);

  const recordSafeCheckIn = useCallback(() => performSafetyAction("safe"), [performSafetyAction]);
  const triggerSafetyCheck = useCallback((reason: SafetyCheckReason) => performSafetyAction("start", { reason, responseSeconds: state.privacy.safetyResponseSeconds }), [performSafetyAction, state.privacy.safetyResponseSeconds]);
  const extendSafetyCheck = useCallback(() => performSafetyAction("extend"), [performSafetyAction]);
  const requestHelp = useCallback(() => performSafetyAction("help"), [performSafetyAction]);
  const triggerPrototypeEscalation = useCallback(() => {
    if (state.mode === "demo") setState((current) => ({ ...current, safetyCheck: current.safetyCheck ? { ...current.safetyCheck, escalated: true } : null }));
    else performSafetyAction("expire");
  }, [performSafetyAction, state.mode]);
  const clearSafetyCheck = useCallback(() => setState((current) => ({ ...current, safetyCheck: null })), []);

  const createShare = useCallback(async () => {
    if (!backendJourney) throw new Error(t("journey.serverError"));
    const result = await haloviaApi.createShare(backendJourney.id);
    setViewerUrl(result.viewerUrl);
    setShareSessions((current) => [result.session, ...current]);
    const refreshed = await haloviaApi.getJourney(backendJourney.id);
    applyBackendJourney(refreshed.journey);
    return result.viewerUrl;
  }, [applyBackendJourney, backendJourney, t]);

  const revokeShare = useCallback(async (sessionId?: string) => {
    if (!backendJourney) return;
    await haloviaApi.revokeShare(backendJourney.id, sessionId);
    setViewerUrl(null);
    const [shares, refreshed] = await Promise.all([haloviaApi.listShares(backendJourney.id), haloviaApi.getJourney(backendJourney.id)]);
    setShareSessions(shares.sessions);
    applyBackendJourney(refreshed.journey);
  }, [applyBackendJourney, backendJourney]);

  const setConnectionStatus = useCallback((connected: boolean) => setState((current) => current.activeJourney ? ({ ...current, activeJourney: { ...current.activeJourney, connectionStatus: connected ? "online" : "offline" } }) : current), []);
  const recordJourneyEvent = useCallback((type: JourneyEventType, detail?: string) => { void type; void detail; }, []);

  const updateRetention = useCallback((historyRetention: HistoryRetention) => setState((current) => ({ ...current, privacy: { ...current.privacy, historyRetention }, history: applyHistoryRetention(current.history, historyRetention) })), []);

  const saveContact = useCallback((contact: TrustedContact) => {
    if (state.mode === "demo") {
      setState((current) => ({ ...current, contacts: current.contacts.some((item) => item.id === contact.id) ? current.contacts.map((item) => item.id === contact.id ? contact : item) : [...current.contacts, contact] }));
      return;
    }
    const payload = { ...contact, id: contact.id.startsWith("con_") ? contact.id : undefined };
    void haloviaApi.saveContact(payload).then(({ contact: saved }) => {
      const mapped = backendContact(saved, state.contacts.length);
      setState((current) => ({ ...current, contacts: current.contacts.some((item) => item.id === contact.id || item.id === mapped.id) ? current.contacts.map((item) => item.id === contact.id || item.id === mapped.id ? mapped : item) : [...current.contacts, mapped] }));
    }).catch(() => showToast(t("journey.serverError")));
  }, [showToast, state.contacts.length, state.mode, t]);

  const removeContact = useCallback((id: string) => {
    if (state.mode === "demo") setState((current) => ({ ...current, contacts: current.contacts.filter((contact) => contact.id !== id) }));
    else void haloviaApi.removeContact(id).then(() => setState((current) => ({ ...current, contacts: current.contacts.filter((contact) => contact.id !== id) }))).catch(() => showToast(t("journey.serverError")));
  }, [showToast, state.mode, t]);

  const beginCleanSetup = useCallback(() => setState((current) => {
    const fresh = createEmptyState();
    return { ...fresh, user: { ...fresh.user, language: current.user.language, locale: current.user.locale, country: current.user.country, dateFormat: current.user.dateFormat, theme: current.user.theme } };
  }), []);

  const loadDemo = useCallback(() => {
    if (!import.meta.env.DEV) return;
    setState((current) => {
      const demo = createDemoState();
      return { ...demo, user: { ...demo.user, language: current.user.language, locale: current.user.locale, country: current.user.country, dateFormat: current.user.dateFormat, theme: current.user.theme } };
    });
  }, []);

  const resetState = useCallback(async () => {
    if (backendStatus === "ready" && state.mode !== "demo") await haloviaApi.deleteAccount();
    clearPreferences();
    clearLocationQueue();
    await clearVehicleImages().catch(() => undefined);
    if ("caches" in window) {
      const keys = await caches.keys().catch(() => []);
      await Promise.all(keys.filter((key) => key.startsWith("halovia-")).map((key) => caches.delete(key))).catch(() => undefined);
    }
    setState(createEmptyState());
    setBackendJourney(null);
    setShareSessions([]);
    setViewerUrl(null);
  }, [backendStatus, state.mode]);

  const value = useMemo<AppContextValue>(() => ({
    state, ready, backendStatus, backendJourney, tracking, shareSessions, viewerUrl, toast, t,
    setLanguage, setTheme, updateState, setActiveJourney, createBackendJourney, refreshBackend,
    completeJourney, recordSafeCheckIn, triggerSafetyCheck, extendSafetyCheck, requestHelp,
    triggerPrototypeEscalation, clearSafetyCheck, createShare, revokeShare, setConnectionStatus,
    recordJourneyEvent, updateRetention, saveContact, removeContact, showToast, clearToast,
    beginCleanSetup, loadDemo, resetState,
  }), [state, ready, backendStatus, backendJourney, tracking, shareSessions, viewerUrl, toast, t,
    setLanguage, setTheme, updateState, setActiveJourney, createBackendJourney, refreshBackend,
    completeJourney, recordSafeCheckIn, triggerSafetyCheck, extendSafetyCheck, requestHelp,
    triggerPrototypeEscalation, clearSafetyCheck, createShare, revokeShare, setConnectionStatus,
    recordJourneyEvent, updateRetention, saveContact, removeContact, showToast, clearToast,
    beginCleanSetup, loadDemo, resetState]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
