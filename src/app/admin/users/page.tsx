
import { UsersTab } from "../components";

export default function AdminUsersPage() {
  return (
    <div className="p-4 md:p-6 text-foreground">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>
      <UsersTab />
    </div>
  );
}
