import { initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, indexedDBLocalPersistence, initializeAuth, inMemoryPersistence, onAuthStateChanged, signInAnonymously, type Auth, type User } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, persistentLocalCache, type Firestore } from "firebase/firestore";
import { nativeStatus } from "../native";

// Firebase for the live SOS. Config comes from, in order:
//   1. VITE_FIREBASE_* in .env.local, dev server only (browser testing; never
//      committed, and never baked into an APK)
//   2. android/app/google-services.json, read back through the native plugin
// With neither, the app runs exactly as before and live SOS shows "not set up".

export interface Cloud {
  auth: Auth;
  db: Firestore;
  projectId: string;
}

function envOptions(): FirebaseOptions | null {
  if (!import.meta.env.DEV) return null;
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY as string | undefined;
  const projectId = env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (!apiKey || !projectId) return null;
  return { apiKey, projectId, authDomain: `${projectId}.firebaseapp.com`, appId: env.VITE_FIREBASE_APP_ID as string | undefined, messagingSenderId: env.VITE_FIREBASE_SENDER_ID as string | undefined };
}

async function nativeOptions(): Promise<FirebaseOptions | null> {
  const firebase = (await nativeStatus())?.firebase;
  if (!firebase?.apiKey || !firebase.projectId) return null;
  return { apiKey: firebase.apiKey, projectId: firebase.projectId, authDomain: `${firebase.projectId}.firebaseapp.com`, appId: firebase.appId, messagingSenderId: firebase.senderId };
}

let cloud: Promise<Cloud | null> | null = null;

/** The Firebase app, or null when this build has no Firebase config. */
export function getCloud(): Promise<Cloud | null> {
  cloud ??= (async () => {
    const options = envOptions() ?? (await nativeOptions());
    if (!options?.projectId) return null;
    const app = initializeApp(options);
    let auth: Auth;
    try { auth = initializeAuth(app, { persistence: indexedDBLocalPersistence }); } catch { auth = initializeAuth(app, { persistence: inMemoryPersistence }); }
    // The persistent cache is what queues an SOS written with no network and
    // sends it when the connection returns, even after an app restart.
    let db: Firestore;
    try { db = initializeFirestore(app, { localCache: persistentLocalCache() }); } catch { db = initializeFirestore(app, { localCache: memoryLocalCache() }); }
    const emulator = import.meta.env.DEV ? (import.meta.env.VITE_FIREBASE_EMULATOR_HOST as string | undefined) : undefined;
    if (emulator) {
      connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true });
      connectFirestoreEmulator(db, emulator, 8080);
    }
    return { auth, db, projectId: options.projectId };
  })().catch(() => null);
  return cloud;
}

/**
 * Anonymous sign-in: each phone gets a stable user id with no account to
 * create. Needs the network once; afterwards the session is kept on the device.
 */
export function watchUser(auth: Auth, onUser: (user: User | null) => void): () => void {
  let retry: number | null = null;
  const attempt = () => {
    if (auth.currentUser) return;
    signInAnonymously(auth).catch(() => {
      if (retry === null) retry = window.setTimeout(() => { retry = null; attempt(); }, 5_000);
    });
  };
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    onUser(user);
    if (!user) attempt();
  });
  window.addEventListener("online", attempt);
  return () => {
    unsubscribe();
    window.removeEventListener("online", attempt);
    if (retry !== null) window.clearTimeout(retry);
  };
}
