'use client'
import { Header } from '@/components/game/header'
import { Wallet } from '@/components/game/wallet'
import { GameArea } from '@/components/game/game-area'
import { useFirebase, useMemoFirebase } from '@/firebase'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { collection, query, orderBy, limit } from 'firebase/firestore'
import { useCollection } from '@/firebase/firestore/use-collection'
import type { Notification } from '@/lib/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Megaphone } from 'lucide-react'

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
        <GameArea />
      </main>
    </div>
  )
}
