'use client'

import { Header } from '@/components/game/header'
import { MyBetsTab } from '@/components/game/my-bets-tab'
import { PastResultsTab } from '@/components/game/past-results-tab'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFirebase } from '@/firebase'

export default function HistoryPage() {
  const { user } = useFirebase()

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Game History</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pastResults">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pastResults">Past Results</TabsTrigger>
                <TabsTrigger value="myBets">My Bet History</TabsTrigger>
              </TabsList>
              <TabsContent value="pastResults">
                <PastResultsTab />
              </TabsContent>
              <TabsContent value="myBets">
                {user ? <MyBetsTab userId={user.uid} /> : <p className="text-center py-4">Please log in to see your bets.</p>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
