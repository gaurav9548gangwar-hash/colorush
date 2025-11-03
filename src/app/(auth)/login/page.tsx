"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth"
import { useFirebase } from "@/firebase"
import { doc, setDoc } from "firebase/firestore"

export default function LoginPage() {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)

  const router = useRouter()
  const { auth, firestore } = useFirebase()
  const { toast } = useToast()

  useEffect(() => {
    const storedPhone = localStorage.getItem("tirangaUserPhone")
    if (storedPhone) {
      setPhone(storedPhone)
      setIsRegistered(true)
    }
  }, [])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth || !firestore) return
    setIsSubmitting(true)
    const emailId = `${phone}@tiranga.in`

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailId, password)
      const user = userCredential.user

      await setDoc(doc(firestore, "users", user.uid), {
        id: user.uid,
        name: name,
        phone: phone,
        emailId: emailId,
        balance: 0,
        createdAt: new Date().toISOString(),
      })
      
      // Save phone to local storage AFTER successful registration
      localStorage.setItem("tirangaUserPhone", phone)
      setIsRegistered(true); // Switch to login view immediately

      toast({ title: "Registration Successful" })
      router.push("/dashboard")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Registration Failed", description: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth) return
    setIsSubmitting(true)
    const emailId = `${phone}@tiranga.in`
    
    try {
        await signInWithEmailAndPassword(auth, emailId, password)
        toast({ title: "Login Successful" })
        router.push("/dashboard")
    } catch (error: any) {
        toast({ variant: "destructive", title: "Login Failed", description: "Invalid password." })
    } finally {
        setIsSubmitting(false)
    }
  }


  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-primary">Tiranga</CardTitle>
        <CardDescription>{isRegistered ? "Welcome back! Please log in." : "Create your account"}</CardDescription>
      </CardHeader>
      <CardContent>
        {isRegistered ? (
             <form onSubmit={handleLogin} className="space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" value={phone} disabled />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Logging In..." : "Login"}
                </Button>
             </form>
        ) : (
            <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" placeholder="9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Creating Account..." : "Create Account"}
                </Button>
            </form>
        )}
      </CardContent>
       <CardFooter className="flex flex-col text-xs text-center">
        {isRegistered && (
             <Button variant="link" size="sm" onClick={() => {
                localStorage.removeItem("tirangaUserPhone");
                setIsRegistered(false);
                setPhone("");
                setPassword("");
            }}>
                Register with a new number?
            </Button>
        )}
        <p className="mt-2">By continuing, you agree to our Terms of Service.</p>
        <Button variant="link" size="sm" onClick={() => router.push('/admin')}>
            Admin Login
        </Button>
      </CardFooter>
    </Card>
  )
}
