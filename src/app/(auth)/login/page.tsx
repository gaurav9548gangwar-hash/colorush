"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { RecaptchaVerifier, signInWithPhoneNumber, type Auth } from "firebase/auth"
import { useFirebase } from "@/firebase"

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier
    confirmationResult: any
  }
}

export default function LoginPage() {
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { auth } = useFirebase()
  const { toast } = useToast()

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth) return
    setIsSubmitting(true)

    try {
      const formattedPhoneNumber = `+${phoneNumber.replace(/\D/g, '')}`
      
      const appVerifier = window.recaptchaVerifier ?? new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: (response: any) => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        },
      });
      
      window.recaptchaVerifier = appVerifier;

      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhoneNumber, appVerifier)
      window.confirmationResult = confirmationResult
      toast({
        title: "OTP Sent",
        description: "We've sent an OTP to your phone number.",
      })
      setStep("otp")
    } catch (error: any)
    {
      console.error("Error sending OTP:", error)
      toast({
        variant: "destructive",
        title: "Failed to send OTP",
        description: error.message || "Please try again.",
      })
      // Reset reCAPTCHA if it exists
      window.recaptchaVerifier?.clear();

    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await window.confirmationResult.confirm(otp)
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      })
      router.push("/dashboard")
    } catch (error: any) {
      console.error("Error verifying OTP:", error)
      toast({
        variant: "destructive",
        title: "Invalid OTP",
        description: "The OTP you entered is incorrect. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div id="recaptcha-container"></div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Tiranga</CardTitle>
          <CardDescription>Login to your account</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending OTP..." : "Send OTP"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Verifying..." : "Login"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col text-xs text-center">
          <p>By continuing, you agree to our Terms of Service.</p>
          <Button variant="link" size="sm" onClick={() => router.push('/admin')}>
              Admin Login
          </Button>
        </CardFooter>
      </Card>
    </>
  )
}
