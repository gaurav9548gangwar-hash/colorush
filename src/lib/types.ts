export type User = {
  id: string;
  name: string;
  phone: string;
  emailId: string;
  balance: number;
  joinDate: string;
};

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

export type GameResult = {
  id: string;
  gameId: string;
  resultNumber: number;
  resultColor: 'green' | 'orange' | 'white';
};
