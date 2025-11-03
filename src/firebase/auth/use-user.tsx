'use client';
import { Auth, onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useAuth } from '@/firebase/provider';

// A hook that provides the user object and loading state.
export const useUser = () => {
  const auth = useAuth() as Auth;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
};
