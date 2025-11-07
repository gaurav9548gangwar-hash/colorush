'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useFirebase } from '@/firebase'
import { doc, updateDoc } from 'firebase/firestore'

const ADMIN_PASSWORD = 'gaurav@9548'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { user, firestore } = useFirebase()

  useEffect(() => {
    if (sessionStorage.getItem('isAdminLoggedIn') === 'true') {
      router.replace('/admin');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    if (password === ADMIN_PASSWORD) {
        toast({ title: 'Login Successful' });
        sessionStorage.setItem('isAdminLoggedIn', 'true');

        // Check if user is logged in and make them admin if they are not already
        if (user && firestore) {
          try {
            const userRef = doc(firestore, 'users', user.uid);
            await updateDoc(userRef, { isAdmin: true });
            toast({ title: 'Admin Status Granted', description: 'Your account now has admin privileges.' });
          } catch (error) {
            console.error("Error granting admin status: ", error);
            toast({ variant: 'destructive', title: 'Admin Grant Failed', description: 'Could not set admin status in Firestore.' });
          }
        } else if (!user) {
            toast({ variant: 'destructive', title: 'User Not Logged In', description: 'Please log in as a regular user first before accessing the admin panel.' });
            router.push('/login');
            setIsSubmitting(false);
            return;
        }

        router.push('/admin');
    } else {
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'The password you entered is incorrect.',
        })
    }
    
    setIsSubmitting(false);
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
