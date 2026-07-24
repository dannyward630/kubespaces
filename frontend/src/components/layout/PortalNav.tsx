"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe } from "@/lib/api";

const LINKS = [
  { href: "/tenants", label: "Tenants" },
  { href: "/organizations", label: "Organizations" },
];

export function PortalNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    getMe()
      .then((me) => setIsAdmin(me.roles?.includes("kubespaces-admin") ?? false))
      .catch(() => setIsAdmin(false));
  }, []);

  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;

  return (
    <nav className="flex items-baseline gap-5">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              "font-display text-sm font-medium tracking-tight underline-offset-4 transition-colors " +
              (active ? "text-ink" : "text-ink-muted hover:text-ink hover:underline")
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
