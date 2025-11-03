'use client';
import { initializeFirebase } from '@/firebase';
import { FirebaseProvider } from '@/firebase/provider';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { ReactNode, useEffect, useState } from 'react';

type FirebaseClientProviderProps = {
  children: ReactNode;
};

// This provider is used to initialize Firebase on the client side.
// It ensures that Firebase is initialized only once.
export function FirebaseClientProvider({
  children,
}: FirebaseClientProviderProps) {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [firestore, setFirestore] = useState<Firestore | null>(null);

  useEffect(() => {
    const { app } = initializeFirebase();
    setAuth(getAuth(app));
    setFirestore(getFirestore(app));
  }, []);

  if (!auth || !firestore) {
    return null;
  }

  return (
    <FirebaseProvider auth={auth} firestore={firestore}>
      {children}
    </FirebaseProvider>
  );
}
