export type TenantPhase =
  | "Pending"
  | "Provisioning"
  | "Ready"
  | "Deleting"
  | "Failed"
  | "Unknown";

export const TRANSITIONAL_PHASES: readonly TenantPhase[] = [
  "Pending",
  "Provisioning",
  "Deleting",
];

export function isTransitional(phase: TenantPhase): boolean {
  return TRANSITIONAL_PHASES.includes(phase);
}

export interface TenantResources {
  cpu?: string;
  memory?: string;
  storage?: string;
}

export interface Tenant {
  name: string;
  displayName: string;
  owner: string;
  phase: TenantPhase;
  message: string;
  resources: TenantResources;
  createdAt: string;
}

export interface CreateTenantInput {
  name: string;
  displayName?: string;
  resources?: TenantResources;
}

// ---- Tenancy: organizations, projects, members, invitations ----

export type OrgRole = "owner" | "admin" | "member";
export type ProjectRole = "maintainer" | "member";

export interface Organization {
  id: string;
  name: string;
  description: string;
  role?: OrgRole;
  isDefault: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  maxTenants: number;
  maxCompute: number;
  maxMemoryGb: number;
  createdAt: string;
}

export interface Member {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  isDefault?: boolean;
}

export interface Invitation {
  id: string;
  organizationId: string;
  projectId?: string;
  name: string;
  inviterEmail: string;
  inviteeEmail: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface OrgStats {
  projects: number;
  members: number;
  tenants: number;
}

export interface ProjectStats {
  members: number;
  tenants: number;
  maxTenants: number;
  maxCompute: number;
  maxMemoryGb: number;
}
