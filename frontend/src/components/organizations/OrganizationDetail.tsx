"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { NameDialog } from "@/components/tenancy/NameDialog";
import { InviteDialog } from "@/components/tenancy/InviteDialog";
import { MemberTable } from "@/components/tenancy/MemberTable";
import { useAsync } from "@/hooks/useAsync";
import {
  listOrganizations,
  listOrgProjects,
  listOrgMembers,
  listOrgInvitations,
  createProject,
  createOrgInvitation,
  updateOrgMemberRole,
  removeOrgMember,
  updateOrganization,
  deleteOrganization,
  setDefaultOrganization,
} from "@/lib/api";

const ORG_ROLES = ["member", "admin", "owner"];

export function OrganizationDetail({ orgId }: { orgId: string }) {
  const router = useRouter();
  const orgs = useAsync(listOrganizations, []);
  const org = useMemo(() => orgs.data?.find((o) => o.id === orgId) ?? null, [orgs.data, orgId]);

  const projects = useAsync(() => listOrgProjects(orgId), [orgId]);
  const members = useAsync(() => listOrgMembers(orgId), [orgId]);

  const canManage = org?.role === "owner" || org?.role === "admin";
  const invites = useAsync(
    () => (canManage ? listOrgInvitations(orgId) : Promise.resolve([])),
    [orgId, canManage],
  );

  const [creatingProject, setCreatingProject] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [renaming, setRenaming] = useState(false);

  if (orgs.data && !org) {
    return <p className="text-sm text-ink-muted">Organization not found.</p>;
  }

  return (
    <section className="flex flex-col gap-12">
      <header>
        <Link href="/organizations" className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
          ← Organizations
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="font-display text-4xl font-medium tracking-tight">{org?.name ?? "…"}</h1>
          {org?.role && <Badge tone="green">{org.role}</Badge>}
          {org?.isDefault && <Badge tone="neutral">Default</Badge>}
        </div>
        {org?.description && <p className="mt-2 text-ink-muted">{org.description}</p>}
        {org && !org.isDefault && (
          <button
            type="button"
            onClick={async () => {
              await setDefaultOrganization(orgId);
              orgs.reload();
            }}
            className="mt-3 text-sm text-accent underline-offset-4 hover:underline"
          >
            Set as default
          </button>
        )}
      </header>

      {/* Projects */}
      <div>
        <SectionHeader title="Projects">
          <Button variant="secondary" onClick={() => setCreatingProject(true)}>
            New project
          </Button>
        </SectionHeader>
        {projects.data?.length === 0 && <p className="py-6 text-sm text-ink-muted">No projects yet.</p>}
        <div className="flex flex-col">
          {projects.data?.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center justify-between border-b border-rule py-4 transition-colors hover:bg-ink/[0.02]"
            >
              <div>
                <p className="font-display font-medium tracking-tight text-ink">{p.name}</p>
                {p.description && <p className="mt-0.5 text-sm text-ink-muted">{p.description}</p>}
              </div>
              <span className="text-xs text-ink-faint">
                {p.maxTenants} tenants · {p.maxCompute} vCPU · {p.maxMemoryGb}Gi
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Members */}
      <div>
        <SectionHeader title="Members">
          {canManage && (
            <Button variant="secondary" onClick={() => setInviting(true)}>
              Invite member
            </Button>
          )}
        </SectionHeader>
        <MemberTable
          members={members.data ?? []}
          roles={ORG_ROLES}
          canManage={!!canManage}
          onChangeRole={async (userId, role) => {
            await updateOrgMemberRole(orgId, userId, role);
            members.reload();
          }}
          onRemove={async (userId) => {
            await removeOrgMember(orgId, userId);
            members.reload();
          }}
        />
      </div>

      {/* Pending invitations (managers only) */}
      {canManage && invites.data && invites.data.length > 0 && (
        <div>
          <SectionHeader title="Sent invitations" />
          <ul className="flex flex-col">
            {invites.data.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between border-b border-rule py-3 text-sm">
                <span className="text-ink">{inv.inviteeEmail}</span>
                <span className="flex items-center gap-3">
                  <span className="capitalize text-ink-muted">{inv.role}</span>
                  <Badge tone={inv.status === "pending" ? "amber" : "neutral"}>{inv.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Settings */}
      {canManage && (
        <div>
          <SectionHeader title="Settings" />
          <div className="flex flex-wrap gap-3 py-2">
            <Button variant="secondary" onClick={() => setRenaming(true)}>
              Rename
            </Button>
            {org?.role === "owner" && (
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm(`Delete organization "${org?.name}"? This removes its projects and memberships.`)) return;
                  await deleteOrganization(orgId);
                  router.push("/organizations");
                }}
              >
                Delete organization
              </Button>
            )}
          </div>
        </div>
      )}

      <NameDialog
        open={creatingProject}
        onClose={() => setCreatingProject(false)}
        title="Create a project"
        submitLabel="Create project"
        nameHint="Projects hold tenants and carry compute/memory quotas."
        onSubmit={async (name, description) => {
          await createProject(orgId, { name, description });
          projects.reload();
        }}
      />
      <NameDialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Rename organization"
        eyebrow="Edit"
        submitLabel="Save"
        initialName={org?.name ?? ""}
        initialDescription={org?.description ?? ""}
        onSubmit={async (name, description) => {
          await updateOrganization(orgId, { name, description });
          orgs.reload();
        }}
      />
      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        roles={ORG_ROLES}
        defaultRole="member"
        onSubmit={async (email, role) => {
          await createOrgInvitation(orgId, email, role);
          invites.reload();
        }}
      />
    </section>
  );
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between border-b-2 border-ink pb-3">
      <h2 className="font-display text-xl font-medium tracking-tight">{title}</h2>
      {children}
    </div>
  );
}
