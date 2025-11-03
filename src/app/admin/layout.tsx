
'use client'

import Link from "next/link";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
} from "@/components/ui/sidebar";
import { LogOut } from "lucide-react";
import AdminSidebarItems from "./sidebar-items";
import { useFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { signOut } from "firebase/auth";

const ADMIN_UID = "p8I214dVO5fNkBpA0fsOaB2b6n82"; // This should be your actual admin UID

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading, auth } = useFirebase();
  const router = useRouter();

  useEffect(() => {
    // Wait until the user loading state is resolved
    if (!isUserLoading) {
      // If there is no user or the user is not the admin, redirect to login
      if (!user || user.uid !== ADMIN_UID) {
        router.replace("/admin/login");
      }
    }
  }, [user, isUserLoading, router]);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push("/admin/login");
    }
  };

  // While loading or if the user is not the admin (and redirection is in progress), show a loading indicator.
  // This prevents the admin content from flashing briefly for unauthorized users.
  if (isUserLoading || !user || user.uid !== ADMIN_UID) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // If the user is authenticated and is the admin, render the layout.
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
          <button onClick={handleLogout} className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary w-full text-left">
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
