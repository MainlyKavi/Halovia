"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HaloviaApiError, haloviaApi } from "@/lib/api-client";
import type { BackendJourney, DeviceCoordinate, TrackingStatus } from "@/lib/api-types";
import { shouldSubmitLocation, validCoordinate } from "@/lib/backend/validation";
import { LOCATION_POLICY } from "@/lib/config";
import { coordinateFromPosition } from "@/lib/geolocation";

const OFFLINE_QUEUE_KEY = "halovia.location-queue.v1";

export interface JourneyTrackingState {
  status: TrackingStatus;
  coordinate: DeviceCoordinate | null;
  permission: PermissionState | "unsupported" | "unknown";
  lastDeviceUpdateAt: string | null;
  lastServerUpdateAt: string | null;
  accuracy: number | null;
  synchronising: boolean;
  online: boolean;
  retry: () => void;
}

const initialState: Omit<JourneyTrackingState, "retry"> = {
  status: "idle",
  coordinate: null,
  permission: "unknown",
  lastDeviceUpdateAt: null,
  lastServerUpdateAt: null,
  accuracy: null,
  synchronising: false,
  online: true,
};

function loadQueue(): DeviceCoordinate[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(OFFLINE_QUEUE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(validCoordinate).filter((value): value is DeviceCoordinate => Boolean(value)).slice(-LOCATION_POLICY.offlineQueueLimit);
  } catch {
    return [];
  }
}

function saveQueue(queue: DeviceCoordinate[]): void {
  try {
    if (!queue.length) sessionStorage.removeItem(OFFLINE_QUEUE_KEY);
    else sessionStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(-LOCATION_POLICY.offlineQueueLimit)));
  } catch { /* An in-memory queue remains available for this tab. */ }
}

export function clearLocationQueue(): void {
  try { sessionStorage.removeItem(OFFLINE_QUEUE_KEY); } catch { /* Nothing else to clear. */ }
}

