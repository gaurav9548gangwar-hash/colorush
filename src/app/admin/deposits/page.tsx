
import { DepositsTab } from "../components";

export default function AdminDepositsPage() {
  return (
    <div className="p-4 md:p-6 text-foreground">
      <h1 className="text-3xl font-bold mb-6">Deposit Requests</h1>
      <DepositsTab />
    </div>
  );
}
