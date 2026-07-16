"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createDemoState, createEmptyState } from "@/lib/mock-data";
import { translations, type TranslationKey } from "@/lib/i18n/translations";
import {
  applyHistoryRetention,
  calculateJourneyProgress,
  createId,
  LEGACY_STORAGE_KEY,
  normalizeAppState,
  STORAGE_KEY,
} from "@/lib/state/app-state";
import type {
  AppState,
  HistoryRetention,
  Journey,
  JourneyEventType,
  Language,
  SafetyCheckReason,
  Theme,
  TrustedContact,
} from "@/lib/types";

interface ToastMessage { id: string; text: string }

interface AppContextValue {
  state: AppState;
  ready: boolean;
  toast: ToastMessage | null;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  updateState: (updater: (current: AppState) => AppState) => void;
  setActiveJourney: (journey: Journey | null) => void;
  completeJourney: (status: "arrivedSafely" | "endedManually") => void;
  recordSafeCheckIn: () => void;
  triggerSafetyCheck: (reason: SafetyCheckReason) => void;
  extendSafetyCheck: () => void;
  requestHelp: () => void;
  triggerPrototypeEscalation: () => void;
  clearSafetyCheck: () => void;
  setConnectionStatus: (connected: boolean) => void;
  recordJourneyEvent: (type: JourneyEventType, detail?: string) => void;
  updateRetention: (retention: HistoryRetention) => void;
  saveContact: (contact: TrustedContact) => void;
  removeContact: (id: string) => void;
  showToast: (text: string) => void;
  clearToast: () => void;
  beginCleanSetup: () => void;
  loadDemo: () => void;
  resetState: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function safelyLoad(): AppState {
  const fallback = createEmptyState();
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return normalizeAppState(JSON.parse(raw) as unknown, fallback);
  } catch {
    return fallback;
  }
}

