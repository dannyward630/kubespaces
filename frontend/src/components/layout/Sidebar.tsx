"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Boxes,
  Building2,
  ShieldCheck,
  BookOpen,
  LogOut,
  ChevronsUpDown,
  ChevronRight,
  Check,
  PanelLeftClose,
  type LucideIcon,
} from "lucide-react";
import { getMe, listOrganizations, listTenants, listProjects } from "@/lib/api";
import type { Organization, Tenant, Project } from "@/lib/types";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface SidebarProps {
  email: string;
  version: string;
  onSignOut: () => void;
  onCollapse?: () => void;
}

export function Sidebar({ email, version, onSignOut, onCollapse }: SidebarProps) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    getMe().then((me) => setIsAdmin(me.roles?.includes("kubespaces-admin") ?? false)).catch(() => {});
    listOrganizations().then(setOrgs).catch(() => {});
    listTenants().then(setTenants).catch(() => {});
    listProjects().then(setProjects).catch(() => {});
  }, []);

  const projectsByOrg = useMemo(() => {
    const map: Record<string, Project[]> = {};
    for (const p of projects) (map[p.organizationId] ??= []).push(p);
    return map;
  }, [projects]);

  // Auto-expand the branches on the active path (without collapsing the ones
  // the user opened manually).
  useEffect(() => {
    const keys: string[] = [];
    if (pathname.startsWith("/tenants")) keys.push("tenants");
    if (pathname.startsWith("/organizations")) {
      keys.push("organizations");
      const m = pathname.match(/^\/organizations\/([^/]+)/);
      if (m) keys.push(`org:${m[1]}`);
    }
    if (pathname.startsWith("/projects/")) {
      const pid = pathname.split("/")[2];
      const org = projects.find((p) => p.id === pid)?.organizationId;
      if (org) keys.push("organizations", `org:${org}`);
    }
    if (keys.length) setOpen((prev) => new Set([...prev, ...keys]));
  }, [pathname, projects]);

  const toggle = useCallback((key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const isActive = (href: string) => pathname === href;
  const inSection = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  return (
    <aside className="flex h-dvh w-64 shrink-0 flex-col border-r border-rule bg-paper-raised">
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-rule px-5">
        <Link
          href="/dashboard"
          className="font-display text-lg font-semibold tracking-tight text-ink transition-colors hover:text-accent"
        >
          KubeSpaces
          <span aria-hidden="true" className="ml-1.5 text-accent">⌁</span>
        </Link>
        <div className="flex items-center gap-0.5">
          <ThemeToggle />
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Collapse sidebar"
              className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <PanelLeftClose className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Org switcher */}
      <div className="border-b border-rule px-3 py-3">
        <OrgSwitcher orgs={orgs} />
      </div>

      {/* Nav tree */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <GroupLabel>Main</GroupLabel>
        <ul className="mb-6 flex flex-col gap-0.5">
          <li>
            <RowLink href="/dashboard" icon={LayoutDashboard} active={isActive("/dashboard")}>
              Dashboard
            </RowLink>
          </li>

          {/* Tenants */}
          <li>
            <Branch
              href="/tenants"
              icon={Boxes}
              label="Tenants"
              active={inSection("/tenants")}
              open={open.has("tenants")}
              onToggle={() => toggle("tenants")}
              hasChildren={tenants.length > 0}
            >
              {tenants.map((t) => (
                <SubLink key={t.name} href={`/tenants/${t.name}`} active={isActive(`/tenants/${t.name}`)}>
                  {t.name}
                </SubLink>
              ))}
            </Branch>
          </li>

          {/* Organizations → projects */}
          <li>
            <Branch
              href="/organizations"
              icon={Building2}
              label="Organizations"
              active={inSection("/organizations")}
              open={open.has("organizations")}
              onToggle={() => toggle("organizations")}
              hasChildren={orgs.length > 0}
            >
              {orgs.map((o) => {
                const orgProjects = projectsByOrg[o.id] ?? [];
                const orgActive =
                  isActive(`/organizations/${o.id}`) ||
                  orgProjects.some((p) => isActive(`/projects/${p.id}`));
                return (
                  <Branch
                    key={o.id}
                    href={`/organizations/${o.id}`}
                    label={o.name}
                    nested
                    active={orgActive}
                    open={open.has(`org:${o.id}`)}
                    onToggle={() => toggle(`org:${o.id}`)}
                    hasChildren={orgProjects.length > 0}
                  >
                    {orgProjects.map((p) => (
                      <SubLink key={p.id} href={`/projects/${p.id}`} active={isActive(`/projects/${p.id}`)} nested>
                        {p.name}
                      </SubLink>
                    ))}
                  </Branch>
                );
              })}
            </Branch>
          </li>
        </ul>

        {isAdmin && (
          <>
            <GroupLabel>Platform</GroupLabel>
            <ul className="flex flex-col gap-0.5">
              <li>
                <RowLink href="/admin" icon={ShieldCheck} active={inSection("/admin")}>
                  Users
                </RowLink>
              </li>
            </ul>
          </>
        )}
      </nav>

      {/* Support + user */}
      <div className="border-t border-rule px-3 py-3">
        <a
          href="https://docs.kubespaces.io"
          target="_blank"
          rel="noreferrer"
          className="mb-2 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <BookOpen className="size-4 shrink-0" strokeWidth={2} />
          Documentation
        </a>
        <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
            {initials(email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.8125rem] font-medium text-ink">{email}</span>
            <span className="block text-[0.6875rem] tabular-nums text-ink-faint">
              {version === "dev" ? "dev" : `v${version}`}
            </span>
          </span>
          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <LogOut className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-2 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
      {children}
    </p>
  );
}

const rowBase = "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors";
const activeCls = "bg-accent/10 text-accent";
const idleCls = "text-ink-muted hover:bg-ink/5 hover:text-ink";

function RowLink({
  href,
  icon: Icon,
  active,
  children,
}: {
  href: string;
  icon: LucideIcon;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${rowBase} ${active ? activeCls : idleCls}`}>
      <Icon className="size-4 shrink-0" strokeWidth={2} />
      {children}
    </Link>
  );
}

/** An expandable nav row: a link (icon + label) plus a chevron that toggles
 *  its collapsible children. `nested` renders it one indent level deeper. */
function Branch({
  href,
  icon: Icon,
  label,
  active,
  open,
  onToggle,
  hasChildren,
  nested = false,
  children,
}: {
  href: string;
  icon?: LucideIcon;
  label: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  hasChildren: boolean;
  nested?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={`group flex items-center rounded-md ${active ? activeCls : idleCls}`}>
        <Link
          href={href}
          className={`flex min-w-0 flex-1 items-center gap-2.5 py-2 pr-1 text-sm font-medium ${nested ? "pl-8" : "pl-2.5"}`}
        >
          {Icon && <Icon className="size-4 shrink-0" strokeWidth={2} />}
          <span className="truncate">{label}</span>
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={open}
          disabled={!hasChildren}
          className="mr-1 rounded p-1 text-ink-faint transition-colors hover:text-ink disabled:opacity-0"
        >
          <ChevronRight className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} strokeWidth={2.5} />
        </button>
      </div>
      {open && hasChildren && <ul className="mt-0.5 flex flex-col gap-0.5">{children}</ul>}
    </div>
  );
}

function SubLink({
  href,
  active,
  nested = false,
  children,
}: {
  href: string;
  active: boolean;
  nested?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className={
          "flex items-center gap-2 rounded-md py-1.5 pr-2 text-[0.8125rem] transition-colors " +
          (nested ? "pl-11 " : "pl-8 ") +
          (active ? "font-medium text-accent" : "text-ink-muted hover:bg-ink/5 hover:text-ink")
        }
      >
        <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${active ? "bg-accent" : "bg-ink-faint/50"}`} />
        <span className="truncate">{children}</span>
      </Link>
    </li>
  );
}

function OrgSwitcher({ orgs }: { orgs: Organization[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current =
    orgs.find((o) => pathname === `/organizations/${o.id}`) ??
    orgs.find((o) => o.isDefault) ??
    orgs[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-rule px-2.5 py-2 text-left transition-colors hover:border-ink/30"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded bg-accent text-[0.6875rem] font-semibold text-white">
          {current ? current.name.charAt(0).toUpperCase() : "?"}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink">
          {current?.name ?? "No organization"}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-ink-faint" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-rule bg-paper-raised py-1 shadow-[0_12px_32px_-12px_rgba(25,23,19,0.35)]">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/organizations/${org.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-2.5 py-2 text-[0.8125rem] text-ink transition-colors hover:bg-ink/5"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-accent/10 text-[0.625rem] font-semibold text-accent">
                  {org.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">{org.name}</span>
                {current?.id === org.id && <Check className="size-3.5 text-accent" />}
              </Link>
            ))}
            <Link
              href="/organizations"
              onClick={() => setOpen(false)}
              className="mt-1 block border-t border-rule px-2.5 py-2 text-[0.8125rem] font-medium text-accent transition-colors hover:bg-accent/5"
            >
              View all organizations
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function initials(email: string): string {
  const name = email.split("@")[0] ?? email;
  const parts = name.split(/[.\-_]/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return chars.toUpperCase();
}
