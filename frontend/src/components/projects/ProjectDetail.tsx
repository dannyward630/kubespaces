"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { InviteDialog } from "@/components/tenancy/InviteDialog";
import { MemberTable } from "@/components/tenancy/MemberTable";
import { useAsync } from "@/hooks/useAsync";
import {
  getMe,
  getProject,
  listOrganizations,
  listProjectMembers,
  listProjectInvitations,
  addProjectMember, // referenced for completeness
  createProjectInvitation,
  updateProjectMemberRole,
  removeProjectMember,
  updateProjectQuotas,
  deleteProject,
} from "@/lib/api";
import type { Project } from "@/lib/types";

const PROJECT_ROLES = ["member", "maintainer"];
void addProjectMember;

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const me = useAsync(getMe, []);
  const orgs = useAsync(listOrganizations, []);
  const project = useAsync(() => getProject(projectId), [projectId]);
  const members = useAsync(() => listProjectMembers(projectId), [projectId]);

  const orgRole = useMemo(
    () => orgs.data?.find((o) => o.id === project.data?.organizationId)?.role,
    [orgs.data, project.data],
  );
  const myProjectRole = useMemo(
    () => members.data?.find((m) => m.email === me.data?.email)?.role,
    [members.data, me.data],
  );
  const isPlatformAdmin = me.data?.roles?.includes("kubespaces-admin") ?? false;
  const orgManager = orgRole === "owner" || orgRole === "admin";
  const canManage = orgManager || myProjectRole === "maintainer" || isPlatformAdmin;
  const canEditQuotas = orgManager || isPlatformAdmin;

  const invites = useAsync(
    () => (canManage ? listProjectInvitations(projectId) : Promise.resolve([])),
    [projectId, canManage],
  );

  const [inviting, setInviting] = useState(false);
  const [editingQuotas, setEditingQuotas] = useState(false);

  const p = project.data;

  return (
    <section className="flex flex-col gap-12">
      <header>
        <Link
          href={p ? `/organizations/${p.organizationId}` : "/organizations"}
          className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          ← Organization
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="font-display text-4xl font-medium tracking-tight">{p?.name ?? "…"}</h1>
          {myProjectRole && <Badge tone="green">{myProjectRole}</Badge>}
        </div>
        {p?.description && <p className="mt-2 text-ink-muted">{p.description}</p>}
        {project.error && (
          <p role="alert" className="mt-4 border-l-2 border-status-red bg-status-red-bg px-3 py-2 text-sm text-status-red">
            {project.error}
          </p>
        )}
      </header>

      {/* Quotas */}
      {p && (
        <div>
          <SectionHeader title="Quotas">
            {canEditQuotas && (
              <Button variant="secondary" onClick={() => setEditingQuotas(true)}>
                Edit quotas
              </Button>
            )}
          </SectionHeader>
          <dl className="grid grid-cols-3 gap-px overflow-hidden border border-rule bg-rule">
            <Quota label="Max tenants" value={`${p.maxTenants}`} />
            <Quota label="Max compute" value={`${p.maxCompute} vCPU`} />
            <Quota label="Max memory" value={`${p.maxMemoryGb} Gi`} />
          </dl>
        </div>
      )}

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
          roles={PROJECT_ROLES}
          canManage={canManage}
          onChangeRole={async (userId, role) => {
            await updateProjectMemberRole(projectId, userId, role);
            members.reload();
          }}
          onRemove={async (userId) => {
            await removeProjectMember(projectId, userId);
            members.reload();
          }}
        />
      </div>

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

      {canManage && (
        <div>
          <SectionHeader title="Settings" />
          <div className="py-2">
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm(`Delete project "${p?.name}"?`)) return;
                await deleteProject(projectId);
                router.push(p ? `/organizations/${p.organizationId}` : "/organizations");
              }}
            >
              Delete project
            </Button>
          </div>
        </div>
      )}

      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        roles={PROJECT_ROLES}
        defaultRole="member"
        onSubmit={async (email, role) => {
          await createProjectInvitation(projectId, email, role);
          invites.reload();
        }}
      />
      {p && (
        <QuotaDialog
          open={editingQuotas}
          onClose={() => setEditingQuotas(false)}
          project={p}
          onSaved={() => project.reload()}
        />
      )}
    </section>
  );
}

function Quota({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper-raised px-5 py-4">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-medium tracking-tight text-ink">{value}</dd>
    </div>
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

function QuotaDialog({
  open,
  onClose,
  project,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  onSaved: () => void;
}) {
  const [tenants, setTenants] = useState(String(project.maxTenants));
  const [compute, setCompute] = useState(String(project.maxCompute));
  const [memory, setMemory] = useState(String(project.maxMemoryGb));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateProjectQuotas(project.id, {
        maxTenants: Number(tenants),
        maxCompute: Number(compute),
        maxMemoryGb: Number(memory),
      });
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} labelledBy="quota-dialog-title">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <h2 id="quota-dialog-title" className="font-display text-2xl font-medium tracking-tight">
          Edit quotas
        </h2>
        <Field id="q-tenants" label="Max tenants" type="number" min={1} value={tenants} onChange={(e) => setTenants(e.target.value)} />
        <Field id="q-compute" label="Max compute (vCPU)" type="number" min={1} value={compute} onChange={(e) => setCompute(e.target.value)} />
        <Field id="q-memory" label="Max memory (Gi)" type="number" min={1} error={error} value={memory} onChange={(e) => setMemory(e.target.value)} />
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save quotas
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
