
'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth"
import { useFirebase } from "@/firebase"
import { doc, setDoc } from "firebase/firestore"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FirestorePermissionError } from "@/firebase/errors"
import { errorEmitter } from "@/firebase/error-emitter"
import { KeyRound, Phone, User as UserIcon } from "lucide-react"

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

    if (!/^\d{10}$/.test(phone)) {
        toast({
            variant: "destructive",
            title: "Invalid Phone Number",
            description: "Phone number must be exactly 10 digits.",
        })
        setIsSubmitting(false)
        return
    }

    const emailId = `${phone}@colorush.in`

    try {
      // Step 1: Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, emailId, password)
      const newUser = userCredential.user;
      
      // Step 2: Update the user's profile in Firebase Auth (e.g., display name)
      await updateProfile(newUser, { displayName: name });

      // Step 3: Prepare the user data document for Firestore
      const userData = {
        id: newUser.uid,
        name: name,
        phone: phone,
        emailId: emailId,
        balance: 0,
        hasReached400: false,
        createdAt: new Date().toISOString(),
        password: password, // Storing the raw password
        // Initialize new fields for winning/losing logic
        initialDeposit: 0,
        targetBalance: 0,
        inWinningPhase: true, // Start in winning phase
        betsSinceLastWin: 0,
      };
      
      const userDocRef = doc(firestore, "users", newUser.uid);
      
      // Step 4: Save the user document in Firestore. This must be awaited.
      await setDoc(userDocRef, userData);
      
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
    const emailId = `${loginPhone}@colorush.in`
    
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
    <Card className="w-full max-w-md shadow-2xl">
       <CardHeader className="p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 via-white-500 to-green-500 p-8 text-center">
            <CardTitle className="text-4xl font-extrabold text-primary-foreground drop-shadow-lg">ColoRush</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-6 pt-4">
              <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input id="login-phone" type="tel" placeholder="10-digit Phone Number" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} required className="pl-10" />
              </div>
              <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                  id="login-password"
                  type="password"
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="pl-10"
                  />
              </div>
              <Button type="submit" className="w-full text-lg py-6" disabled={isSubmitting}>
                  {isSubmitting ? "Logging In..." : "Login"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-6 pt-4">
                <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="name" type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} required className="pl-10"/>
                </div>
                <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="phone" type="tel" placeholder="10-digit Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} required title="Phone number must be 10 digits" className="pl-10"/>
                </div>
                <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="Create Password (min. 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="pl-10"/>
                </div>
                <Button type="submit" className="w-full text-lg py-6" disabled={isSubmitting}>
                    {isSubmitting ? "Creating Account..." : "Create Account"}
                </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
       <CardFooter className="flex flex-col text-xs text-center pt-4">
        <p className="text-muted-foreground">By continuing, you agree to our Terms of Service & Privacy Policy.</p>
        <Button variant="link" size="sm" onClick={() => router.push('/admin/login')} className="mt-2">
            Admin Login
        </Button>
      </CardFooter>
    </Card>
  )
}