function event(type: JourneyEventType, timestamp: string, detail?: string): Journey["events"][number] {
  return { id: createId("event"), type, timestamp, detail };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(createEmptyState);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setState(safelyLoad());
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Keep the in-memory prototype usable if browser storage is unavailable.
    }
    document.documentElement.dataset.theme = state.user.theme;
    document.documentElement.lang = state.user.language;
    document.documentElement.dir = state.user.language === "ar" ? "rtl" : "ltr";
    document.documentElement.classList.toggle("reduced-motion", state.privacy.reducedMotion);
    document.body.dataset.mode = state.mode;
  }, [ready, state]);

  const activeJourneyId = state.activeJourney?.id;

  useEffect(() => {
    if (!ready || !activeJourneyId) return;
    const updateProgress = () => {
      setState((current) => {
        if (!current.activeJourney) return current;
        const progress = calculateJourneyProgress(current.activeJourney);
        if (progress === current.activeJourney.progress) return current;
        return { ...current, activeJourney: { ...current.activeJourney, progress } };
      });
    };
    updateProgress();
    const timer = window.setInterval(updateProgress, 15_000);
    return () => window.clearInterval(timer);
  }, [activeJourneyId, ready]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister().catch(() => undefined));
      }).catch(() => undefined);
      if ("caches" in window) {
        caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("halovia-")).map((key) => caches.delete(key)))).catch(() => undefined);
      }
      return;
    }
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      registration.update().catch(() => undefined);
      const urls = Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[rel='stylesheet'][href]"))
        .map((element) => (element instanceof HTMLScriptElement ? element.src : element.href))
        .filter((url) => url.startsWith(window.location.origin));
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      worker?.postMessage({ type: "CACHE_URLS", urls });
    }).catch(() => undefined);
  }, []);

  const updateState = useCallback((updater: (current: AppState) => AppState) => setState(updater), []);
  const setLanguage = useCallback((language: Language) => setState((current) => ({ ...current, user: { ...current.user, language } })), []);
  const setTheme = useCallback((theme: Theme) => setState((current) => ({ ...current, user: { ...current.user, theme } })), []);
  const setActiveJourney = useCallback((activeJourney: Journey | null) => setState((current) => ({ ...current, activeJourney })), []);
  const showToast = useCallback((text: string) => setToast({ id: createId("toast"), text }), []);
  const clearToast = useCallback(() => setToast(null), []);

  const completeJourney = useCallback((status: "arrivedSafely" | "endedManually") => {
    setState((current) => {
      if (!current.activeJourney) return current;
      const now = new Date();
      const ended: Journey = {
        ...current.activeJourney,
        status,
        progress: status === "arrivedSafely" ? 100 : calculateJourneyProgress(current.activeJourney, now.getTime()),
        endedAt: now.toISOString(),
        durationMinutes: Math.max(0, Math.round((now.getTime() - new Date(current.activeJourney.startedAt).getTime()) / 60_000)),
        emergencyState: "none",
        events: [...current.activeJourney.events, event(status, now.toISOString())],
      };
      const history = current.privacy.historyRetention === "auto"
        ? current.history.filter((journey) => journey.id !== ended.id)
        : [ended, ...current.history.filter((journey) => journey.id !== ended.id)];
      return { ...current, activeJourney: null, safetyCheck: null, history };
    });
  }, []);

  const recordSafeCheckIn = useCallback(() => {
    setState((current) => {
      if (!current.activeJourney) return { ...current, safetyCheck: null };
      const timestamp = new Date().toISOString();
      return {
        ...current,
        safetyCheck: null,
        activeJourney: {
          ...current.activeJourney,
          status: "safeCheckIn",
          lastCheckInAt: timestamp,
          emergencyState: "none",
          safetyCheckOccurred: current.activeJourney.safetyCheckOccurred || Boolean(current.safetyCheck),
          events: [...current.activeJourney.events, event("safeCheckIn", timestamp)],
        },
      };
    });
  }, []);

  const triggerSafetyCheck = useCallback((reason: SafetyCheckReason) => {
    setState((current) => {
      if (!current.activeJourney || current.safetyCheck) return current;
      const now = new Date();
      const responseSeconds = current.privacy.safetyResponseSeconds;
      const status = reason === "routeChanged" ? "routeChanged" : reason === "slightDelay" || reason === "extendedStop" ? "slightDelay" : "safetyCheckRequested";
      return {
        ...current,
        safetyCheck: {
          id: createId("safety-check"),
          reason,
          startedAt: now.toISOString(),
          deadlineAt: new Date(now.getTime() + responseSeconds * 1000).toISOString(),
          responseSeconds,
          extensionUsed: false,
          escalated: false,
        },
        activeJourney: {
          ...current.activeJourney,
          status,
          safetyCheckOccurred: true,
          events: [...current.activeJourney.events, event(status, now.toISOString(), reason)],
        },
      };
    });
  }, []);

  const extendSafetyCheck = useCallback(() => {
    setState((current) => {
      if (!current.safetyCheck || current.safetyCheck.extensionUsed || current.safetyCheck.escalated || !current.activeJourney) return current;
      const now = new Date();
      const deadline = Math.max(now.getTime(), new Date(current.safetyCheck.deadlineAt).getTime()) + 120_000;
      return {
        ...current,
        safetyCheck: { ...current.safetyCheck, deadlineAt: new Date(deadline).toISOString(), extensionUsed: true },
        activeJourney: {
          ...current.activeJourney,
          events: [...current.activeJourney.events, event("safetyCheckExtended", now.toISOString())],
        },
      };
    });
  }, []);

  const requestHelp = useCallback(() => {
    setState((current) => {
      if (!current.activeJourney) return { ...current, safetyCheck: null };
      const timestamp = new Date().toISOString();
      return {
        ...current,
        safetyCheck: null,
        activeJourney: {
          ...current.activeJourney,
          status: "helpRequested",
          emergencyState: "helpRequested",
          events: [...current.activeJourney.events, event("helpRequested", timestamp)],
        },
      };
    });
  }, []);

  const triggerPrototypeEscalation = useCallback(() => {
    setState((current) => {
      if (!current.activeJourney || !current.safetyCheck || current.safetyCheck.escalated) return current;
      const timestamp = new Date().toISOString();
      return {
        ...current,
        safetyCheck: { ...current.safetyCheck, escalated: true },
        activeJourney: {
          ...current.activeJourney,
          status: "prototypeEscalated",
          emergencyState: "prototypeEscalated",
          prototypeEscalationTriggered: true,
          events: [...current.activeJourney.events, event("prototypeEscalated", timestamp)],
        },
      };
    });
  }, []);

  const clearSafetyCheck = useCallback(() => setState((current) => ({ ...current, safetyCheck: null })), []);

  const setConnectionStatus = useCallback((connected: boolean) => {
    setState((current) => {
      if (!current.activeJourney) return current;
      const timestamp = new Date().toISOString();
      return {
        ...current,
        activeJourney: {
          ...current.activeJourney,
          connectionStatus: connected ? "online" : "offline",
          events: connected ? current.activeJourney.events : [...current.activeJourney.events, event("connectionLost", timestamp)],
        },
      };
    });
  }, []);

  const recordJourneyEvent = useCallback((type: JourneyEventType, detail?: string) => {
    setState((current) => {
      if (!current.activeJourney) return current;
      const timestamp = new Date().toISOString();
      return { ...current, activeJourney: { ...current.activeJourney, events: [...current.activeJourney.events, event(type, timestamp, detail)] } };
    });
  }, []);

  const updateRetention = useCallback((historyRetention: HistoryRetention) => {
    setState((current) => ({
      ...current,
      privacy: { ...current.privacy, historyRetention },
      history: applyHistoryRetention(current.history, historyRetention),
    }));
  }, []);

  const saveContact = useCallback((contact: TrustedContact) => {
    setState((current) => ({
      ...current,
      contacts: current.contacts.some((item) => item.id === contact.id)
        ? current.contacts.map((item) => (item.id === contact.id ? contact : item))
        : [...current.contacts, contact],
    }));
  }, []);

  const removeContact = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      contacts: current.contacts.filter((contact) => contact.id !== id),
      activeJourney: current.activeJourney
        ? { ...current.activeJourney, contactIds: current.activeJourney.contactIds.filter((contactId) => contactId !== id) }
        : null,
    }));
  }, []);

  const beginCleanSetup = useCallback(() => {
    setState((current) => {
      const fresh = createEmptyState();
      return { ...fresh, user: { ...fresh.user, language: current.user.language, locale: current.user.locale, theme: current.user.theme } };
    });
  }, []);

  const loadDemo = useCallback(() => setState((current) => {
    const demo = createDemoState();
    return {
      ...demo,
      user: {
        ...demo.user,
        language: current.user.language,
        locale: current.user.locale,
        country: current.user.country,
        dateFormat: current.user.dateFormat,
        theme: current.user.theme,
      },
    };
  }), []);

  const resetState = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    setState(createEmptyState());
  }, []);

  const t = useCallback((key: TranslationKey, values?: Record<string, string | number>) => {
    let text: string = translations[state.user.language][key];
    if (values) {
      Object.entries(values).forEach(([name, value]) => {
        text = text.replaceAll(`{${name}}`, String(value));
      });
    }
    return text;
  }, [state.user.language]);

  const value = useMemo<AppContextValue>(() => ({
    state, ready, toast, t, setLanguage, setTheme, updateState, setActiveJourney,
    completeJourney, recordSafeCheckIn, triggerSafetyCheck, extendSafetyCheck,
    requestHelp, triggerPrototypeEscalation, clearSafetyCheck, setConnectionStatus,
    recordJourneyEvent, updateRetention, saveContact, removeContact, showToast,
    clearToast, beginCleanSetup, loadDemo, resetState,
  }), [state, ready, toast, t, setLanguage, setTheme, updateState, setActiveJourney,
    completeJourney, recordSafeCheckIn, triggerSafetyCheck, extendSafetyCheck,
    requestHelp, triggerPrototypeEscalation, clearSafetyCheck, setConnectionStatus,
    recordJourneyEvent, updateRetention, saveContact, removeContact, showToast,
    clearToast, beginCleanSetup, loadDemo, resetState]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
