import { requireUser } from "@/lib/auth";

export default async function ClientAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <>{children}</>;
}
