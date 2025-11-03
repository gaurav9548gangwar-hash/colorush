
"use client";
import { DashboardTab } from "./components";

export default function AdminPage() {
  return (
    <div className="p-4 md:p-6 text-foreground">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <DashboardTab />
    </div>
  );
}
