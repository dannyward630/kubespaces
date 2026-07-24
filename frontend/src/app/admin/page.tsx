import type { Metadata } from "next";
import { AdminUsersView } from "@/components/admin/AdminUsersView";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return <AdminUsersView />;
}
