import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, type DocumentSnapshot, type Firestore } from "firebase/firestore";
import { SOS_STALE_MS, type LivePoint, type LiveSos } from "@/lib/ride/live-sos";
import { resilient } from "./circle";

// SOS events live at circles/{circleId}/sos/{sosId}. Writes are never awaited
// for the UI: Firestore applies them locally at once, queues them while
// offline, and retries until the server confirms. The snapshot's
// hasPendingWrites flag is what the sender's screen shows as "queued".

const millis = (value: unknown): number | null => (value instanceof Timestamp ? value.toMillis() : typeof value === "number" ? value : null);

function timeMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([uid, entry]) => [uid, millis(entry && typeof entry === "object" && "at" in entry ? (entry as { at: unknown }).at : entry) ?? Date.now()]));
}

function point(value: unknown): LivePoint | null {
  const data = value as Partial<LivePoint> | null | undefined;
  return data && typeof data.lat === "number" && typeof data.lng === "number" ? { lat: data.lat, lng: data.lng, accuracy: typeof data.accuracy === "number" ? data.accuracy : null, at: millis(data.at) ?? Date.now() } : null;
}

export function toLiveSos(snapshot: DocumentSnapshot, circleId: string): LiveSos | null {
  const data = snapshot.data({ serverTimestamps: "estimate" });
  if (!data) return null;
  const push = data.push as LiveSos["push"] | undefined;
  return {
    id: snapshot.id,
    circleId,
    senderUid: String(data.senderUid),
    senderName: String(data.senderName ?? ""),
    senderPhone: typeof data.senderPhone === "string" ? data.senderPhone : null,
    status: data.status === "ended" ? "ended" : "active",
    demo: data.demo === true,
    createdAt: millis(data.createdAt) ?? millis(data.clientCreatedAt) ?? Date.now(),
    location: point(data.location),
    trail: Array.isArray(data.trail) ? data.trail.map(point).filter((item): item is LivePoint => item !== null) : [],
    deliveredTo: timeMap(data.deliveredTo),
    seenBy: timeMap(data.seenBy),
    ackBy: timeMap(data.ackBy),
    endedBy: typeof data.endedBy === "string" ? data.endedBy : null,
    push: push ? { recipients: push.recipients ?? 0, successCount: push.successCount ?? 0, failureCount: push.failureCount ?? 0, failures: push.failures ?? {}, error: push.error } : null,
    pending: snapshot.metadata.hasPendingWrites,
  };
}

export interface NewSos { senderUid: string; senderName: string; senderPhone: string; demo: boolean; location: LivePoint | null }

/** Creates the SOS (queued if offline) and returns its id straight away. */
export function createSos(db: Firestore, circleId: string, input: NewSos, onRejected: (error: unknown) => void): string {
  const ref = doc(collection(db, `circles/${circleId}/sos`));
  const location = input.location ? { ...input.location, accuracy: input.location.accuracy ?? 0 } : null;
  setDoc(ref, {
    senderUid: input.senderUid,
    senderName: input.senderName.trim().slice(0, 60) || "Halovia user",
    ...(input.senderPhone.trim() ? { senderPhone: input.senderPhone.trim().slice(0, 20) } : {}),
    status: "active",
    demo: input.demo,
    createdAt: serverTimestamp(),
    clientCreatedAt: Date.now(),
    updatedAt: serverTimestamp(),
    location,
    trail: location ? [location] : [],
    deliveredTo: {},
    seenBy: {},
    ackBy: {},
  }).catch(onRejected);
  return ref.id;
}

export function updateSosLocation(db: Firestore, circleId: string, sosId: string, location: LivePoint, trail: LivePoint[]): void {
  const clean = (item: LivePoint) => ({ lat: item.lat, lng: item.lng, accuracy: item.accuracy ?? 0, at: item.at });
  updateDoc(doc(db, `circles/${circleId}/sos/${sosId}`), { location: clean(location), trail: trail.map(clean), updatedAt: serverTimestamp() }).catch(() => undefined);
}

export function endSos(db: Firestore, circleId: string, sosId: string, uid: string): void {
  updateDoc(doc(db, `circles/${circleId}/sos/${sosId}`), { status: "ended", endedBy: uid, endedAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(() => undefined);
}

export type Receipt = "deliveredTo" | "seenBy" | "ackBy";

export function markReceipt(db: Firestore, circleId: string, sosId: string, uid: string, receipt: Receipt, name: string): void {
  const value = receipt === "deliveredTo" ? serverTimestamp() : { name: name.slice(0, 60), at: serverTimestamp() };
  updateDoc(doc(db, `circles/${circleId}/sos/${sosId}`), { [`${receipt}.${uid}`]: value }).catch(() => undefined);
}

export function watchSos(db: Firestore, circleId: string, sosId: string, onSos: (sos: LiveSos | null) => void): () => void {
  return resilient((onError) => onSnapshot(doc(db, `circles/${circleId}/sos/${sosId}`), { includeMetadataChanges: true }, (snapshot) => onSos(toLiveSos(snapshot, circleId)), onError));
}

/** Active SOS events in the circle, newest first, ignoring ones abandoned long ago. */
export function watchActiveSos(db: Firestore, circleId: string, onList: (list: LiveSos[]) => void): () => void {
  return resilient((onError) => onSnapshot(query(collection(db, `circles/${circleId}/sos`), where("status", "==", "active")), (snapshot) => {
    const now = Date.now();
    onList(snapshot.docs.map((item) => toLiveSos(item, circleId)).filter((sos): sos is LiveSos => sos !== null && now - sos.createdAt < SOS_STALE_MS).sort((a, b) => b.createdAt - a.createdAt));
  }, onError));
}
