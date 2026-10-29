// End-to-end check of the live SOS data flow against the local emulators
// (auth, firestore, functions), with two signed-in "phones". Run with
// `npm run test:flow`. Real FCM delivery cannot be tested here: the
// emulator has no FCM credentials, so the push attempt is expected to fail
// and be recorded on the SOS document.
import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch, collection } from "firebase/firestore";

const PROJECT = "demo-halovia";
const ACK_URL = `http://127.0.0.1:5001/${PROJECT}/asia-south1/ackSosDelivery`;

async function phone(name) {
  const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT, appId: `demo-${name}` }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const { user } = await signInAnonymously(auth);
  return { app, db, uid: user.uid };
}

function waitFor(ref, predicate, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error("timed out waiting for " + ref.path)); }, timeoutMs);
    const stop = onSnapshot(ref, (snapshot) => {
      if (predicate(snapshot.data())) { clearTimeout(timer); stop(); resolve(snapshot.data()); }
    });
  });
}

test("pair, raise SOS, push attempt recorded, delivery receipt, seen, acknowledge, end", async () => {
  const a = await phone("shreya");
  const b = await phone("kavi");
  try {
    // Phone A creates a circle with an invite code (same writes as mobile/cloud/circle.ts).
    const code = "K7P2QM";
    const circleRef = doc(collection(a.db, "circles"));
    const batch = writeBatch(a.db);
    batch.set(circleRef, { ownerUid: a.uid, ownerName: "Shreya", inviteCode: code, createdAt: serverTimestamp() });
    batch.set(doc(a.db, `circles/${circleRef.id}/members/${a.uid}`), { name: "Shreya", role: "owner", pushReady: true, joinedAt: serverTimestamp() });
    batch.set(doc(a.db, `invites/${code}`), { circleId: circleRef.id, ownerUid: a.uid, ownerName: "Shreya", createdAt: serverTimestamp() });
    batch.set(doc(a.db, `users/${a.uid}`), { name: "Shreya", circleId: circleRef.id, updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();

    // Phone B joins with the code and registers its (fake) FCM token.
    const invite = await getDoc(doc(b.db, `invites/${code}`));
    assert.equal(invite.get("circleId"), circleRef.id);
    await setDoc(doc(b.db, `circles/${circleRef.id}/members/${b.uid}`), { name: "Kavi", role: "member", inviteCode: code, pushReady: true, joinedAt: serverTimestamp() });
    await setDoc(doc(b.db, `users/${b.uid}`), { name: "Kavi", circleId: circleRef.id, fcmToken: "fake-token-for-kavi", updatedAt: serverTimestamp() }, { merge: true });

    // Phone A raises the SOS.
    const sosRef = doc(collection(a.db, `circles/${circleRef.id}/sos`));
    await setDoc(sosRef, {
      senderUid: a.uid, senderName: "Shreya", status: "active", demo: true, createdAt: serverTimestamp(), clientCreatedAt: Date.now(), updatedAt: serverTimestamp(),
      location: { lat: 28.3872, lng: 77.444, accuracy: 9, at: Date.now() }, trail: [], deliveredTo: {}, seenBy: {}, ackBy: {},
    });

    // onSosCreated runs and records its push attempt for one recipient.
    const withPush = await waitFor(sosRef, (data) => Boolean(data?.push));
    assert.equal(withPush.push.recipients, 1);
    assert.equal(withPush.push.successCount, 0, "no real FCM in the emulator");

    // Phone B is listening and sees it.
    const seenOnB = await getDoc(doc(b.db, sosRef.path));
    assert.equal(seenOnB.get("senderName"), "Shreya");

    // Native delivery receipt: wrong token refused, right token accepted.
    const post = (body) => fetch(ACK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await post({ circleId: circleRef.id, sosId: sosRef.id, uid: b.uid, token: "stolen" })).status, 403);
    assert.equal((await post({ circleId: circleRef.id, sosId: sosRef.id, uid: a.uid, token: "x" })).status, 403);
    assert.equal((await post({ circleId: circleRef.id, sosId: sosRef.id, uid: b.uid, token: "fake-token-for-kavi" })).status, 204);
    await waitFor(sosRef, (data) => Boolean(data?.deliveredTo?.[b.uid]));

    // Live location from A, seen + acknowledged from B.
    await updateDoc(sosRef, { location: { lat: 28.39, lng: 77.44, accuracy: 7, at: Date.now() }, updatedAt: serverTimestamp() });
    await updateDoc(doc(b.db, sosRef.path), { [`seenBy.${b.uid}`]: { name: "Kavi", at: serverTimestamp() } });
    await updateDoc(doc(b.db, sosRef.path), { [`ackBy.${b.uid}`]: { name: "Kavi", at: serverTimestamp() } });
    const acked = await waitFor(sosRef, (data) => Boolean(data?.ackBy?.[b.uid]));
    assert.equal(acked.location.lat, 28.39);

    // Phone B ends it; A sees who ended it.
    await updateDoc(doc(b.db, sosRef.path), { status: "ended", endedBy: b.uid, endedAt: serverTimestamp() });
    const ended = await waitFor(sosRef, (data) => data?.status === "ended");
    assert.equal(ended.endedBy, b.uid);
  } finally {
    await deleteApp(a.app);
    await deleteApp(b.app);
  }
});
