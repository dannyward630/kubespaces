import type { Metadata } from "next";
import { OrganizationsView } from "@/components/organizations/OrganizationsView";

export const metadata: Metadata = { title: "Organizations" };

export default function OrganizationsPage() {
  return <OrganizationsView />;
}
