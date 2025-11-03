'use client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DepositRequest, GameResult, User, WithdrawalRequest } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Dummy Data
const DUMMY_USERS: User[] = [
  { id: '1', name: 'John Doe', phone: '+919876543210', emailId: 'user1@tiranga.in', balance: 1500.75, joinDate: '2024-03-18' },
  { id: '2', name: 'Jane Smith', phone: '+919876543211', emailId: 'user2@tiranga.in', balance: 250.00, joinDate: '2024-03-17' },
];
const DUMMY_DEPOSITS: DepositRequest[] = [
  { id: 'd1', userId: '1', userName: 'John Doe', amount: 500, status: 'pending', date: '2024-03-18' },
];
const DUMMY_WITHDRAWALS: WithdrawalRequest[] = [
  { id: 'w1', userId: '2', userName: 'Jane Smith', amount: 100, upi: 'jane@upi', status: 'pending', date: '2024-03-18' },
];
const DUMMY_RESULTS: GameResult[] = Array.from({ length: 10 }, (_, i) => ({
  id: `g${i}`,
  gameId: `wingo1_2024031801120${9 - i}`,
  resultNumber: Math.floor(Math.random() * 10),
  resultColor: ['green', 'orange', 'white'][Math.floor(Math.random() * 3)] as 'green' | 'orange' | 'white',
}));


export function DashboardTab() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">1,234</div>
          <p className="text-xs text-muted-foreground">+50 since last week</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₹45,231.89</div>
          <p className="text-xs text-muted-foreground">+20.1% from last month</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Games</CardTitle>
          <Gamepad2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">4</div>
          <p className="text-xs text-muted-foreground">WinGo 1,3,5,10 Min</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">5</div>
          <p className="text-xs text-muted-foreground">₹8,500 total</p>
        </CardContent>
      </Card>
    </div>
  )
}

function Users({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
function DollarSign({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
}
function Gamepad2({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="6" x2="10" y1="12" y2="12" /><line x1="8" x2="8" y1="10" y2="14" /><path d="M17.5 21a2.5 2.5 0 0 0 2.5-2.5V17a2.5 2.5 0 0 0-2.5-2.5H13v-3a2.5 2.5 0 0 0-2.5-2.5H6.5A2.5 2.5 0 0 0 4 11.5v4A2.5 2.5 0 0 0 6.5 18H10v3a2.5 2.5 0 0 0 2.5 2.5h5Z" /><line x1="14" x2="18" y1="6" y2="6" /><line x1="16" x2="16" y1="4" y2="8" /></svg>
}
function Activity({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
}

export function UsersTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <Input placeholder="Search by phone or email ID..." className="max-w-sm mt-2" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email ID</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DUMMY_USERS.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.phone}</div>
                </TableCell>
                <TableCell>{user.emailId}</TableCell>
                <TableCell>₹{user.balance.toFixed(2)}</TableCell>
                <TableCell>{user.joinDate}</TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm">Add Balance</Button>
                  <Button size="sm" variant="destructive">Deduct Balance</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function DepositsTab() {
  return (
    <Card>
      <CardHeader><CardTitle>Pending Deposit Requests</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DUMMY_DEPOSITS.map((deposit) => (
              <TableRow key={deposit.id}>
                <TableCell>{deposit.userName}</TableCell>
                <TableCell>₹{deposit.amount.toFixed(2)}</TableCell>
                <TableCell>{deposit.date}</TableCell>
                <TableCell><Badge variant="secondary">{deposit.status}</Badge></TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" variant="default">Approve</Button>
                  <Button size="sm" variant="destructive">Reject</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function WithdrawalsTab() {
    return (
      <Card>
        <CardHeader><CardTitle>Pending Withdrawal Requests</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>UPI</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DUMMY_WITHDRAWALS.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{w.userName}</TableCell>
                  <TableCell>₹{w.amount.toFixed(2)}</TableCell>
                  <TableCell>{w.upi}</TableCell>
                  <TableCell>{w.date}</TableCell>
                  <TableCell><Badge variant="secondary">{w.status}</Badge></TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm">Approve</Button>
                    <Button size="sm" variant="destructive">Reject</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
}

export function GameControlTab() {
    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card>
                <CardHeader><CardTitle>Manual Result</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <Input placeholder="Enter number 0-9" type="number" min="0" max="9" />
                    <Button>Trigger Result</Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Past 50 Results</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Game ID</TableHead>
                                <TableHead>Result</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {DUMMY_RESULTS.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell>{r.gameId}</TableCell>
                                    <TableCell>
                                        <Badge style={{ 
                                            backgroundColor: r.resultColor === 'white' ? '#fff' : r.resultColor,
                                            color: r.resultColor === 'white' ? '#581c87' : '#fff'
                                        }}>{r.resultNumber}</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
