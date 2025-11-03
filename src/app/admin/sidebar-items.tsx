
"use client";

import { usePathname } from "next/navigation";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Home, Users, Gamepad2, CreditCard, ArrowLeftRight } from "lucide-react";

export default function AdminSidebarItems() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton href="/admin" isActive={pathname === "/admin"}>
          <Home />
          Dashboard
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton href="/admin/users" isActive={pathname === "/admin/users"}>
          <Users />
          Users
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton href="/admin/deposits" isActive={pathname === "/admin/deposits"}>
          <CreditCard />
          Deposits
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton href="/admin/withdrawals" isActive={pathname === "/admin/withdrawals"}>
          <ArrowLeftRight />
          Withdrawals
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton href="/admin/game-control" isActive={pathname === "/admin/game-control"}>
          <Gamepad2 />
          Game Control
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
