package server

import (
	"context"
	"errors"
	"net/http"

	"github.com/kubespaces-io/kubespaces/api/internal/store"
)

// Role rank for comparisons. Higher = more privilege.
var orgRoleRank = map[string]int{
	store.RoleMember: 1,
	store.RoleAdmin:  2,
	store.RoleOwner:  3,
}

var projectRoleRank = map[string]int{
	store.RoleMember:     1,
	store.RoleMaintainer: 2,
}

// caller returns the provisioned user or writes 401 and returns false.
func caller(w http.ResponseWriter, r *http.Request) (*store.User, bool) {
	u, ok := userFromContext(r.Context())
	if !ok {
		respondError(w, http.StatusUnauthorized, "missing authentication")
		return nil, false
	}
	return u, true
}

// orgRoleAtLeast reports whether the user's role in the org meets minRole.
// Platform admins always pass. Non-members get (false, nil).
func (s *Server) orgRoleAtLeast(ctx context.Context, u *store.User, orgID, minRole string) (bool, error) {
	if u.IsAdmin {
		return true, nil
	}
	role, err := s.tenancy.GetOrgMemberRole(ctx, orgID, u.ID)
	if errors.Is(err, store.ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return orgRoleRank[role] >= orgRoleRank[minRole], nil
}

// projectAccessAtLeast reports whether the user can act on a project at the
// given project-role level. Org owners/admins and platform admins always pass;
// otherwise the user's project role must meet minRole.
func (s *Server) projectAccessAtLeast(ctx context.Context, u *store.User, p *store.Project, minRole string) (bool, error) {
	if u.IsAdmin {
		return true, nil
	}
	// Org owner/admin can manage any project in the org.
	if ok, err := s.orgRoleAtLeast(ctx, u, p.OrganizationID, store.RoleAdmin); err != nil {
		return false, err
	} else if ok {
		return true, nil
	}
	role, err := s.tenancy.GetProjectMemberRole(ctx, p.ID, u.ID)
	if errors.Is(err, store.ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return projectRoleRank[role] >= projectRoleRank[minRole], nil
}

// requireOrg loads an org and enforces the caller holds at least minRole.
// On failure it writes the response and returns ok=false.
func (s *Server) requireOrg(w http.ResponseWriter, r *http.Request, orgID, minRole string) (*store.User, *store.Organization, bool) {
	u, ok := caller(w, r)
	if !ok {
		return nil, nil, false
	}
	org, err := s.tenancy.GetOrganization(r.Context(), orgID)
	if errors.Is(err, store.ErrNotFound) {
		respondError(w, http.StatusNotFound, "organization not found")
		return nil, nil, false
	}
	if err != nil {
		respondInternal(w, "get organization", err)
		return nil, nil, false
	}
	allowed, err := s.orgRoleAtLeast(r.Context(), u, orgID, minRole)
	if err != nil {
		respondInternal(w, "check org role", err)
		return nil, nil, false
	}
	if !allowed {
		respondError(w, http.StatusForbidden, "insufficient permissions for this organization")
		return nil, nil, false
	}
	return u, org, true
}

// requireProject loads a project and enforces the caller's project access.
func (s *Server) requireProject(w http.ResponseWriter, r *http.Request, projectID, minRole string) (*store.User, *store.Project, bool) {
	u, ok := caller(w, r)
	if !ok {
		return nil, nil, false
	}
	p, err := s.tenancy.GetProject(r.Context(), projectID)
	if errors.Is(err, store.ErrNotFound) {
		respondError(w, http.StatusNotFound, "project not found")
		return nil, nil, false
	}
	if err != nil {
		respondInternal(w, "get project", err)
		return nil, nil, false
	}
	allowed, err := s.projectAccessAtLeast(r.Context(), u, p, minRole)
	if err != nil {
		respondInternal(w, "check project role", err)
		return nil, nil, false
	}
	if !allowed {
		respondError(w, http.StatusForbidden, "insufficient permissions for this project")
		return nil, nil, false
	}
	return u, p, true
}
