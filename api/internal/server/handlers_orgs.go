package server

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/kubespaces-io/kubespaces/api/internal/store"
)

func (s *Server) handleCreateOrg(w http.ResponseWriter, r *http.Request) {
	u, ok := caller(w, r)
	if !ok {
		return
	}
	var req createOrgRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := validateDisplayName("organization", req.Name); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	org, err := s.tenancy.CreateOrganization(r.Context(), strings.TrimSpace(req.Name), req.Description, u.ID)
	if err != nil {
		respondInternal(w, "create organization", err)
		return
	}
	respondJSON(w, http.StatusCreated, orgResponse(org, store.RoleOwner, false))
}

func (s *Server) handleListOrgs(w http.ResponseWriter, r *http.Request) {
	u, ok := caller(w, r)
	if !ok {
		return
	}
	orgs, err := s.tenancy.ListOrganizationsForUser(r.Context(), u.ID)
	if err != nil {
		respondInternal(w, "list organizations", err)
		return
	}
	out := make([]organizationResponse, 0, len(orgs))
	for i := range orgs {
		out = append(out, orgResponse(&orgs[i].Organization, orgs[i].Role, orgs[i].IsDefault))
	}
	respondJSON(w, http.StatusOK, out)
}

func (s *Server) handleGetDefaultOrg(w http.ResponseWriter, r *http.Request) {
	u, ok := caller(w, r)
	if !ok {
		return
	}
	org, err := s.tenancy.GetDefaultOrg(r.Context(), u.ID)
	if errors.Is(err, store.ErrNotFound) {
		respondError(w, http.StatusNotFound, "no default organization")
		return
	}
	if err != nil {
		respondInternal(w, "get default org", err)
		return
	}
	respondJSON(w, http.StatusOK, orgResponse(org, "", true))
}

func (s *Server) handleGetOrgByName(w http.ResponseWriter, r *http.Request) {
	u, ok := caller(w, r)
	if !ok {
		return
	}
	org, err := s.tenancy.GetOrganizationByName(r.Context(), chi.URLParam(r, "name"))
	if errors.Is(err, store.ErrNotFound) {
		respondError(w, http.StatusNotFound, "organization not found")
		return
	}
	if err != nil {
		respondInternal(w, "get org by name", err)
		return
	}
	// Only reveal orgs the caller belongs to (unless platform admin).
	if allowed, err := s.orgRoleAtLeast(r.Context(), u, org.ID, store.RoleMember); err != nil {
		respondInternal(w, "check org role", err)
		return
	} else if !allowed {
		respondError(w, http.StatusNotFound, "organization not found")
		return
	}
	respondJSON(w, http.StatusOK, orgResponse(org, "", false))
}

func (s *Server) handleGetOrg(w http.ResponseWriter, r *http.Request) {
	_, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleMember)
	if !ok {
		return
	}
	respondJSON(w, http.StatusOK, orgResponse(org, "", false))
}

func (s *Server) handleUpdateOrg(w http.ResponseWriter, r *http.Request) {
	_, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleAdmin)
	if !ok {
		return
	}
	var req updateOrgRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := validateDisplayName("organization", req.Name); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.tenancy.UpdateOrganization(r.Context(), org.ID, strings.TrimSpace(req.Name), req.Description); err != nil {
		respondInternal(w, "update organization", err)
		return
	}
	org.Name, org.Description = strings.TrimSpace(req.Name), req.Description
	respondJSON(w, http.StatusOK, orgResponse(org, "", false))
}

func (s *Server) handleDeleteOrg(w http.ResponseWriter, r *http.Request) {
	_, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleOwner)
	if !ok {
		return
	}
	if err := s.tenancy.DeleteOrganization(r.Context(), org.ID); err != nil {
		respondInternal(w, "delete organization", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleSetDefaultOrg(w http.ResponseWriter, r *http.Request) {
	u, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleMember)
	if !ok {
		return
	}
	if err := s.tenancy.SetDefaultOrg(r.Context(), u.ID, org.ID); err != nil {
		respondInternal(w, "set default org", err)
		return
	}
	respondJSON(w, http.StatusOK, orgResponse(org, "", true))
}

func (s *Server) handleOrgStats(w http.ResponseWriter, r *http.Request) {
	_, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleMember)
	if !ok {
		return
	}
	projects, members, tenants, err := s.tenancy.OrgStats(r.Context(), org.ID)
	if err != nil {
		respondInternal(w, "org stats", err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]int{"projects": projects, "members": members, "tenants": tenants})
}

// ---- Organization membership ----

func (s *Server) handleListOrgMembers(w http.ResponseWriter, r *http.Request) {
	_, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleMember)
	if !ok {
		return
	}
	members, err := s.tenancy.ListOrgMembers(r.Context(), org.ID)
	if err != nil {
		respondInternal(w, "list org members", err)
		return
	}
	respondJSON(w, http.StatusOK, memberResponses(members))
}

func (s *Server) handleAddOrgMember(w http.ResponseWriter, r *http.Request) {
	_, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleAdmin)
	if !ok {
		return
	}
	var req addMemberRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	role, err := validateOrgRole(req.Role)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	target, err := s.tenancy.GetUserByEmail(r.Context(), strings.TrimSpace(req.Email))
	if errors.Is(err, store.ErrNotFound) {
		respondError(w, http.StatusNotFound, "no user with that email has signed in yet — send an invitation instead")
		return
	}
	if err != nil {
		respondInternal(w, "lookup user", err)
		return
	}
	if err := s.tenancy.AddOrgMember(r.Context(), org.ID, target.ID, role); err != nil {
		respondInternal(w, "add org member", err)
		return
	}
	respondJSON(w, http.StatusCreated, memberResponse{UserID: target.ID, Email: target.Email, DisplayName: target.DisplayName, Role: role})
}

func (s *Server) handleRemoveOrgMember(w http.ResponseWriter, r *http.Request) {
	_, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleAdmin)
	if !ok {
		return
	}
	if err := s.tenancy.RemoveOrgMember(r.Context(), org.ID, chi.URLParam(r, "user_id")); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "member not found")
			return
		}
		respondInternal(w, "remove org member", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleUpdateOrgMemberRole(w http.ResponseWriter, r *http.Request) {
	_, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleAdmin)
	if !ok {
		return
	}
	var req updateRoleRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	role, err := validateOrgRole(req.Role)
	if err != nil || req.Role == "" {
		respondError(w, http.StatusBadRequest, "a valid role is required")
		return
	}
	if err := s.tenancy.UpdateOrgMemberRole(r.Context(), org.ID, chi.URLParam(r, "user_id"), role); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "member not found")
			return
		}
		respondInternal(w, "update org member role", err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"role": role})
}
