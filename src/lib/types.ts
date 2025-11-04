export type User = {
  id: string;
  name: string;
  phone: string;
  emailId: string;
  balance: number;
  createdAt: string;
  password?: string; // Add password field
};

export type Deposit = {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  user?: User; // Optional: To hold merged user data
};

export type Withdrawal = {
  id: string;
  userId: string;
  amount: number;
  upiBank: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  user?: User; // Optional: To hold merged user data
};


export type GameResult = {
  id: string;
  gameId: string;
  resultNumber: number;
  resultColor: 'green' | 'orange' | 'white';
  startTime?: string;
  status?: string;
};

export type Bet = {
    id: string;
    userId: string;
    roundId: string;
    choice: string;
    amount: number;
    status: 'pending' | 'win' | 'loss';
    won: boolean;
    payout: number;
    createdAt: any; // serverTimestamp will be an object
}

// Legacy types for dummy data, can be removed later
export type DepositRequest = {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
};

export type WithdrawalRequest = {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  upi: string;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
};
