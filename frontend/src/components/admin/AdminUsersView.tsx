"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { useAsync } from "@/hooks/useAsync";
import { adminListUsers, adminSetUserAdmin } from "@/lib/api";
import { formatAge } from "@/lib/format";

export function AdminUsersView() {
  const users = useAsync(adminListUsers, []);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(id: string, isAdmin: boolean) {
    setBusyId(id);
    try {
      await adminSetUserAdmin(id, isAdmin);
      users.reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="admin-heading">
      <header className="border-b-2 border-ink pb-6">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-ink-muted">
          Platform administration
        </p>
        <h1 id="admin-heading" className="mt-1 font-display text-4xl font-medium tracking-tight">
          Users
        </h1>
      </header>

      {users.error && (
        <p role="alert" className="mt-6 border-l-2 border-status-red bg-status-red-bg px-3 py-2 text-sm text-status-red">
          {users.error}
        </p>
      )}

      {users.data && (
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule text-left">
              <th className="py-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-muted">Email</th>
              <th className="py-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-muted">Joined</th>
              <th className="py-2 text-right text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-muted">
                Platform admin
              </th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((u) => (
              <tr key={u.id} className="border-b border-rule/60">
                <td className="py-3 text-ink">{u.email}</td>
                <td className="py-3 text-ink-muted">{formatAge(u.createdAt)}</td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center gap-3">
                    {u.isAdmin && <Badge tone="green">admin</Badge>}
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => toggle(u.id, !u.isAdmin)}
                      className="text-sm text-accent underline-offset-4 hover:underline disabled:opacity-50"
                    >
                      {u.isAdmin ? "Revoke" : "Make admin"}
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
