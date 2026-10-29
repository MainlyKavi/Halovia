import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging, type Message } from "firebase-admin/messaging";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

// Phones cannot send FCM pushes to each other (sending needs a server
// credential), so these three small functions do it:
//   onSosCreated     push "sos" to every other circle member
//   onSosEnded       push "sos_end" so their alarm and notification stop
//   ackSosDelivery   the receiving phone's native code reports "Delivered"
//
// REGION must match your Firestore database location (README: asia-south1).
const REGION = "asia-south1";
setGlobalOptions({ region: REGION, maxInstances: 5 });

initializeApp();
const db = getFirestore();

interface Recipient { uid: string; token: string }

async function recipientsFor(circleId: string, senderUid: string): Promise<Recipient[]> {
  const members = await db.collection(`circles/${circleId}/members`).get();
  const uids = members.docs.map((member) => member.id).filter((uid) => uid !== senderUid);
  if (!uids.length) return [];
  const users = await db.getAll(...uids.map((uid) => db.doc(`users/${uid}`)));
  return users.flatMap((user) => {
    const token = user.get("fcmToken");
    return typeof token === "string" && token ? [{ uid: user.id, token }] : [];
  });
}

function projectId(): string {
  return process.env.GCLOUD_PROJECT ?? JSON.parse(process.env.FIREBASE_CONFIG ?? "{}").projectId ?? "";
}

/** Where the receiving phone posts its delivery receipt. */
function ackUrl(): string {
  if (process.env.FUNCTIONS_EMULATOR === "true") return `http://10.0.2.2:5001/${projectId()}/${REGION}/ackSosDelivery`;
  return `https://${REGION}-${projectId()}.cloudfunctions.net/ackSosDelivery`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`FCM send timed out after ${ms} ms`)), ms))]);
}

/**
 * Data-only, high-priority messages: Android wakes the app's own
 * HaloviaMessagingService even when the app is closed or the phone is
 * locked, and that service shows the full-screen alarm notification.
 */
async function sendToAll(recipients: Recipient[], data: Record<string, string>) {
  const messages: Message[] = recipients.map(({ uid, token }) => ({
    token,
    data: { ...data, recipientUid: uid },
    android: { priority: "high", ttl: 10 * 60 * 1_000 },
  }));
  // The emulator has no FCM credentials (the send would hang on them), and
  // a stuck send must never stop the SOS from being marked as attempted.
  if (process.env.FUNCTIONS_EMULATOR === "true") throw new Error("FCM is not available in the emulator");
  const response = await withTimeout(getMessaging().sendEach(messages), 15_000);
  const failures: Record<string, string> = {};
  await Promise.all(response.responses.map(async (result, index) => {
    if (result.success) return;
    const { uid } = recipients[index];
    const code = result.error?.code ?? "unknown";
    failures[uid] = code;
    // A reinstalled or logged-out app: forget the dead token.
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
      await db.doc(`users/${uid}`).update({ fcmToken: FieldValue.delete() }).catch(() => undefined);
    }
  }));
  return { successCount: response.successCount, failureCount: response.failureCount, failures };
}

export const onSosCreated = onDocumentCreated("circles/{circleId}/sos/{sosId}", async (event) => {
  const sos = event.data?.data();
  if (!sos) return;
  const { circleId, sosId } = event.params;
  const recipients = await recipientsFor(circleId, sos.senderUid);
  const location = sos.location as { lat?: number; lng?: number } | null | undefined;
  let push: Record<string, unknown> = { recipients: recipients.length, successCount: 0, failureCount: 0, failures: {} };
  if (recipients.length) {
    try {
      push = {
        recipients: recipients.length,
        ...(await sendToAll(recipients, {
          type: "sos",
          circleId,
          sosId,
          senderName: String(sos.senderName ?? "Someone"),
          demo: sos.demo ? "1" : "0",
          lat: location?.lat !== undefined ? String(location.lat) : "",
          lng: location?.lng !== undefined ? String(location.lng) : "",
          ackUrl: ackUrl(),
        })),
      };
    } catch (error) {
      logger.error("SOS push failed", { circleId, sosId, error });
      push = { ...push, error: error instanceof Error ? error.message : String(error) };
    }
  }
  logger.info("SOS push", { circleId, sosId, ...push });
  await event.data?.ref.update({ push: { ...push, at: FieldValue.serverTimestamp() } });
});

export const onSosEnded = onDocumentUpdated("circles/{circleId}/sos/{sosId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status || after.status !== "ended") return;
  const { circleId, sosId } = event.params;
  const recipients = await recipientsFor(circleId, after.senderUid);
  if (!recipients.length) return;
  try {
    await sendToAll(recipients, { type: "sos_end", circleId, sosId });
  } catch (error) {
    logger.warn("SOS end push failed", { circleId, sosId, error });
  }
});

const ID = /^[A-Za-z0-9_-]{1,128}$/u;

/**
 * Delivery receipt from the receiving phone's native push handler, which has
 * no Firebase Auth session. The phone proves who it is with its own FCM
 * token, which only the Admin SDK can read (users/{uid} is private).
 */
export const ackSosDelivery = onRequest({ cors: false }, async (request, response) => {
  if (request.method !== "POST") { response.status(405).end(); return; }
  const { circleId, sosId, uid, token } = (request.body ?? {}) as Record<string, unknown>;
  if (![circleId, sosId, uid].every((value) => typeof value === "string" && ID.test(value)) || typeof token !== "string" || !token) {
    response.status(400).end();
    return;
  }
  const [user, member, sosSnap] = await db.getAll(db.doc(`users/${uid}`), db.doc(`circles/${circleId}/members/${uid}`), db.doc(`circles/${circleId}/sos/${sosId}`));
  if (user.get("fcmToken") !== token || !member.exists || !sosSnap.exists || sosSnap.get("senderUid") === uid) {
    response.status(403).end();
    return;
  }
  if (!sosSnap.get(`deliveredTo.${uid}`)) await sosSnap.ref.update({ [`deliveredTo.${uid}`]: FieldValue.serverTimestamp() });
  response.status(204).end();
});
