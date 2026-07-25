"use client";

import { useEffect, useRef, useState } from "react";
import { PanelLeft } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";

interface AppShellProps {
  email: string;
  version: string;
  onSignOut: () => void;
  children: React.ReactNode;
}

// Below this width the sidebar auto-collapses into an overlay drawer.
const NARROW_BREAKPOINT = 1024;

export function AppShell({ email, version, onSignOut, children }: AppShellProps) {
  const [open, setOpen] = useState(true);
  const [narrow, setNarrow] = useState(false);
  const wasNarrow = useRef<boolean | null>(null);

  useEffect(() => {
    const apply = () => {
      const n = window.innerWidth < NARROW_BREAKPOINT;
      setNarrow(n);
      // Only force open/closed when actually crossing the breakpoint, so the
      // collapse button still works freely within a size regime.
      if (wasNarrow.current !== n) {
        setOpen(!n);
        wasNarrow.current = n;
      }
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Backdrop for the overlay drawer on narrow screens. */}
      {narrow && open && (
        <div
          className="fixed inset-0 z-30 bg-ink/40"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar: in-flow on wide screens, an overlay drawer on narrow ones. */}
      <div
        className={
          "z-40 shrink-0 transition-transform duration-200 " +
          (narrow ? "fixed inset-y-0 left-0 " : "relative ") +
          (open ? "translate-x-0" : narrow ? "-translate-x-full" : "hidden")
        }
      >
        <Sidebar
          email={email}
          version={version}
          onSignOut={onSignOut}
          onCollapse={() => setOpen(false)}
        />
      </div>

      <div className="relative flex-1 overflow-y-auto">
        {/* Floating reopen button when the sidebar is collapsed/hidden. */}
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open sidebar"
            className="fixed left-3 top-3 z-30 rounded-md border border-rule bg-paper-raised p-2 text-ink-muted shadow-[0_2px_8px_-2px_rgba(25,23,19,0.25)] transition-colors hover:text-ink"
          >
            <PanelLeft className="size-4" strokeWidth={2} />
          </button>
        )}
        <main className="mx-auto w-full max-w-5xl px-8 py-10">{children}</main>
      </div>
    </div>
  );
}
