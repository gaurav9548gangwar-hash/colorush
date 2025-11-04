'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useFirebase } from '@/firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth'

const ADMIN_EMAIL = 'admin@tiranga.in'
const ADMIN_PASSWORD = 'gaurav@9548'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { auth, user, isUserLoading } = useFirebase()

  // Redirect if admin is already logged in
  useEffect(() => {
    if (!isUserLoading && user) {
        // A simple check to see if the logged-in user is the admin.
        // For a more robust solution, you might check custom claims or a specific UID.
        if (user.email === ADMIN_EMAIL) {
            router.replace('/admin');
        }
    }
  }, [user, isUserLoading, router]);


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
      return
    }

    if (!auth) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firebase is not initialized.',
      })
      setIsSubmitting(false)
      return
    }

    try {
      // First, try to sign in
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
      toast({ title: 'Login Successful' })
      router.push('/admin')
    } catch (error: any) {
      // If user does not exist, create a new account
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
          toast({ title: 'Admin Account Created & Logged In' })
          router.push('/admin')
        } catch (createError: any) {
          toast({
            variant: 'destructive',
            title: 'Account Creation Failed',
            description: createError.message,
          })
        }
      } else {
        // Handle other errors like wrong password (though we checked it locally) or network issues
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: error.message,
        })
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
