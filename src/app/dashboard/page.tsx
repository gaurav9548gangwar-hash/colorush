'use client'
import { Header } from '@/components/game/header'
import { Wallet } from '@/components/game/wallet'
import { GameArea } from '@/components/game/game-area'
import { useFirebase } from '@/firebase'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

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
        <Wallet />
        <GameArea />
      </main>
    </div>
  )
}
