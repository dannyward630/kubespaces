"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Boxes,
  Building2,
  ShieldCheck,
  BookOpen,
  LogOut,
  ChevronsUpDown,
  Check,
  type LucideIcon,
} from "lucide-react";
import { getMe, listOrganizations } from "@/lib/api";
import type { Organization } from "@/lib/types";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  email: string;
  version: string;
  onSignOut: () => void;
}

export function Sidebar({ email, version, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [orgs, setOrgs] = useState<Organization[]>([]);

  useEffect(() => {
    getMe()
      .then((me) => setIsAdmin(me.roles?.includes("kubespaces-admin") ?? false))
      .catch(() => setIsAdmin(false));
    listOrganizations()
      .then(setOrgs)
      .catch(() => setOrgs([]));
  }, []);

  const groups: NavGroup[] = [
    {
      label: "Main",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/tenants", label: "Tenants", icon: Boxes },
        { href: "/organizations", label: "Organizations", icon: Building2 },
      ],
    },
  ];
  if (isAdmin) {
    groups.push({
      label: "Platform",
      items: [{ href: "/admin", label: "Users", icon: ShieldCheck }],
    });
  }

  return (
    <aside className="flex h-dvh w-64 shrink-0 flex-col border-r border-rule bg-paper-raised">
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-rule px-5">
        <Link
          href="/dashboard"
          className="font-display text-lg font-semibold tracking-tight text-ink transition-colors hover:text-accent"
        >
          KubeSpaces
          <span aria-hidden="true" className="ml-1.5 text-accent">
            ⌁
          </span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Org switcher */}
      <div className="border-b border-rule px-3 py-3">
        <OrgSwitcher orgs={orgs} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="px-2 pb-2 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors " +
                        (active
                          ? "bg-accent/10 text-accent"
                          : "text-ink-muted hover:bg-ink/5 hover:text-ink")
                      }
                    >
                      <Icon className="size-4 shrink-0" strokeWidth={2} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
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
            <span className="block truncate text-[0.8125rem] font-medium text-ink">
              {email}
            </span>
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