export function useJourneyTracking(journey: BackendJourney | null, onJourneyRefresh: (journey: BackendJourney) => void): JourneyTrackingState {
  const [state, setState] = useState(initialState);
  const [restartNonce, setRestartNonce] = useState(0);
  const watcherRef = useRef<number | null>(null);
  const submittingRef = useRef(false);
  const latestSubmittedRef = useRef<(DeviceCoordinate & { serverReceivedAt?: string }) | null>(null);
  const queueRef = useRef<DeviceCoordinate[]>([]);
  const lifecycleRef = useRef(0);
  const journeyId = journey?.id ?? null;
  const trackingEnabled = Boolean(journey && journey.status === "active" && journey.sharingStatus === "active");

  const stop = useCallback((status: TrackingStatus = "paused") => {
    if (watcherRef.current !== null && "geolocation" in navigator) navigator.geolocation.clearWatch(watcherRef.current);
    watcherRef.current = null;
    lifecycleRef.current += 1;
    submittingRef.current = false;
    setState((current) => ({ ...current, status, synchronising: false }));
  }, []);

  const submit = useCallback(async (coordinate: DeviceCoordinate) => {
    if (!journeyId || submittingRef.current) return;
    if (!navigator.onLine) {
      queueRef.current = [...queueRef.current, coordinate].slice(-LOCATION_POLICY.offlineQueueLimit);
      saveQueue(queueRef.current);
      setState((current) => ({ ...current, status: "offline", online: false, synchronising: false }));
      return;
    }
    if (!shouldSubmitLocation(latestSubmittedRef.current, coordinate)) return;
    submittingRef.current = true;
    setState((current) => ({ ...current, status: "updating", synchronising: true, online: true }));
    const lifecycle = lifecycleRef.current;
    for (let attempt = 0; attempt <= LOCATION_POLICY.maximumRetryAttempts; attempt += 1) {
      try {
        const result = await haloviaApi.submitLocation(journeyId, coordinate);
        if (lifecycle !== lifecycleRef.current) return;
        submittingRef.current = false;
        if (result.accepted) {
          latestSubmittedRef.current = { ...coordinate, serverReceivedAt: result.lastServerUpdateAt ?? undefined };
          queueRef.current = [];
          saveQueue([]);
        }
        setState((current) => ({
          ...current,
          status: coordinate.accuracy > LOCATION_POLICY.poorAccuracyMetres ? "accuracy_limited" : "live",
          synchronising: false,
          lastServerUpdateAt: result.lastServerUpdateAt ?? current.lastServerUpdateAt,
        }));
        if (result.accepted) {
          const refreshed = await haloviaApi.getJourney(journeyId).catch(() => null);
          if (refreshed && lifecycle === lifecycleRef.current) onJourneyRefresh(refreshed.journey);
        }
        return;
      } catch (error) {
        if (error instanceof HaloviaApiError && [401, 409, 410].includes(error.status)) {
          submittingRef.current = false;
          stop(error.code === "sharing_inactive" ? "sharing_disabled" : "ended");
          return;
        }
        if (attempt < LOCATION_POLICY.maximumRetryAttempts) {
          await new Promise((resolve) => window.setTimeout(resolve, 1_000 * 2 ** attempt));
          if (lifecycle !== lifecycleRef.current) return;
          continue;
        }
      }
    }
    submittingRef.current = false;
    queueRef.current = [...queueRef.current, coordinate].slice(-LOCATION_POLICY.offlineQueueLimit);
    saveQueue(queueRef.current);
    setState((current) => ({ ...current, status: navigator.onLine ? "paused" : "offline", synchronising: false }));
  }, [journeyId, onJourneyRefresh, stop]);

  const retry = useCallback(() => {
    stop("finding");
    setRestartNonce((current) => current + 1);
  }, [stop]);

  useEffect(() => {
    queueRef.current = loadQueue();
    queueMicrotask(() => setState((current) => ({ ...current, online: navigator.onLine })));
    if (!trackingEnabled || !journeyId) {
      queueMicrotask(() => stop(journey?.status && journey.status !== "active" ? "ended" : journey?.sharingStatus !== "active" ? "sharing_disabled" : "idle"));
      return;
    }
    if (!("geolocation" in navigator)) {
      queueMicrotask(() => setState((current) => ({ ...current, status: "unavailable", permission: "unsupported" })));
      return;
    }
    let permissionStatus: PermissionStatus | null = null;
    const permissionChanged = () => {
      const permission = permissionStatus?.state ?? "unknown";
      setState((current) => ({ ...current, permission }));
      if (permission === "denied") stop("permission_required");
      else if (permission === "granted" && watcherRef.current === null) setRestartNonce((current) => current + 1);
    };
    navigator.permissions?.query({ name: "geolocation" }).then((result) => {
      permissionStatus = result;
      permissionChanged();
      result.addEventListener("change", permissionChanged);
    }).catch(() => undefined);
    if (watcherRef.current === null) {
      queueMicrotask(() => setState((current) => ({ ...current, status: "finding" })));
      watcherRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const coordinate = coordinateFromPosition(position);
          setState((current) => ({
            ...current,
            coordinate,
            lastDeviceUpdateAt: coordinate.deviceRecordedAt,
            accuracy: coordinate.accuracy,
            permission: "granted",
            status: navigator.onLine ? "updating" : "offline",
            online: navigator.onLine,
          }));
          void submit(coordinate);
        },
        (error) => {
          const terminal = error.code === error.PERMISSION_DENIED;
          setState((current) => ({ ...current, status: terminal ? "permission_required" : "unavailable", permission: terminal ? "denied" : current.permission }));
          if (terminal) stop("permission_required");
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
      );
    }
    const online = () => {
      setState((current) => ({ ...current, online: true, status: "updating" }));
      const newest = queueRef.current.at(-1);
      if (newest) void submit(newest);
    };
    const offline = () => setState((current) => ({ ...current, online: false, status: "offline" }));
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      permissionStatus?.removeEventListener("change", permissionChanged);
      stop("paused");
    };
  }, [journeyId, journey?.sharingStatus, journey?.status, restartNonce, stop, submit, trackingEnabled]);

  useEffect(() => {
    const lastServerUpdateAt = journey?.lastServerUpdateAt ?? null;
    queueMicrotask(() => setState((current) => current.lastServerUpdateAt === lastServerUpdateAt ? current : { ...current, lastServerUpdateAt }));
  }, [journey?.lastServerUpdateAt]);

  useEffect(() => {
    if (!trackingEnabled) return;
    const interval = window.setInterval(() => {
      setState((current) => {
        if (!current.lastServerUpdateAt || current.status === "offline") return current;
        const stale = Date.now() - new Date(current.lastServerUpdateAt).getTime() > LOCATION_POLICY.staleAfterMs;
        return stale ? { ...current, status: "stale", synchronising: false } : current;
      });
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [trackingEnabled]);

  return { ...state, retry };
}
