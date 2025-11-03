
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
const ADMIN_UID = "p8I214dVO5fNkBpA0fsOaB2b6n82"; 

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { auth, firestore } = useFirebase()
  const router = useRouter()
  const { toast } = useToast()

  const ensureAdminUserExists = async () => {
    if (!auth || !firestore) return false;
    
    try {
        // Attempt to create the admin user. If the user already exists,
        // createUserWithEmailAndPassword will fail, and we'll catch the error.
        const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, password);

        // If creation is successful, it means the user did not exist.
        // We now have to manually set their UID to the ADMIN_UID. This is not possible directly.
        // The correct approach is to use custom claims via a backend function, but for this simplified
        // setup, we'll create an admin role document that security rules can check.
        
        // Let's create a record in a separate `roles_admin` collection.
        const adminRoleRef = doc(firestore, "roles_admin", userCredential.user.uid);
        await setDoc(adminRoleRef, { isAdmin: true });

        // And maybe a user profile doc too for consistency
        const userDocRef = doc(firestore, "users", userCredential.user.uid);
         await setDoc(userDocRef, {
            id: userCredential.user.uid,
            name: 'Admin',
            emailId: ADMIN_EMAIL,
            phone: 'N/A',
            balance: 0,
            createdAt: new Date().toISOString()
        });

        toast({ title: 'Admin Account Created', description: 'You can now log in.' });
        
        // Sign out the newly created user so they can log in properly.
        await auth.signOut();
        return true;

    } catch (error: any) {
        // If the error code is 'auth/email-already-in-use', it's okay. It means the admin user exists.
        if (error.code === 'auth/email-already-in-use') {
            return true; // Admin user exists, proceed to login.
        }
        // For other errors (e.g., weak password during first-time creation), show them.
        toast({ variant: 'destructive', title: 'Admin Setup Error', description: error.message });
        return false;
    }
  }


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth || !firestore) return

    setIsSubmitting(true)
    
    // Step 1: Ensure the admin user exists or can be created.
    const adminExists = await ensureAdminUserExists();

    if (!adminExists) {
        setIsSubmitting(false);
        return; // Stop if there was a setup error (e.g., weak password)
    }

    // Step 2: Proceed with sign-in.
    try {
      const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password)
      
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
      // This will catch invalid password errors during login.
      toast({ variant: 'destructive', title: 'Login Failed', description: 'Invalid credentials.' })
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
