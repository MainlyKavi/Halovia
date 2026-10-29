import assert from "node:assert/strict";
import test from "node:test";
import { appendTrail, INVITE_ALPHABET, newInviteCode, normalizeInviteCode, recipientStatuses, sendState, type CircleMemberInfo, type LiveSos } from "./live-sos.ts";

const sos = (patch: Partial<LiveSos> = {}): LiveSos => ({
  id: "s1", circleId: "c1", senderUid: "a", senderName: "Shreya", senderPhone: null, status: "active", demo: true, createdAt: 1,
  location: null, trail: [], deliveredTo: {}, seenBy: {}, ackBy: {}, endedBy: null, push: null, pending: false, ...patch,
});
const members: CircleMemberInfo[] = [
  { uid: "a", name: "Shreya", phone: null, role: "owner", pushReady: true },
  { uid: "b", name: "Kavi Goutam", phone: null, role: "member", pushReady: true },
  { uid: "c", name: "Dad", phone: null, role: "member", pushReady: false },
];

test("invite codes use only unambiguous characters and normalise typed input", () => {
  for (let i = 0; i < 200; i += 1) {
    const code = newInviteCode();
    assert.equal(code.length, 6);
    assert.ok([...code].every((char) => INVITE_ALPHABET.includes(char)));
    assert.equal(normalizeInviteCode(code.toLowerCase()), code);
  }
  assert.equal(normalizeInviteCode("k7p 2qm"), "K7P2QM");
  assert.equal(normalizeInviteCode("K7P-2QM"), "K7P2QM");
  assert.equal(normalizeInviteCode("K7P2Q"), null);
  assert.equal(normalizeInviteCode("O0I1AB"), null);
});

test("sender sees queued offline, sending while unconfirmed, sent once the server has it", () => {
  assert.equal(sendState(sos({ pending: true }), false), "queued");
  assert.equal(sendState(sos({ pending: true }), true), "sending");
  assert.equal(sendState(sos({ pending: false }), false), "sent");
});

test("recipient status takes the strongest receipt and never lists the sender", () => {
  const statuses = recipientStatuses(sos({ deliveredTo: { b: 2, c: 2 }, seenBy: { b: 3 }, ackBy: { c: 4 } }), members);
  assert.deepEqual(statuses.map((item) => [item.uid, item.state]), [["b", "seen"], ["c", "acknowledged"]]);
  assert.deepEqual(recipientStatuses(sos(), members).map((item) => item.state), ["waiting", "waiting"]);
});

test("push failures show only once the server has tried", () => {
  const push = { recipients: 1, successCount: 1, failureCount: 0, failures: {} };
  assert.deepEqual(recipientStatuses(sos({ push }), members).map((item) => item.state), ["waiting", "pushFailed"]);
  const failed = { ...push, failures: { b: "messaging/registration-token-not-registered" } };
  assert.equal(recipientStatuses(sos({ push: failed }), members)[0].state, "pushFailed");
  assert.equal(recipientStatuses(sos({ push: failed, deliveredTo: { b: 5 } }), members)[0].state, "delivered");
});

test("trail keeps the newest points and merges jitter", () => {
  let trail = appendTrail([], { lat: 28.4, lng: 77.3, accuracy: 5, at: 1 });
  trail = appendTrail(trail, { lat: 28.40001, lng: 77.30001, accuracy: 5, at: 2 });
  assert.equal(trail.length, 1);
  assert.equal(trail[0].at, 2);
  for (let i = 1; i <= 150; i += 1) trail = appendTrail(trail, { lat: 28.4 + i * 0.001, lng: 77.3, accuracy: 5, at: i + 2 });
  assert.equal(trail.length, 100);
  assert.equal(trail[99].at, 152);
});
