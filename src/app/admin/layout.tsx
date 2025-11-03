
import Link from "next/link";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { LogOut } from "lucide-react";
import AdminSidebarItems from "./sidebar-items";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center justify-between">
            <Link href="/admin">
              <h1 className="text-xl font-semibold text-primary px-2">
                Tiranga Admin
              </h1>
            </Link>
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent>
            <AdminSidebarItems />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="/login">
                <LogOut />
                Logout
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
