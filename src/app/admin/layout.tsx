
// This file is no longer needed for the simplified admin panel.
// The auth logic is now handled directly within the /admin/page.tsx file.
// You can leave this file empty or delete it. For now, we'll keep it simple.

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
