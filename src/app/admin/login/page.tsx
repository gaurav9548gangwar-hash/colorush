'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useFirebase } from '@/firebase'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, User } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'

const ADMIN_EMAIL = 'admin@tiranga.in'
const ADMIN_PASSWORD = 'gaurav@9548'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { auth, firestore } = useFirebase()

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === ADMIN_EMAIL) {
        router.replace('/admin');
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    if (password !== ADMIN_PASSWORD) {
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'The password you entered is incorrect.',
        })
        setIsSubmitting(false)
        return;
    }

    if (!auth || !firestore) {
        toast({ variant: 'destructive', title: 'Firebase not available'})
        setIsSubmitting(false)
        return;
    }
    
    const ensureAdminRole = async (user: User) => {
        // This is critical. It creates a document in `roles_admin`
        // which grants the user admin privileges via security rules.
        const adminRoleRef = doc(firestore, "roles_admin", user.uid);
        await setDoc(adminRoleRef, { uid: user.uid });
    };

    try {
        const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
        await ensureAdminRole(userCredential.user);
        toast({ title: 'Login Successful' });
        router.push('/admin');
    } catch (error: any) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, password);
                await ensureAdminRole(userCredential.user);
                toast({ title: 'Admin account created. Logging in.' });
                router.push('/admin');
            } catch (creationError: any) {
                toast({
                    variant: 'destructive',
                    title: 'Account Creation Failed',
                    description: creationError.message,
                });
            }
        } else {
            toast({
                variant: 'destructive',
                title: 'Login Failed',
                description: error.message,
            });
        }
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Admin Panel Lock</CardTitle>
          <CardDescription>Enter the password to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Unlocking...' : 'Unlock'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
