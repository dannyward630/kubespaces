import type { Metadata } from "next";
import { ProjectDetail } from "@/components/projects/ProjectDetail";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  return <ProjectDetail projectId={id} />;
}
