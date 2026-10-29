// Firestore security rules tests. Run with `npm test:rules` (starts the emulator).
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, deleteField, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";

let env;
const CIRCLE = "circle-a";
const CODE = "ABC234";

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-halovia",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid) => env.authenticatedContext(uid).firestore();

/** Alice creates a circle with an invite code, the way the app does. */
async function aliceCreatesCircle() {
  const db = as("alice");
  const batch = writeBatch(db);
  batch.set(doc(db, `circles/${CIRCLE}`), { ownerUid: "alice", ownerName: "Alice", inviteCode: CODE, createdAt: serverTimestamp() });
  batch.set(doc(db, `circles/${CIRCLE}/members/alice`), { name: "Alice", role: "owner", joinedAt: serverTimestamp() });
  batch.set(doc(db, `invites/${CODE}`), { circleId: CIRCLE, ownerUid: "alice", ownerName: "Alice", createdAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
}

async function bobJoins() {
  const db = as("bob");
  await assertSucceeds(getDoc(doc(db, `invites/${CODE}`)));
  await assertSucceeds(setDoc(doc(db, `circles/${CIRCLE}/members/bob`), { name: "Bob", role: "member", inviteCode: CODE, joinedAt: serverTimestamp() }));
}

const newSos = (uid, name) => ({
  senderUid: uid, senderName: name, status: "active", demo: true, createdAt: serverTimestamp(), clientCreatedAt: Date.now(), updatedAt: serverTimestamp(),
  location: { lat: 28.38, lng: 77.44, accuracy: 10, at: Date.now() }, trail: [], deliveredTo: {}, seenBy: {}, ackBy: {},
});

describe("users", () => {
  test("only the owner reads or writes their profile and token", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "users/alice"), { name: "Alice", fcmToken: "tok-a", updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(as("bob"), "users/alice")));
    await assertFails(setDoc(doc(as("bob"), "users/alice"), { name: "Mallory" }));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "users/alice")));
  });
});

describe("pairing", () => {
  test("owner creates circle, invite and own membership in one batch", aliceCreatesCircle);

  test("someone else cannot create an invite for Alice's circle", async () => {
    await aliceCreatesCircle();
    await assertFails(setDoc(doc(as("mallory"), "invites/ZZZ999"), { circleId: CIRCLE, ownerUid: "mallory", ownerName: "M", createdAt: serverTimestamp() }));
  });

  test("invites can be read by code but never listed", async () => {
    await aliceCreatesCircle();
    await assertSucceeds(getDoc(doc(as("bob"), `invites/${CODE}`)));
    await assertFails(getDocs(collection(as("bob"), "invites")));
  });

  test("joining with the right code works; a wrong code or owner role does not", async () => {
    await aliceCreatesCircle();
    await assertFails(setDoc(doc(as("bob"), `circles/${CIRCLE}/members/bob`), { name: "Bob", role: "member", inviteCode: "WRONG2", joinedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as("bob"), `circles/${CIRCLE}/members/bob`), { name: "Bob", role: "owner", inviteCode: CODE, joinedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as("bob"), `circles/${CIRCLE}/members/carol`), { name: "Carol", role: "member", inviteCode: CODE, joinedAt: serverTimestamp() }));
    await bobJoins();
  });

  test("non-members cannot read the circle or its members", async () => {
    await aliceCreatesCircle();
    await bobJoins();
    await assertSucceeds(getDocs(collection(as("bob"), `circles/${CIRCLE}/members`)));
    await assertFails(getDoc(doc(as("mallory"), `circles/${CIRCLE}`)));
    await assertFails(getDocs(collection(as("mallory"), `circles/${CIRCLE}/members`)));
  });
});

describe("sos", () => {
  beforeEach(async () => { await aliceCreatesCircle(); await bobJoins(); });
  const sosRef = (db) => doc(db, `circles/${CIRCLE}/sos/sos-1`);

  test("a member raises an SOS and every member can read it; outsiders cannot", async () => {
    await assertSucceeds(setDoc(sosRef(as("alice")), newSos("alice", "Alice")));
    await assertSucceeds(getDoc(sosRef(as("bob"))));
    await assertFails(getDoc(sosRef(as("mallory"))));
    await assertFails(getDoc(sosRef(env.unauthenticatedContext().firestore())));
  });

  test("outsiders and impersonators cannot raise an SOS", async () => {
    await assertFails(setDoc(sosRef(as("mallory")), newSos("mallory", "M")));
    await assertFails(setDoc(sosRef(as("bob")), newSos("alice", "Alice")));
    await assertFails(setDoc(sosRef(as("alice")), { ...newSos("alice", "Alice"), push: { successCount: 9 } }));
  });

  test("sender streams location; recipients cannot move it", async () => {
    await setDoc(sosRef(as("alice")), newSos("alice", "Alice"));
    await assertSucceeds(updateDoc(sosRef(as("alice")), { location: { lat: 28.39, lng: 77.45, accuracy: 8, at: Date.now() }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(sosRef(as("alice")), { location: { lat: 999, lng: 77.45 } }));
    await assertFails(updateDoc(sosRef(as("bob")), { location: { lat: 1, lng: 1, accuracy: 1, at: 1 } }));
  });

  test("recipients mark only their own delivered / seen / acknowledged entries", async () => {
    await setDoc(sosRef(as("alice")), newSos("alice", "Alice"));
    await assertSucceeds(updateDoc(sosRef(as("bob")), { "deliveredTo.bob": serverTimestamp(), "seenBy.bob": { name: "Bob", at: serverTimestamp() } }));
    await assertSucceeds(updateDoc(sosRef(as("bob")), { "ackBy.bob": { name: "Bob", at: serverTimestamp() } }));
    await assertFails(updateDoc(sosRef(as("bob")), { "seenBy.carol": { name: "Carol" } }));
    await assertFails(updateDoc(sosRef(as("bob")), { senderName: "Someone else" }));
    await assertFails(updateDoc(sosRef(as("alice")), { "seenBy.bob": deleteField() }));
  });

  test("either phone can end the SOS, but nobody can re-open it", async () => {
    await setDoc(sosRef(as("alice")), newSos("alice", "Alice"));
    await assertFails(updateDoc(sosRef(as("bob")), { status: "ended", endedBy: "alice", endedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(sosRef(as("bob")), { status: "ended", endedBy: "bob", endedAt: serverTimestamp() }));
    await assertFails(updateDoc(sosRef(as("alice")), { status: "active" }));

    await setDoc(doc(as("alice"), `circles/${CIRCLE}/sos/sos-2`), newSos("alice", "Alice"));
    await assertSucceeds(updateDoc(doc(as("alice"), `circles/${CIRCLE}/sos/sos-2`), { status: "ended", endedBy: "alice", endedAt: serverTimestamp() }));
  });

  test("a member who left loses access", async () => {
    await setDoc(sosRef(as("alice")), newSos("alice", "Alice"));
    await assertSucceeds(deleteDoc(doc(as("bob"), `circles/${CIRCLE}/members/bob`)));
    await assertFails(getDoc(sosRef(as("bob"))));
  });
});
