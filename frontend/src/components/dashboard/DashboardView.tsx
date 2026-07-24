"use client";

import Link from "next/link";
import {
  Boxes,
  CircleCheck,
  Building2,
  FolderGit2,
  Plus,
  BookOpen,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { PhaseBadge } from "@/components/tenants/PhaseBadge";
import { useAsync } from "@/hooks/useAsync";
import { listTenants, listOrganizations, listProjects } from "@/lib/api";
import { formatAge } from "@/lib/format";

export function DashboardView() {
  const tenants = useAsync(listTenants, []);
  const orgs = useAsync(listOrganizations, []);
  const projects = useAsync(listProjects, []);

  const ready = tenants.data?.filter((t) => t.phase === "Ready").length ?? 0;
  const recent = [...(tenants.data ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const num = (v: number | undefined | null) => (v === undefined || v === null ? "—" : v);

  return (
    <section aria-labelledby="dashboard-heading">
      <header className="flex items-end justify-between border-b-2 border-ink pb-6">
        <div>
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-ink-muted">
            Overview
          </p>
          <h1 id="dashboard-heading" className="mt-1 font-display text-4xl font-medium tracking-tight">
            Dashboard
          </h1>
        </div>
        <Link
          href="/tenants"
          className="inline-flex items-center gap-2 bg-accent px-4 py-2 font-display text-sm font-medium tracking-tight text-white transition-colors hover:bg-accent-hover"
        >
          <Plus className="size-4" strokeWidth={2} />
          New tenant
        </Link>
      </header>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tenants" value={num(tenants.data?.length)} sub={`${ready} ready`} icon={Boxes} />
        <StatCard label="Ready" value={num(tenants.data ? ready : null)} icon={CircleCheck} tone="green" />
        <StatCard label="Organizations" value={num(orgs.data?.length)} icon={Building2} />
        <StatCard label="Projects" value={num(projects.data?.length)} icon={FolderGit2} />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Quick actions */}
        <div>
          <h2 className="border-b-2 border-ink pb-3 font-display text-xl font-medium tracking-tight">
            Quick actions
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            <ActionCard href="/tenants" icon={Boxes} title="Create a tenant" subtitle="Provision a virtual Kubernetes cluster." />
            <ActionCard href="/organizations" icon={Building2} title="New organization" subtitle="Group projects, members, and tenants." />
            <ActionCard href="https://docs.kubespaces.io" external icon={BookOpen} title="Read the docs" subtitle="Guides, concepts, and reference." />
          </div>
        </div>

        {/* Recent tenants */}
        <div>
          <h2 className="border-b-2 border-ink pb-3 font-display text-xl font-medium tracking-tight">
            Recent tenants
          </h2>
          {recent.length === 0 ? (
            <p className="py-6 text-sm text-ink-muted">
              {tenants.data === null ? "Loading…" : "No tenants yet."}
            </p>
          ) : (
            <ul className="mt-1 flex flex-col">
              {recent.map((t) => (
                <li key={t.name}>
                  <Link
                    href={`/tenants/${t.name}`}
                    className="flex items-center justify-between border-b border-rule py-3.5 transition-colors hover:bg-ink/[0.02]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-display font-medium tracking-tight text-ink">
                        {t.name}
                      </span>
                      <span className="text-xs text-ink-faint">{formatAge(t.createdAt)}</span>
                    </span>
                    <PhaseBadge phase={t.phase} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  subtitle,
  external = false,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-medium tracking-tight text-ink">{title}</span>
        <span className="block text-[0.8125rem] text-ink-muted">{subtitle}</span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-ink-faint" strokeWidth={2} />
    </>
  );
  const cls =
    "flex items-center gap-4 border border-rule bg-paper-raised px-4 py-4 transition-colors hover:border-ink/30";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
