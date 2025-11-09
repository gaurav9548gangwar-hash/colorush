'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useFirebase } from '@/firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'

// This should be a strong, unique password stored securely (e.g., environment variable)
const ADMIN_PASSWORD = 'gaurav@9548' 
// This is a dedicated, non-public email for the admin user
const ADMIN_EMAIL = 'admin@colorush.in'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { auth } = useFirebase()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (password !== ADMIN_PASSWORD) {
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'The password you entered is incorrect.',
        })
        setIsSubmitting(false);
        return;
    }
    
    if (!auth) {
        toast({ variant: 'destructive', title: 'Error', description: 'Firebase not initialized.' });
        setIsSubmitting(false);
        return;
    }

    try {
        // Log in with the dedicated admin email and the provided password.
        // NOTE: The admin user MUST be created in Firebase Auth first with this email and password.
        // A simple way is to register a user with phone "admin" and the admin password.
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password)
        toast({ title: 'Admin Login Successful', description: 'Redirecting to admin panel...' });
        router.push('/admin');
    } catch (error: any) {
         toast({
            variant: 'destructive',
            title: 'Firebase Login Failed',
            description: 'Could not log into the admin Firebase account. Ensure the admin user exists in Firebase Authentication.',
        })
    } finally {
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

    