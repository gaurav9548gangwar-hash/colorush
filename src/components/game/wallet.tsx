'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useFirebase } from '@/firebase'
import { useDoc } from '@/firebase/firestore/use-doc'
import { doc } from 'firebase/firestore'
import type { User } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { Wallet as WalletIcon, Download, Upload, History } from 'lucide-react'

export function Wallet() {
  const { firestore, user } = useFirebase()
  const router = useRouter()

  const userDocRef = useMemo(() => {
    if (firestore && user) {
      return doc(firestore, 'users', user.uid)
    }
    return null
  }, [firestore, user])

  const { data: userData, isLoading } = useDoc<User>(userDocRef)

  const balance = userData?.balance ?? 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">My Wallet</CardTitle>
        <WalletIcon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoading ? 'Loading...' : `INR ${balance.toFixed(2)}`}
        </div>
        <p className="text-xs text-muted-foreground">
          Your available balance
        </p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => router.push('/recharge')}>
             <Upload className="mr-2 h-4 w-4" /> Recharge
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => router.push('/withdraw')}>
            <Download className="mr-2 h-4 w-4" /> Withdraw
          </Button>
           <Button size="sm" variant="outline" className="flex-1 col-span-2 md:col-span-1" onClick={() => router.push('/wallet-history')}>
            <History className="mr-2 h-4 w-4" /> Payment History
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
