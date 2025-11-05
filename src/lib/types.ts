import { Timestamp } from "firebase/firestore";

export type User = {
  id: string;
  name: string;
  phone: string;
  emailId: string;
  balance: number;
  createdAt: string;
  password?: string;
};
