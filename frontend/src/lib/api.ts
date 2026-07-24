import type {
  CreateTenantInput,
  Tenant,
  Organization,
  Project,
  Member,
  Invitation,
  AdminUser,
  OrgStats,
  ProjectStats,
} from "@/lib/types";

/** Error raised for non-2xx responses from the KubeSpaces API. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body: { error?: string } = await response.json();
      if (body.error) message = body.error;
    } catch {
      // non-JSON error body — keep the generic message
    }
    if (response.status === 401) {
      message = "Your session has expired — please sign in again.";
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 202 || response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function listTenants(): Promise<Tenant[]> {
  return request<Tenant[]>("/tenants");
}

export function getTenant(name: string): Promise<Tenant> {
  return request<Tenant>(`/tenants/${encodeURIComponent(name)}`);
}

export function createTenant(input: CreateTenantInput): Promise<Tenant> {
  return request<Tenant>("/tenants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteTenant(name: string): Promise<void> {
  return request<void>(`/tenants/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

/** Fetches the kubeconfig YAML and triggers a browser download. */
export async function downloadKubeconfig(name: string): Promise<void> {
  const response = await fetch(
    `/api/v1/tenants/${encodeURIComponent(name)}/kubeconfig`,
  );
  if (!response.ok) {
    let message = `Kubeconfig download failed (${response.status})`;
    try {
      const body: { error?: string } = await response.json();
      if (body.error) message = body.error;
    } catch {
      // ignore non-JSON body
    }
    throw new ApiError(response.status, message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name}-kubeconfig.yaml`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ---- Tenancy: organizations, projects, members, invitations, admin ----

const jsonBody = (data: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

// Organizations
export const listOrganizations = () => request<Organization[]>("/organizations");
export const getOrganization = (id: string) =>
  request<Organization>(`/organizations/${id}`);
export const createOrganization = (input: { name: string; description?: string }) =>
  request<Organization>("/organizations", jsonBody(input));
export const updateOrganization = (
  id: string,
  input: { name: string; description?: string },
) => request<Organization>(`/organizations/${id}`, { ...jsonBody(input), method: "PUT" });
export const deleteOrganization = (id: string) =>
  request<void>(`/organizations/${id}`, { method: "DELETE" });
export const setDefaultOrganization = (id: string) =>
  request<Organization>(`/organizations/${id}/default`, { method: "PUT" });
export const getOrgStats = (id: string) =>
  request<OrgStats>(`/organizations/${id}/stats`);

// Organization membership
export const listOrgMembers = (id: string) =>
  request<Member[]>(`/organizations/${id}/users`);
export const addOrgMember = (id: string, email: string, role: string) =>
  request<Member>(`/organizations/${id}/users`, jsonBody({ email, role }));
export const removeOrgMember = (id: string, userId: string) =>
  request<void>(`/organizations/${id}/users/${userId}`, { method: "DELETE" });
export const updateOrgMemberRole = (id: string, userId: string, role: string) =>
  request<{ role: string }>(`/organizations/${id}/users/${userId}/role`, {
    ...jsonBody({ role }),
    method: "PATCH",
  });

// Projects
export const listOrgProjects = (id: string) =>
  request<Project[]>(`/organizations/${id}/projects`);
export const createProject = (
  orgId: string,
  input: { name: string; description?: string; maxTenants?: number; maxCompute?: number; maxMemoryGb?: number },
) => request<Project>(`/organizations/${orgId}/projects`, jsonBody(input));
export const listProjects = () => request<Project[]>("/projects");
export const getProject = (id: string) => request<Project>(`/projects/${id}`);
export const updateProject = (id: string, input: { name: string; description?: string }) =>
  request<Project>(`/projects/${id}`, { ...jsonBody(input), method: "PUT" });
export const updateProjectQuotas = (
  id: string,
  input: { maxTenants: number; maxCompute: number; maxMemoryGb: number },
) => request<Project>(`/projects/${id}/quotas`, { ...jsonBody(input), method: "PATCH" });
export const deleteProject = (id: string) =>
  request<void>(`/projects/${id}`, { method: "DELETE" });
export const getProjectStats = (id: string) =>
  request<ProjectStats>(`/projects/${id}/stats`);

// Project membership
export const listProjectMembers = (id: string) =>
  request<Member[]>(`/projects/${id}/users`);
export const addProjectMember = (id: string, email: string, role: string) =>
  request<Member>(`/projects/${id}/users`, jsonBody({ email, role }));
export const removeProjectMember = (id: string, userId: string) =>
  request<void>(`/projects/${id}/users/${userId}`, { method: "DELETE" });
export const updateProjectMemberRole = (id: string, userId: string, role: string) =>
  request<{ role: string }>(`/projects/${id}/users/${userId}/role`, {
    ...jsonBody({ role }),
    method: "PATCH",
  });

// Invitations
export const listOrgInvitations = (id: string) =>
  request<Invitation[]>(`/organizations/${id}/invitations`);
export const createOrgInvitation = (id: string, email: string, role: string) =>
  request<Invitation>(`/organizations/${id}/invitations`, jsonBody({ email, role }));
export const listMyOrgInvitations = () =>
  request<Invitation[]>("/organizations/invitations");
export const acceptOrgInvitation = (id: string) =>
  request<unknown>(`/organizations/invitations/${id}/accept`, { method: "POST" });
export const declineOrgInvitation = (id: string) =>
  request<unknown>(`/organizations/invitations/${id}/decline`, { method: "POST" });

export const listProjectInvitations = (id: string) =>
  request<Invitation[]>(`/projects/${id}/invitations`);
export const createProjectInvitation = (id: string, email: string, role: string) =>
  request<Invitation>(`/projects/${id}/invitations`, jsonBody({ email, role }));
export const listMyProjectInvitations = () =>
  request<Invitation[]>("/projects/invitations");
export const acceptProjectInvitation = (id: string) =>
  request<unknown>(`/projects/invitations/${id}/accept`, { method: "POST" });
export const declineProjectInvitation = (id: string) =>
  request<unknown>(`/projects/invitations/${id}/decline`, { method: "POST" });

// Admin
export const adminListUsers = () => request<AdminUser[]>("/admin/users");
export const adminSetUserAdmin = (id: string, isAdmin: boolean) =>
  request<{ isAdmin: boolean }>(`/admin/users/${id}/admin`, jsonBody({ isAdmin }));

export interface Me {
  subject: string;
  email: string;
  roles: string[];
}
export const getMe = () => request<Me>("/me");
