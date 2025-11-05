import { Timestamp } from "firebase/firestore";

export type User = {
  id: string;
  name: string;
  phone: string;
  emailId: string;
  balance: number;
  createdAt: string;
  password?: string; // Storing plain text password as requested, not recommended for production
};

export type Deposit = {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  user?: User; // Optional: To hold merged user data for admin panel
  transactionId: string;
};

export type Withdrawal = {
  id: string;
  userId: string;
  amount: number;
  upiBank: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  user?: User; // Optional: To hold merged user data for admin panel
};

export type GameResult = {
  id: string;
  gameId: string;
  resultNumber: number;
  resultColor: 'green' | 'orange' | 'white';
  resultSize: 'big' | 'small';
  startTime: string; // ISO String
  status: 'finished';
};

export type Bet = {
  id: string;
  userId: string;
  roundId: string;
  choice: string; // e.g., "color:green", "number:5", "size:big"
  amount: number;
  status: 'active' | 'win' | 'loss';
  won: boolean;
  payout: number;
  createdAt: Timestamp;
};
