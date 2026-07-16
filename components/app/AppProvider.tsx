"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createDefaultState } from "@/lib/mock-data";
import { translations, type TranslationKey } from "@/lib/i18n/translations";
import type { AppState, Journey, Language, Theme, TrustedContact } from "@/lib/types";

const STORAGE_KEY = "halovia.prototype.v1";

interface ToastMessage { id: number; text: string }

interface AppContextValue {
  state: AppState;
  ready: boolean;
  toast: ToastMessage | null;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  updateState: (updater: (current: AppState) => AppState) => void;
  setActiveJourney: (journey: Journey | null) => void;
  completeJourney: (status: Journey["status"]) => void;
  saveContact: (contact: TrustedContact) => void;
  removeContact: (id: string) => void;
  showToast: (text: string) => void;
  clearToast: () => void;
  resetState: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function safelyLoad(): AppState {
  const fallback = createDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<AppState>;
    return {
      ...fallback,
      ...saved,
      user: { ...fallback.user, ...saved.user },
      emergency: { ...fallback.emergency, ...saved.emergency },
      privacy: { ...fallback.privacy, ...saved.privacy },
      contacts: Array.isArray(saved.contacts) ? saved.contacts : fallback.contacts,
      history: Array.isArray(saved.history) ? saved.history : fallback.history,
      activeJourney: saved.activeJourney === undefined ? fallback.activeJourney : saved.activeJourney,
    };
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(createDefaultState);
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.documentElement.dataset.theme = state.user.theme;
    document.documentElement.lang = state.user.language;
    document.documentElement.classList.toggle("reduced-motion", state.privacy.reducedMotion);
  }, [ready, state]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const updateState = useCallback((updater: (current: AppState) => AppState) => setState(updater), []);
  const setLanguage = useCallback((language: Language) => setState((s) => ({ ...s, user: { ...s.user, language } })), []);
  const setTheme = useCallback((theme: Theme) => setState((s) => ({ ...s, user: { ...s.user, theme } })), []);
  const setActiveJourney = useCallback((activeJourney: Journey | null) => setState((s) => ({ ...s, activeJourney })), []);
  const showToast = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  const clearToast = useCallback(() => setToast(null), []);

  const completeJourney = useCallback((status: Journey["status"]) => {
    setState((s) => {
      if (!s.activeJourney) return s;
      const ended: Journey = {
        ...s.activeJourney,
        status,
        progress: status === "arrivedSafely" ? 100 : s.activeJourney.progress,
        endedAt: new Date().toISOString(),
        events: [...s.activeJourney.events, { id: `event-${Date.now()}`, type: status, timestamp: new Date().toISOString() }],
      };
      return { ...s, activeJourney: null, history: [ended, ...s.history.filter((j) => j.id !== ended.id)] };
    });
  }, []);

  const saveContact = useCallback((contact: TrustedContact) => {
    setState((s) => ({
      ...s,
      contacts: s.contacts.some((item) => item.id === contact.id)
        ? s.contacts.map((item) => (item.id === contact.id ? contact : item))
        : [...s.contacts, contact],
    }));
  }, []);

  const removeContact = useCallback((id: string) => {
    setState((s) => ({ ...s, contacts: s.contacts.filter((contact) => contact.id !== id) }));
  }, []);

  const resetState = useCallback(() => {
    const fresh = createDefaultState();
    window.localStorage.removeItem(STORAGE_KEY);
    setState(fresh);
  }, []);

  const t = useCallback((key: TranslationKey, values?: Record<string, string | number>) => {
    let text = translations[state.user.language][key] ?? translations.en[key];
    if (values) {
      Object.entries(values).forEach(([name, value]) => {
        text = text.replaceAll(`{${name}}`, String(value));
      });
    }
    return text;
  }, [state.user.language]);

  const value = useMemo<AppContextValue>(() => ({
    state, ready, toast, t, setLanguage, setTheme, updateState, setActiveJourney,
    completeJourney, saveContact, removeContact, showToast, clearToast, resetState,
  }), [state, ready, toast, t, setLanguage, setTheme, updateState, setActiveJourney, completeJourney, saveContact, removeContact, showToast, clearToast, resetState]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
