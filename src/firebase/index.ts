import { firebaseConfig } from '@/firebase/config';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

export * from './provider';
export * from './client-provider';
export * from './auth/use-user';

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

// This function initializes Firebase and returns the app, auth, and firestore services.
// It ensures that Firebase is initialized only once.
export function initializeFirebase(): FirebaseServices {
  const apps = getApps();
  const app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
  const auth = app.auth as unknown as Auth;
  const firestore = app.firestore as unknown as Firestore;
  return { app, auth, firestore };
}
