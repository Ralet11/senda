import { redirect } from "next/navigation";

// Accounts are provisioned by the team; public self-registration is not supported.
export default function RegisterPage() {
  redirect("/login");
}
