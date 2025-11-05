
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth"
import { useFirebase } from "@/firebase"
import { doc, setDoc } from "firebase/firestore"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FirestorePermissionError } from "@/firebase/errors"
import { errorEmitter } from "@/firebase/error-emitter"

export default function LoginPage() {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [loginPhone, setLoginPhone] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const router = useRouter()
  const { auth, firestore } = useFirebase() 
  const { toast } = useToast()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth || !firestore) return
    setIsSubmitting(true)

    // Validate phone number for 10 digits
    if (!/^\d{10}$/.test(phone)) {
        toast({
            variant: "destructive",
            title: "Invalid Phone Number",
            description: "Phone number must be exactly 10 digits.",
        })
        setIsSubmitting(false)
        return
    }

    // Create a unique email-like ID for Firebase Auth from the phone number
    const emailId = `${phone}@tiranga.in`

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailId, password)
      const newUser = userCredential.user
      await updateProfile(newUser, { displayName: name });


      const userData = {
        id: newUser.uid,
        name: name,
        phone: phone,
        emailId: emailId,
        balance: 0,
        createdAt: new Date().toISOString()
      };
      
      // Save the user data to Firestore
      const userDocRef = doc(firestore, "users", newUser.uid);
      
      setDoc(userDocRef, userData).catch(error => {
         const contextualError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'create',
            requestResourceData: userData,
        });
        errorEmitter.emit('permission-error', contextualError);
      })
      
      toast({ title: "Registration Successful", description: "Welcome! You are now logged in." })
      router.push("/dashboard");
    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            toast({ variant: "destructive", title: "Registration Failed", description: "This phone number is already registered. Please log in." })
        } else {
            toast({ variant: "destructive", title: "Registration Failed", description: error.message })
        }
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth) return
    setIsSubmitting(true)
    const emailId = `${loginPhone}@tiranga.in`
    
    try {
        await signInWithEmailAndPassword(auth, emailId, loginPassword)
        toast({ title: "Login Successful" })
        router.push("/dashboard");
    } catch (error: any) {
        toast({ variant: "destructive", title: "Login Failed", description: "Invalid phone number or password." })
    } finally {
        setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-primary">Tiranga Wingo</CardTitle>
        <CardDescription>Login or create an account to play</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-phone">Phone Number</Label>
                  <Input id="login-phone" type="tel" placeholder="Your 10-digit phone" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} required />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Logging In..." : "Login"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" placeholder="9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} required title="Phone number must be 10 digits"/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="Create a password (min. 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}/>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Creating Account..." : "Create Account"}
                </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
       <CardFooter className="flex flex-col text-xs text-center">
        <p className="text-muted-foreground">By continuing, you agree to our Terms of Service.</p>
        <Button variant="link" size="sm" onClick={() => router.push('/admin/login')} className="mt-2">
            Admin Login
        </Button>
      </CardFooter>
    </Card>
  )
}
