import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { createContext, ReactNode, useContext } from 'react';

type FirebaseContextValue = {
  auth: Auth | null;
  firestore: Firestore | null;
};

// This context is used to provide the Firebase auth and firestore instances to the app.
export const FirebaseContext = createContext<FirebaseContextValue>({
  auth: null,
  firestore: null,
});

type FirebaseProviderProps = {
  children: ReactNode;
  auth: Auth;
  firestore: Firestore;
};

// This provider is used to wrap the app and provide the Firebase auth and firestore instances.
export function FirebaseProvider({
  children,
  auth,
  firestore,
}: FirebaseProviderProps) {
  return (
    <FirebaseContext.Provider value={{ auth, firestore }}>
      {children}
    </FirebaseContext.Provider>
  );
}

// These hooks are used to access the Firebase auth and firestore instances.
export const useFirebase = () => useContext(FirebaseContext);
export const useAuth = () => useContext(FirebaseContext).auth;
export const useFirestore = () => useContext(FirebaseContext).firestore;
