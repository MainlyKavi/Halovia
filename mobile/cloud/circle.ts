import { collection, deleteDoc, deleteField, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch, type Firestore } from "firebase/firestore";
import { newInviteCode, normalizeInviteCode, type CircleMemberInfo } from "@/lib/ride/live-sos";

// Pairing: one phone creates a circle and shows a 6-character invite code;
// the other phone types it in. Each phone is in at most one circle, so
// "the people who get my SOS" is always just the rest of that circle.

export interface CircleInfo { id: string; ownerUid: string; ownerName: string; inviteCode: string }

export interface Profile { name: string; phone: string; pushReady: boolean }

export class PairingError extends Error {
  constructor(readonly reason: "invalidCode" | "notFound" | "network") { super(reason); }
}

const memberFields = (profile: Profile) => ({
  name: profile.name.trim().slice(0, 60) || "Halovia user",
  ...(profile.phone.trim() ? { phone: profile.phone.trim().slice(0, 20) } : {}),
  pushReady: profile.pushReady,
});

export async function createCircle(db: Firestore, uid: string, profile: Profile, previousCircleId: string | null): Promise<string> {
  if (previousCircleId) await leaveCircle(db, uid, previousCircleId);
  const circleRef = doc(collection(db, "circles"));
  const name = memberFields(profile).name;
  // A code clash makes the invite write an update, which the rules refuse;
  // try a fresh code a few times before giving up.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = newInviteCode();
    const batch = writeBatch(db);
    batch.set(circleRef, { ownerUid: uid, ownerName: name, inviteCode: code, createdAt: serverTimestamp() });
    batch.set(doc(db, `circles/${circleRef.id}/members/${uid}`), { ...memberFields(profile), role: "owner", joinedAt: serverTimestamp() });
    batch.set(doc(db, `invites/${code}`), { circleId: circleRef.id, ownerUid: uid, ownerName: name, createdAt: serverTimestamp() });
    batch.set(doc(db, `users/${uid}`), { name, circleId: circleRef.id, updatedAt: serverTimestamp() }, { merge: true });
    try {
      await batch.commit();
      return circleRef.id;
    } catch (error) {
      if ((error as { code?: string }).code !== "permission-denied") throw new PairingError("network");
    }
  }
  throw new PairingError("network");
}

export async function joinCircle(db: Firestore, uid: string, input: string, profile: Profile, previousCircleId: string | null): Promise<string> {
  const code = normalizeInviteCode(input);
  if (!code) throw new PairingError("invalidCode");
  let circleId: string;
  try {
    const invite = await getDoc(doc(db, `invites/${code}`));
    if (!invite.exists()) throw new PairingError("notFound");
    circleId = String(invite.get("circleId"));
  } catch (error) {
    throw error instanceof PairingError ? error : new PairingError("network");
  }
  if (previousCircleId === circleId) return circleId;
  if (previousCircleId) await leaveCircle(db, uid, previousCircleId);
  try {
    await setDoc(doc(db, `circles/${circleId}/members/${uid}`), { ...memberFields(profile), role: "member", inviteCode: code, joinedAt: serverTimestamp() });
    await setDoc(doc(db, `users/${uid}`), { name: memberFields(profile).name, circleId, updatedAt: serverTimestamp() }, { merge: true });
  } catch {
    throw new PairingError("network");
  }
  return circleId;
}

export async function leaveCircle(db: Firestore, uid: string, circleId: string): Promise<void> {
  await deleteDoc(doc(db, `circles/${circleId}/members/${uid}`)).catch(() => undefined);
  await setDoc(doc(db, `users/${uid}`), { circleId: deleteField(), updatedAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
}

/** Keeps the name, phone and "can receive push" flag the circle sees up to date. */
export async function updateMyMember(db: Firestore, uid: string, circleId: string, profile: Profile): Promise<void> {
  await updateDoc(doc(db, `circles/${circleId}/members/${uid}`), { ...memberFields(profile), ...(profile.phone.trim() ? {} : { phone: deleteField() }), updatedAt: serverTimestamp() });
}

export async function saveFcmToken(db: Firestore, uid: string, token: string): Promise<void> {
  await setDoc(doc(db, `users/${uid}`), { fcmToken: token, platform: "android", updatedAt: serverTimestamp() }, { merge: true });
}

export function watchMyCircleId(db: Firestore, uid: string, onCircleId: (circleId: string | null) => void): () => void {
  return onSnapshot(doc(db, `users/${uid}`), (snapshot) => {
    // Only trust what the server has: a local, unconfirmed circleId would
    // start the circle listeners before the membership exists there.
    if (snapshot.metadata.hasPendingWrites) return;
    const circleId = snapshot.get("circleId");
    onCircleId(typeof circleId === "string" && circleId ? circleId : null);
  }, () => onCircleId(null));
}

/**
 * A Firestore listener that resubscribes after an error (a listener that
 * errors is dead). Covers a membership the server has not seen yet and
 * dropped connections. Backs off up to 30 seconds.
 */
export function resilient(subscribe: (onError: () => void) => () => void): () => void {
  let stopped = false;
  let delay = 1_000;
  let timer: number | null = null;
  let stop = () => undefined as void;
  const start = () => {
    stop = subscribe(() => {
      if (stopped) return;
      stop();
      timer = window.setTimeout(start, delay);
      delay = Math.min(delay * 2, 30_000);
    });
  };
  start();
  return () => { stopped = true; if (timer !== null) window.clearTimeout(timer); stop(); };
}

export function watchCircle(db: Firestore, circleId: string, onCircle: (circle: CircleInfo | null) => void, onMembers: (members: CircleMemberInfo[]) => void): () => void {
  const stopCircle = resilient((onError) => onSnapshot(doc(db, `circles/${circleId}`), (snapshot) => {
    const data = snapshot.data();
    onCircle(data ? { id: snapshot.id, ownerUid: String(data.ownerUid), ownerName: String(data.ownerName ?? ""), inviteCode: String(data.inviteCode ?? "") } : null);
  }, onError));
  const stopMembers = resilient((onError) => onSnapshot(collection(db, `circles/${circleId}/members`), (snapshot) => {
    onMembers(snapshot.docs.map((member) => {
      const data = member.data();
      return { uid: member.id, name: String(data.name ?? ""), phone: typeof data.phone === "string" ? data.phone : null, role: data.role === "owner" ? "owner" : "member", pushReady: data.pushReady === true };
    }));
  }, onError));
  return () => { stopCircle(); stopMembers(); };
}
