"use client";

import { useState } from "react";
import type { Member } from "@/lib/types";

interface MemberTableProps {
  members: Member[];
  roles: string[];
  canManage: boolean;
  onChangeRole: (userId: string, role: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}

/** Member list with inline role editing and removal (shared org/project). */
export function MemberTable({ members, roles, canManage, onChangeRole, onRemove }: MemberTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(userId: string, fn: () => Promise<void>) {
    setBusyId(userId);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  }

  if (members.length === 0) {
    return <p className="py-6 text-sm text-ink-muted">No members yet.</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-rule text-left">
          <th className="py-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Member
          </th>
          <th className="py-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Role
          </th>
          {canManage && <th className="py-2 text-right" />}
        </tr>
      </thead>
      <tbody>
        {members.map((m) => (
          <tr key={m.userId} className="border-b border-rule/60">
            <td className="py-3">
              <span className="text-ink">{m.email}</span>
            </td>
            <td className="py-3">
              {canManage ? (
                <select
                  value={m.role}
                  disabled={busyId === m.userId}
                  onChange={(e) => run(m.userId, () => onChangeRole(m.userId, e.target.value))}
                  className="border-b border-ink/20 bg-transparent py-1 text-sm capitalize text-ink focus:border-accent focus:outline-none disabled:opacity-50"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  {!roles.includes(m.role) && <option value={m.role}>{m.role}</option>}
                </select>
              ) : (
                <span className="capitalize text-ink-muted">{m.role}</span>
              )}
            </td>
            {canManage && (
              <td className="py-3 text-right">
                <button
                  type="button"
                  disabled={busyId === m.userId}
                  onClick={() => run(m.userId, () => onRemove(m.userId))}
                  className="text-sm text-status-red underline-offset-4 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
