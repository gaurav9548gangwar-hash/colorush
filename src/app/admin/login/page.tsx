
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useFirebase } from '@/firebase'

const ADMIN_EMAIL = 'admin@tiranga.in'
const ADMIN_UID = "p8I214dVO5fNkBpA0fsOaB2b6n82"; // Replace with your actual admin UID

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { auth } = useFirebase()
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth) return

    setIsSubmitting(true)
    try {
      const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password)
      
      if (userCredential.user.uid === ADMIN_UID) {
        toast({ title: 'Admin Login Successful' })
        router.push('/admin')
      } else {
        await auth.signOut();
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Not an admin user.' })
      }
    } catch (error: any) {
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
