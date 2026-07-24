"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { NameDialog } from "@/components/tenancy/NameDialog";
import { useAsync } from "@/hooks/useAsync";
import {
  listOrganizations,
  createOrganization,
  listMyOrgInvitations,
  acceptOrgInvitation,
  declineOrgInvitation,
} from "@/lib/api";

export function OrganizationsView() {
  const orgs = useAsync(listOrganizations, []);
  const invites = useAsync(listMyOrgInvitations, []);
  const [creating, setCreating] = useState(false);

  async function respond(id: string, accept: boolean) {
    await (accept ? acceptOrgInvitation(id) : declineOrgInvitation(id));
    invites.reload();
    orgs.reload();
  }

  return (
    <section aria-labelledby="orgs-heading">
      <header className="flex items-end justify-between border-b-2 border-ink pb-6">
        <div>
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-ink-muted">
            {orgs.data ? `${orgs.data.length} organization${orgs.data.length === 1 ? "" : "s"}` : "Loading"}
          </p>
          <h1 id="orgs-heading" className="mt-1 font-display text-4xl font-medium tracking-tight">
            Organizations
          </h1>
        </div>
        <Button onClick={() => setCreating(true)}>New organization</Button>
      </header>

      {orgs.error && (
        <p role="alert" className="mt-6 border-l-2 border-status-red bg-status-red-bg px-3 py-2 text-sm text-status-red">
          {orgs.error}
        </p>
      )}

      {invites.data && invites.data.length > 0 && (
        <div className="mt-8">
          <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Pending invitations
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {invites.data.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between border border-ink/15 bg-paper-raised px-4 py-3"
              >
                <span className="text-sm text-ink">
                  <span className="font-medium">{inv.name}</span> · {inv.role} · invited by {inv.inviterEmail}
                </span>
                <span className="flex gap-2">
                  <Button variant="secondary" onClick={() => respond(inv.id, true)}>
                    Accept
                  </Button>
                  <Button variant="ghost" onClick={() => respond(inv.id, false)}>
                    Decline
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-col">
        {orgs.data?.map((org) => (
          <Link
            key={org.id}
            href={`/organizations/${org.id}`}
            className="flex items-center justify-between border-b border-rule py-5 transition-colors hover:bg-ink/[0.02]"
          >
            <div>
              <p className="font-display text-lg font-medium tracking-tight text-ink">{org.name}</p>
              {org.description && <p className="mt-0.5 text-sm text-ink-muted">{org.description}</p>}
            </div>
            <div className="flex items-center gap-3">
              {org.isDefault && <Badge tone="neutral">Default</Badge>}
              {org.role && <Badge tone="green">{org.role}</Badge>}
            </div>
          </Link>
        ))}
        {orgs.data?.length === 0 && !orgs.error && (
          <div className="py-20">
            <p className="font-display text-[clamp(2rem,5vw,3.5rem)] font-medium leading-tight tracking-tight text-ink/90">
              No organizations yet.
            </p>
            <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">
              An organization groups projects, members, and their tenants. Create one to start
              inviting teammates and organizing work.
            </p>
            <div className="mt-8">
              <Button onClick={() => setCreating(true)}>Create your first organization</Button>
            </div>
          </div>
        )}
      </div>

      <NameDialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Create an organization"
        submitLabel="Create organization"
        onSubmit={async (name, description) => {
          await createOrganization({ name, description });
          orgs.reload();
        }}
      />
    </section>
  );
}
