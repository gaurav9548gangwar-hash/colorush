
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { useFirebase } from '@/firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'

const ADMIN_EMAIL = 'admin@tiranga.in'
const ADMIN_PASSWORD = 'gaurav@9548'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { auth, firestore } = useFirebase()
  const router = useRouter()
  const { toast } = useToast()

  const ensureAdminUserExists = async () => {
    if (!auth || !firestore) return false;
    
    try {
        // Attempt to create the admin user with the hardcoded password.
        const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        const adminRoleRef = doc(firestore, "roles_admin", userCredential.user.uid);
        await setDoc(adminRoleRef, { isAdmin: true });

        const userDocRef = doc(firestore, "users", userCredential.user.uid);
         await setDoc(userDocRef, {
            id: userCredential.user.uid,
            name: 'Admin',
            emailId: ADMIN_EMAIL,
            phone: 'N/A',
            balance: 0,
            createdAt: new Date().toISOString()
        });
        toast({ title: 'Admin Account Created', description: 'Ready to log in.' });
        await auth.signOut();
        return true;

    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            return true; // Admin user exists, proceed to login.
        }
        toast({ variant: 'destructive', title: 'Admin Setup Error', description: error.message });
        return false;
    }
  }


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth || !firestore) return

    if(password !== ADMIN_PASSWORD) {
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Invalid Password.' })
        return;
    }

    setIsSubmitting(true)
    
    const adminExists = await ensureAdminUserExists();
    if (!adminExists) {
        setIsSubmitting(false);
        return; 
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
      
      const adminRoleRef = doc(firestore, "roles_admin", userCredential.user.uid);
      const adminRoleSnap = await getDoc(adminRoleRef);

      if (adminRoleSnap.exists()) {
        toast({ title: 'Admin Login Successful' })
        router.push('/admin')
      } else {
        await auth.signOut();
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Not an authorized admin.' })
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
     <div className="flex items-center justify-center min-h-screen w-full">
        <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-primary">Admin Panel</CardTitle>
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
                {isSubmitting ? 'Logging In...' : 'Login'}
            </Button>
            </form>
        </CardContent>
        </Card>
     </div>
  )
}
