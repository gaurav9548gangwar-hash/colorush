'use client'

import { Button } from '@/components/ui/button'
import { useFirebase } from '@/firebase'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function Header() {
  const { auth } = useFirebase()
  const router = useRouter()

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut()
      router.push('/login')
    }
  }

  return (
    <header className="bg-card shadow-sm">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-bold text-primary">ColoRush</h1>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
