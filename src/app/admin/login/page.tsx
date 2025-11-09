'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useFirebase } from '@/firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'

const ADMIN_EMAIL = 'admin@colorush.in'
const ADMIN_PASSWORD = 'gaurav@9548'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { auth } = useFirebase()

  useEffect(() => {
    // On mount, check if admin is already logged in via session storage
    if (sessionStorage.getItem('isAdminLoggedIn') === 'true') {
        router.replace('/admin');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    if (password === ADMIN_PASSWORD) {
        if (auth) {
          try {
            // We sign in with a dedicated admin email to manage the session
            await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
            sessionStorage.setItem('isAdminLoggedIn', 'true');
            toast({ title: 'Admin Login Successful', description: 'Redirecting to admin panel...' });
            router.push('/admin');

          } catch (error: any) {
            // If admin user doesn't exist, this will fail. For this app, we assume it does or can be created.
             if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                 toast({ variant: 'destructive', title: 'Admin Login Failed', description: 'Admin user not found or wrong credentials. Please check Firebase Auth.' });
            } else {
                console.error("Admin sign-in error: ", error);
                toast({ variant: 'destructive', title: 'Admin Login Failed', description: 'An unexpected error occurred. Check console.' });
            }
            setIsSubmitting(false);
          }
        } else {
            toast({ variant: 'destructive', title: 'Auth Not Ready', description: 'Firebase Auth is not available. Please try again.' });
            setIsSubmitting(false);
        }
    } else {
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'The password you entered is incorrect.',
        })
        setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Admin Panel Login</CardTitle>
          <CardDescription>Enter the password to access the admin panel.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Admin Password</Label>
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
              {isSubmitting ? 'Logging In...' : 'Login to Admin Panel'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
