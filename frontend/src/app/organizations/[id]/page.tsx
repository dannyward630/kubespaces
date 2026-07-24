import type { Metadata } from "next";
import { OrganizationDetail } from "@/components/organizations/OrganizationDetail";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Organization" };

export default async function OrganizationPage({ params }: Props) {
  const { id } = await params;
  return <OrganizationDetail orgId={id} />;
}
