import { Timestamp } from "firebase/firestore";

export type User = {
  id: string;
  name: string;
  phone: string;
  emailId: string;
  balance: number;
  createdAt: string;
};

export type BetColor = "green" | "white" | "orange";
export type BetSize = "small" | "big";
export type BetTarget = BetColor | BetSize | number;

export interface Bet {
  id: string;
  userId: string;
  roundId: string;
  amount: number;
  target: BetTarget;
  type: "color" | "number" | "size";
  status: "pending" | "win" | "loss";
  payout: number;
  createdAt: Timestamp;
}

export interface GameResult {
  id: string;
  roundId: string;
  winningNumber: number;
  winningColor: BetColor;
  winningSize: BetSize;
  endedAt: Timestamp;
}

export interface DepositRequest {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    transactionId: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: Timestamp;
}

export interface WithdrawalRequest {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    upiId: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: Timestamp;
}
