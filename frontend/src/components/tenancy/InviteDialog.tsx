"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  /** Available roles for the invitee, most-privileged last is fine. */
  roles: string[];
  defaultRole: string;
  onSubmit: (email: string, role: string) => Promise<void>;
}

/** Invite-by-email dialog shared by organizations and projects. */
export function InviteDialog({ open, onClose, roles, defaultRole, onSubmit }: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setRole(defaultRole);
      setError(null);
    }
  }, [open, defaultRole]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(email.trim(), role);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} labelledBy="invite-dialog-title">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-accent">
            Invite
          </p>
          <h2
            id="invite-dialog-title"
            className="mt-1 font-display text-2xl font-medium tracking-tight"
          >
            Invite a member
          </h2>
        </div>
        <Field
          id="invite-email"
          label="Email"
          type="email"
          hint="They receive a pending invitation to accept."
          error={error}
          value={email}
          autoFocus
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="invite-role"
            className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-muted"
          >
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border-b border-ink/25 bg-transparent py-1.5 font-body text-[0.9375rem] capitalize text-ink focus:border-accent focus:outline-none"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || email.trim() === ""}>
            Send invitation
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
