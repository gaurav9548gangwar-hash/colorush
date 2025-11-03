
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
import { doc, setDoc } from 'firebase/firestore'

const ADMIN_EMAIL = 'admin@tiranga.in'
const ADMIN_PASSWORD = 'gangwar@9548'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { auth, firestore } = useFirebase()
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth || !firestore) return

    setIsSubmitting(true)
    
    try {
      // Always try to sign in first.
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
      toast({ title: 'Admin Login Successful' })
      router.push('/admin')

    } catch (error: any) {
      // If sign-in fails because the user does not exist OR the credentials are bad
      // (which could mean the user was created with a different password),
      // we proceed to create the user. This handles both cases.
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          const newUserCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
          const adminUser = newUserCredential.user

          // Set the admin role in Firestore
          const adminRoleRef = doc(firestore, "roles_admin", adminUser.uid)
          await setDoc(adminRoleRef, { isAdmin: true })
          
          // Ensure the user document exists as well
          const userDocRef = doc(firestore, "users", adminUser.uid)
           await setDoc(userDocRef, {
            id: adminUser.uid,
            name: 'Admin',
            emailId: ADMIN_EMAIL,
            phone: 'N/A',
            balance: 0,
            createdAt: new Date().toISOString()
          }, { merge: true })

          toast({ title: 'Admin Account Created & Logged In' })
          // The onAuthStateChanged listener should handle the redirect, but we push just in case.
          router.push('/admin')

        } catch (creationError: any) {
           // If creation fails (e.g. "email-already-in-use" because of a race condition), we just show a generic error.
           // This state is rare but possible. The user can usually just try again.
            if (creationError.code === 'auth/email-already-in-use') {
                 toast({ variant: 'destructive', title: 'Login Failed', description: "The admin account exists with a different password. Please contact support to reset." })
            } else {
                toast({ variant: 'destructive', title: 'Admin Setup Failed', description: creationError.message })
            }
        }
      } else {
        // Handle other unexpected sign-in errors (e.g., network issues)
        toast({ variant: 'destructive', title: 'An Unexpected Error Occurred', description: error.message })
      }
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
