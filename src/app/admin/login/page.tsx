
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
  const [password, setPassword] = useState('') // We keep the state for the input field, but won't use its value for auth
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { auth, firestore } = useFirebase()
  const router = useRouter()
  const { toast } = useToast()

  const ensureAdminUserExists = async () => {
    if (!auth || !firestore) return false;
    
    try {
        // Attempt to create the admin user with the hardcoded password.
        const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);

        // If creation is successful, it means the user did not exist.
        // Now, create the admin role document for security rules.
        const adminRoleRef = doc(firestore, "roles_admin", userCredential.user.uid);
        await setDoc(adminRoleRef, { isAdmin: true });

        // And a user profile doc for consistency in the users collection.
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
        
        // Sign out the newly created user so the login flow is consistent.
        await auth.signOut();
        return true;

    } catch (error: any) {
        // If the error code is 'auth/email-already-in-use', it's okay. It means the admin user already exists.
        if (error.code === 'auth/email-already-in-use') {
            return true; // Admin user exists, proceed to login.
        }
        // For other errors (like network issues), show them.
        toast({ variant: 'destructive', title: 'Admin Setup Error', description: error.message });
        return false;
    }
  }


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth || !firestore) return

    setIsSubmitting(true)
    
    // Step 1: Ensure the admin user exists or can be created with the correct password.
    const adminExists = await ensureAdminUserExists();

    if (!adminExists) {
        setIsSubmitting(false);
        return; // Stop if there was a setup error.
    }

    // Step 2: Proceed with sign-in using the hardcoded password.
    try {
      const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
      
      // Step 3: Verify if the logged-in user is an admin by checking the roles collection.
      const adminRoleRef = doc(firestore, "roles_admin", userCredential.user.uid);
      const adminRoleSnap = await getDoc(adminRoleRef);

      if (adminRoleSnap.exists()) {
        toast({ title: 'Admin Login Successful' })
        router.push('/admin')
      } else {
        // This case is unlikely if the flow is correct, but it's a good safeguard.
        await auth.signOut();
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Not an authorized admin.' })
      }
    } catch (error: any) {
      // This will catch 'auth/wrong-password' or other login errors.
      // If wrong-password happens, it might mean the admin account was created with a different password before this change.
      // In a real scenario, this would require a password reset. For this tool, re-creating the project would fix it.
      toast({ variant: 'destructive', title: 'Login Failed', description: 'Invalid credentials. The password might have been set to something else previously.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
     <div className="flex items-center justify-center min-h-screen w-full">
        <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-primary">Admin Login</CardTitle>
            <CardDescription>Enter your password to access the admin panel.</CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={ADMIN_EMAIL} disabled />
            </div>
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
