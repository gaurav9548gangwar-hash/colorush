'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

// This should be a strong, unique password stored securely (e.g., environment variable)
const ADMIN_PASSWORD = 'gaurav@9548' 

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (password === ADMIN_PASSWORD) {
        // In a real app, you'd use a more secure session management.
        // For this simple case, we use sessionStorage which is cleared when the tab is closed.
        try {
            sessionStorage.setItem('isAdminLoggedIn', 'true');
            toast({ title: 'Admin Login Successful', description: 'Redirecting to admin panel...' });
            router.push('/admin');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Browser Error', description: 'Could not set session storage. Please enable it in your browser settings.' });
        }
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
