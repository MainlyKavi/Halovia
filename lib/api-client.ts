import type { ApiErrorPayload, BackendContact, BackendJourney, BackendProfile, BackendShareSession, BootstrapPayload, DeviceCoordinate, ViewerPayload } from "@/lib/api-types";

export class HaloviaApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "HaloviaApiError";
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  if (!response.ok) {
    let payload: ApiErrorPayload = { error: `Request failed with status ${response.status}.`, code: "request_failed" };
    try { payload = await response.json() as ApiErrorPayload; } catch { /* Keep the safe fallback. */ }
    throw new HaloviaApiError(response.status, payload.code, payload.error);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

export const haloviaApi = {
  bootstrap: () => api<BootstrapPayload>("/api/state"),
  updateProfile: (profile: Omit<BackendProfile, "id">) => api<{ profile: BackendProfile }>("/api/profile", { method: "PUT", body: jsonBody(profile) }),
  saveContact: (contact: Partial<BackendContact> & Pick<BackendContact, "name" | "phone">) => api<{ contact: BackendContact }>(contact.id ? `/api/contacts/${contact.id}` : "/api/contacts", { method: contact.id ? "PUT" : "POST", body: jsonBody(contact) }),
  removeContact: (id: string) => api<void>(`/api/contacts/${id}`, { method: "DELETE" }),
  createJourney: (journey: Record<string, unknown>) => api<{ journey: BackendJourney }>("/api/journeys", { method: "POST", body: jsonBody(journey) }),
  getJourney: (id: string) => api<{ journey: BackendJourney }>(`/api/journeys/${id}`),
  submitLocation: (id: string, coordinate: DeviceCoordinate) => api<{ accepted: boolean; lastServerUpdateAt: string | null }>(`/api/journeys/${id}/location`, { method: "POST", body: jsonBody({ coordinate }) }),
  updateRoute: (id: string, routeEta: string, remainingDistanceMetres: number) => api<{ routeEta: string; remainingDistanceMetres: number }>(`/api/journeys/${id}/route`, { method: "PUT", body: jsonBody({ routeEta, remainingDistanceMetres }) }),
  createShare: (id: string, lifetimeHours = 24) => api<{ session: BackendShareSession; token: string; viewerUrl: string }>(`/api/journeys/${id}/shares`, { method: "POST", body: jsonBody({ lifetimeHours }) }),
  listShares: (id: string) => api<{ sessions: BackendShareSession[] }>(`/api/journeys/${id}/shares`),
  revokeShare: (id: string, sessionId?: string) => api<void>(`/api/journeys/${id}/shares${sessionId ? `/${sessionId}` : ""}`, { method: "DELETE" }),
  safetyAction: (id: string, action: "start" | "safe" | "help" | "extend" | "expire", extra: Record<string, unknown> = {}) => api<{ journey: BackendJourney }>(`/api/journeys/${id}/safety`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: jsonBody({ action, ...extra }) }),
  endJourney: (id: string, result: "completed" | "ended") => api<{ journey: BackendJourney }>(`/api/journeys/${id}/end`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: jsonBody({ result }) }),
  uploadVehicleImage: async (id: string, file: File) => api<{ uploaded: boolean }>(`/api/journeys/${id}/vehicle-image`, { method: "PUT", headers: { "Content-Type": file.type }, body: file }),
  removeVehicleImage: (id: string) => api<void>(`/api/journeys/${id}/vehicle-image`, { method: "DELETE" }),
  viewer: (token: string, signal?: AbortSignal) => api<ViewerPayload>(`/api/view/${encodeURIComponent(token)}`, { signal }),
  submitFeedback: (category: "feedback" | "problem", message: string) => api<{ submitted: boolean }>("/api/feedback", { method: "POST", body: jsonBody({ category, message }) }),
  deleteAccount: () => api<void>("/api/account", { method: "DELETE" }),
};
