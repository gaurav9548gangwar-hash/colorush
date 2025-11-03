
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
const ADMIN_PASSWORD = 'gangwar@9548'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { auth, firestore } = useFirebase()
  const router = useRouter()
  const { toast } = useToast()

  const ensureAdminUserExistsAndLogin = async () => {
    if (!auth || !firestore) return false;
    
    try {
      // First, try to sign in. This will work if the user already exists.
      const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      return userCredential.user;
    } catch (error: any) {
      // If sign-in fails because the user doesn't exist, create the user.
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          const newUserCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
          const adminUser = newUserCredential.user;

          // Set the admin role
          const adminRoleRef = doc(firestore, "roles_admin", adminUser.uid);
          await setDoc(adminRoleRef, { isAdmin: true });

          // Create the user profile document
          const userDocRef = doc(firestore, "users", adminUser.uid);
          await setDoc(userDocRef, {
              id: adminUser.uid,
              name: 'Admin',
              emailId: ADMIN_EMAIL,
              phone: 'N/A',
              balance: 0,
              createdAt: new Date().toISOString()
          });
          
          toast({ title: 'Admin Account Created', description: 'Your admin account is ready.' });
          // The user is already signed in after creation, so just return the user object
          return adminUser;
        } catch (creationError: any) {
          // Handle specific creation errors, like "email-already-in-use" which shouldn't happen here but as a fallback.
          toast({ variant: 'destructive', title: 'Admin Setup Failed', description: creationError.message });
          return null;
        }
      } else {
        // For any other sign-in error, show it.
        toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
        return null;
      }
    }
  }


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth || !firestore) return

    // Simple check to ensure the entered password matches the hardcoded one.
    if(password !== ADMIN_PASSWORD) {
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Invalid Password.' })
        return;
    }

    setIsSubmitting(true)
    
    const adminUser = await ensureAdminUserExistsAndLogin();
    
    if (adminUser) {
      // Final check to ensure the user has the admin role doc
      const adminRoleRef = doc(firestore, "roles_admin", adminUser.uid);
      const adminRoleSnap = await getDoc(adminRoleRef);

      if (adminRoleSnap.exists()) {
        toast({ title: 'Admin Login Successful' })
        router.push('/admin')
      } else {
        // This case can happen if the admin user exists in auth but not in firestore roles
        // Let's create the role doc just in case
        await setDoc(adminRoleRef, { isAdmin: true });
        toast({ title: 'Admin Login Successful' })
        router.push('/admin')
      }
    }
    // If adminUser is null, a toast with the error has already been shown.
    
    setIsSubmitting(false)
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
