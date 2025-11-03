
import { WithdrawalsTab } from "../components";

export default function AdminWithdrawalsPage() {
  return (
    <div className="p-4 md-p-6 text-foreground">
      <h1 className="text-3xl font-bold mb-6">Withdrawal Requests</h1>
      <WithdrawalsTab />
    </div>
  );
}
