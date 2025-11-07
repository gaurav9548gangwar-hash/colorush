'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useFirebase } from '@/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

const ADMIN_PASSWORD = 'gaurav@9548'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { user, isUserLoading, firestore } = useFirebase()

  useEffect(() => {
    if (isUserLoading) return; // Wait until user status is determined

    // If user is not logged in at all, redirect to main login
    if (!user) {
        toast({ variant: 'destructive', title: 'Login Required', description: 'Please log in as a user first to access the admin area.' });
        router.replace('/login');
        return;
    }

    // If already an admin (session is set), go to admin dashboard
    if (sessionStorage.getItem('isAdminLoggedIn') === 'true') {
        router.replace('/admin');
        return;
    }
    
  }, [user, isUserLoading, router, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    if (password === ADMIN_PASSWORD) {
        // User must be logged in to proceed
        if (user && firestore) {
          try {
            const userRef = doc(firestore, 'users', user.uid);
            // Check if user is already an admin in firestore
            const userDoc = await getDoc(userRef);
            if (!userDoc.exists() || !userDoc.data()?.isAdmin) {
                // If not an admin, grant admin rights
                await updateDoc(userRef, { isAdmin: true });
                toast({ title: 'Admin Status Granted!', description: 'Your account now has admin privileges. Redirecting...' });
            } else {
                 toast({ title: 'Admin Access Confirmed', description: 'Redirecting to admin panel...' });
            }

            sessionStorage.setItem('isAdminLoggedIn', 'true');
            router.push('/admin');

          } catch (error) {
            console.error("Error granting admin status: ", error);
            toast({ variant: 'destructive', title: 'Admin Grant Failed', description: 'Could not set admin status in Firestore. Check console.' });
            setIsSubmitting(false);
          }
        } else {
            // This case should ideally not be reached due to the useEffect check
            toast({ variant: 'destructive', title: 'User Not Logged In', description: 'Something went wrong. Please log in again.' });
            router.push('/login');
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

  // Show a loading state while checking user auth
  if (isUserLoading || !user) {
    return (
        <div className="flex items-center justify-center min-h-screen w-full">
            <p>Loading user data...</p>
        </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Admin Panel Lock</CardTitle>
          <CardDescription>Enter the password to grant admin rights to your current user and unlock.</CardDescription>
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
              {isSubmitting ? 'Unlocking...' : 'Unlock & Grant Admin'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
