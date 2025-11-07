'use client'
import { Header } from '@/components/game/header'
import { Wallet } from '@/components/game/wallet'
import { GameArea } from '@/components/game/game-area'
import { useFirebase, useMemoFirebase } from '@/firebase'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { collection, query, orderBy, limit, doc } from 'firebase/firestore'
import { useCollection } from '@/firebase/firestore/use-collection'
import type { Notification, User } from '@/lib/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Megaphone, Copy, Gift } from 'lucide-react'
import { useDoc } from '@/firebase/firestore/use-doc'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function Announcements() {
  const { firestore } = useFirebase()
  const notificationsQuery = useMemoFirebase(() => 
    firestore 
      ? query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'), limit(1)) 
      : null
  , [firestore]);

  const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);

  const latestNotification = notifications?.[0];

  if (isLoading || !latestNotification) {
    return null;
  }

  return (
    <Alert>
        <Megaphone className="h-4 w-4" />
        <AlertTitle>{latestNotification.title}</AlertTitle>
        <AlertDescription>
            {latestNotification.message}
        </AlertDescription>
    </Alert>
  )
}

function ReferralCard() {
  const { firestore, user } = useFirebase()
  const { toast } = useToast()
  const [referralLink, setReferralLink] = useState('')

  const userDocRef = useMemo(() => {
    if (firestore && user) {
      return doc(firestore, 'users', user.uid)
    }
    return null
  }, [firestore, user])

  const { data: userData } = useDoc<User>(userDocRef)

  useEffect(() => {
    if (userData?.referralCode) {
      const link = `${window.location.origin}/login?ref=${userData.referralCode}`;
      setReferralLink(link);
    }
  }, [userData]);


  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    toast({
        title: 'Referral Link Copied!',
        description: 'You can now share it with your friends.',
    })
  }
  
  if (!userData?.referralCode) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><Gift className="mr-2" /> Refer & Earn</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Share your referral link with friends. When they register and make their first deposit, you get a 20 INR bonus!
        </p>
        <div className="flex items-center justify-between bg-muted p-2 rounded-md">
            <span className="font-mono text-sm text-center flex-1">{userData.referralCode}</span>
             <Button variant="ghost" size="icon" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
            </Button>
        </div>
        <Button className="w-full" onClick={handleCopy}>Copy Link</Button>
      </CardContent>
    </Card>
  )

}


export default function DashboardPage() {
  const { user, isUserLoading } = useFirebase()
  const router = useRouter()

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login')
    }
  }, [isUserLoading, user, router])

  if (isUserLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen">Authenticating...</div>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 space-y-6">
        <Announcements />
        <Wallet />
        <ReferralCard />
        <GameArea />
      </main>
    </div>
  )
}
