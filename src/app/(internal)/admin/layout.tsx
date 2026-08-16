import { requireAdmin } from "@/lib/auth";

export default async function AdminAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
