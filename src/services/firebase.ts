import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, Auth, User } from 'firebase/auth';
import firebaseAppletConfig from '../../firebase-applet-config.json';

export interface FirebaseEnvConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

// Safely merge firebase-applet-config.json and any Vite environment variables
const resolvedConfig: FirebaseEnvConfig = {
  apiKey: firebaseAppletConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: firebaseAppletConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseAppletConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  firestoreDatabaseId: firebaseAppletConfig?.firestoreDatabaseId || import.meta.env.VITE_FIREBASE_DATABASE_ID,
  storageBucket: firebaseAppletConfig?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: firebaseAppletConfig?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: firebaseAppletConfig?.appId || import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Checks whether valid Firebase credentials have been configured.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    resolvedConfig.apiKey &&
    resolvedConfig.apiKey !== 'MY_FIREBASE_API_KEY' &&
    resolvedConfig.projectId &&
    resolvedConfig.projectId !== 'MY_FIREBASE_PROJECT_ID'
  );
}

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;

/**
 * Lazily initializes and returns the Firebase app instance.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!appInstance) {
    if (getApps().length > 0) {
      appInstance = getApp();
    } else {
      appInstance = initializeApp(resolvedConfig as Record<string, string>);
    }
  }

  return appInstance;
}

/**
 * Lazily initializes and returns the Firestore instance.
 * CRITICAL: Must specify firestoreDatabaseId if provisioned with a custom database.
 */
export function getFirebaseDb(): Firestore | null {
  if (!firestoreInstance) {
    const app = getFirebaseApp();
    if (app) {
      if (resolvedConfig.firestoreDatabaseId) {
        firestoreInstance = getFirestore(app, resolvedConfig.firestoreDatabaseId);
      } else {
        firestoreInstance = getFirestore(app);
      }
    }
  }
  return firestoreInstance;
}

/**
 * Lazily initializes and returns the Firebase Auth instance.
 */
export function getFirebaseAuth(): Auth | null {
  if (!authInstance) {
    const app = getFirebaseApp();
    if (app) {
      authInstance = getAuth(app);
    }
  }
  return authInstance;
}

// Validate connection to Firestore as mandated by the Firebase skill
if (isFirebaseConfigured()) {
  setTimeout(async () => {
    try {
      const db = getFirebaseDb();
      if (db) {
        await getDocFromServer(doc(db, 'test', 'connection'));
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error('Please check your Firebase configuration.');
      }
    }
  }, 100);
}

/**
 * Ensures anonymous authentication is established (Section 5 & 6).
 * Returns the stable technical UID for the browser/participant.
 * Completely invisible to the user: no prompt, no password, no email.
 */
let anonymousAuthPromise: Promise<string> | null = null;

export async function ensureAnonymousAuth(): Promise<string> {
  // If Firebase is not configured, fallback to stable local device identifier
  if (!isFirebaseConfigured()) {
    const LOCAL_KEY = 'decide_ai_local_anon_uid';
    let localUid = localStorage.getItem(LOCAL_KEY);
    if (!localUid) {
      localUid = 'anon_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(LOCAL_KEY, localUid);
    }
    return localUid;
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase Auth não pôde ser inicializado.');
  }

  // Reuse currently authenticated user UID if present
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }

  // Prevent multiple simultaneous anonymous sign-in attempts
  if (!anonymousAuthPromise) {
    anonymousAuthPromise = new Promise<string>((resolve, reject) => {
      let isSettled = false;

      const unsubscribe = onAuthStateChanged(
        auth,
        async (user: User | null) => {
          if (isSettled) return;
          if (user) {
            isSettled = true;
            unsubscribe();
            resolve(user.uid);
          } else {
            try {
              const cred = await signInAnonymously(auth);
              isSettled = true;
              unsubscribe();
              resolve(cred.user.uid);
            } catch (err) {
              isSettled = true;
              unsubscribe();
              anonymousAuthPromise = null;
              console.error('[DECIDE AÍ] Erro ao autenticar anonimamente:', err);
              reject(err);
            }
          }
        },
        (err) => {
          if (isSettled) return;
          isSettled = true;
          unsubscribe();
          anonymousAuthPromise = null;
          reject(err);
        }
      );
    });
  }

  return anonymousAuthPromise;
}

/**
 * Returns the current authenticated Firebase user, or null if not yet signed in.
 */
export function getCurrentAuthUser(): User | null {
  const auth = getFirebaseAuth();
  return auth?.currentUser || null;
}

// Export db getter as default for convenience
export const db = isFirebaseConfigured() ? getFirebaseDb() : null;

// Error handling types and helpers as required by the Firebase integration standard
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    isAnonymous?: boolean | null;
  };
  timestamp: string;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const auth = getFirebaseAuth();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    timestamp: new Date().toISOString(),
  };

  console.error('[DECIDE AÍ - Firestore Security Error]', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}
