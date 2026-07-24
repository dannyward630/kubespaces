package server

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/kubespaces-io/kubespaces/api/internal/store"
)

const (
	defaultMaxTenants = 10
	defaultMaxCompute = 100
	defaultMaxMemory  = 100
)

func (s *Server) handleListOrgProjects(w http.ResponseWriter, r *http.Request) {
	_, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleMember)
	if !ok {
		return
	}
	projects, err := s.tenancy.ListProjectsForOrg(r.Context(), org.ID)
	if err != nil {
		respondInternal(w, "list org projects", err)
		return
	}
	respondJSON(w, http.StatusOK, projResponses(projects))
}

func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	u, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleMember)
	if !ok {
		return
	}
	var req createProjectRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := validateDisplayName("project", req.Name); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	p := store.Project{
		OrganizationID: org.ID,
		Name:           strings.TrimSpace(req.Name),
		Description:    req.Description,
		MaxTenants:     orDefault(req.MaxTenants, defaultMaxTenants),
		MaxCompute:     orDefault(req.MaxCompute, defaultMaxCompute),
		MaxMemoryGB:    orDefault(req.MaxMemoryGB, defaultMaxMemory),
	}
	created, err := s.tenancy.CreateProject(r.Context(), p, u.ID)
	if errors.Is(err, store.ErrConflict) {
		respondError(w, http.StatusConflict, "a project with that name already exists in this organization")
		return
	}
	if err != nil {
		respondInternal(w, "create project", err)
		return
	}
	respondJSON(w, http.StatusCreated, projResponse(created))
}

func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	u, ok := caller(w, r)
	if !ok {
		return
	}
	projects, err := s.tenancy.ListProjectsForUser(r.Context(), u.ID)
	if err != nil {
		respondInternal(w, "list projects", err)
		return
	}
	respondJSON(w, http.StatusOK, projResponses(projects))
}

func (s *Server) handleGetProject(w http.ResponseWriter, r *http.Request) {
	_, p, ok := s.requireProject(w, r, chi.URLParam(r, "id"), store.RoleMember)
	if !ok {
		return
	}
	respondJSON(w, http.StatusOK, projResponse(p))
}

func (s *Server) handleUpdateProject(w http.ResponseWriter, r *http.Request) {
	_, p, ok := s.requireProject(w, r, chi.URLParam(r, "id"), store.RoleMaintainer)
	if !ok {
		return
	}
	var req updateProjectRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := validateDisplayName("project", req.Name); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.tenancy.UpdateProject(r.Context(), p.ID, strings.TrimSpace(req.Name), req.Description); err != nil {
		if errors.Is(err, store.ErrConflict) {
			respondError(w, http.StatusConflict, "a project with that name already exists in this organization")
			return
		}
		respondInternal(w, "update project", err)
		return
	}
	p.Name, p.Description = strings.TrimSpace(req.Name), req.Description
	respondJSON(w, http.StatusOK, projResponse(p))
}

// handleUpdateProjectQuotas is org-governance: only org admins/owners (or
// platform admins) may change quotas, not project maintainers.
func (s *Server) handleUpdateProjectQuotas(w http.ResponseWriter, r *http.Request) {
	u, ok := caller(w, r)
	if !ok {
		return
	}
	p, err := s.tenancy.GetProject(r.Context(), chi.URLParam(r, "id"))
	if errors.Is(err, store.ErrNotFound) {
		respondError(w, http.StatusNotFound, "project not found")
		return
	}
	if err != nil {
		respondInternal(w, "get project", err)
		return
	}
	if allowed, err := s.orgRoleAtLeast(r.Context(), u, p.OrganizationID, store.RoleAdmin); err != nil {
		respondInternal(w, "check org role", err)
		return
	} else if !allowed {
		respondError(w, http.StatusForbidden, "only organization admins can change project quotas")
		return
	}
	var req updateQuotasRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	p.MaxTenants = orDefault(req.MaxTenants, p.MaxTenants)
	p.MaxCompute = orDefault(req.MaxCompute, p.MaxCompute)
	p.MaxMemoryGB = orDefault(req.MaxMemoryGB, p.MaxMemoryGB)
	if err := s.tenancy.UpdateProjectQuotas(r.Context(), p.ID, p.MaxTenants, p.MaxCompute, p.MaxMemoryGB); err != nil {
		respondInternal(w, "update project quotas", err)
		return
	}
	respondJSON(w, http.StatusOK, projResponse(p))
}

func (s *Server) handleDeleteProject(w http.ResponseWriter, r *http.Request) {
	_, p, ok := s.requireProject(w, r, chi.URLParam(r, "id"), store.RoleMaintainer)
	if !ok {
		return
	}
	if err := s.tenancy.DeleteProject(r.Context(), p.ID); err != nil {
		respondInternal(w, "delete project", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleProjectStats(w http.ResponseWriter, r *http.Request) {
	_, p, ok := s.requireProject(w, r, chi.URLParam(r, "id"), store.RoleMember)
	if !ok {
		return
	}
	members, tenants, err := s.tenancy.ProjectStats(r.Context(), p.ID)
	if err != nil {
		respondInternal(w, "project stats", err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]int{
		"members": members, "tenants": tenants,
		"maxTenants": p.MaxTenants, "maxCompute": p.MaxCompute, "maxMemoryGb": p.MaxMemoryGB,
	})
}

// ---- Project membership ----

func (s *Server) handleListProjectMembers(w http.ResponseWriter, r *http.Request) {
	_, p, ok := s.requireProject(w, r, chi.URLParam(r, "id"), store.RoleMember)
	if !ok {
		return
	}
	members, err := s.tenancy.ListProjectMembers(r.Context(), p.ID)
	if err != nil {
		respondInternal(w, "list project members", err)
		return
	}
	respondJSON(w, http.StatusOK, memberResponses(members))
}

func (s *Server) handleAddProjectMember(w http.ResponseWriter, r *http.Request) {
	_, p, ok := s.requireProject(w, r, chi.URLParam(r, "id"), store.RoleMaintainer)
	if !ok {
		return
	}
	var req addMemberRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	role, err := validateProjectRole(req.Role)
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
	if err := s.tenancy.AddProjectMember(r.Context(), p.ID, target.ID, role); err != nil {
		respondInternal(w, "add project member", err)
		return
	}
	respondJSON(w, http.StatusCreated, memberResponse{UserID: target.ID, Email: target.Email, DisplayName: target.DisplayName, Role: role})
}

func (s *Server) handleRemoveProjectMember(w http.ResponseWriter, r *http.Request) {
	_, p, ok := s.requireProject(w, r, chi.URLParam(r, "id"), store.RoleMaintainer)
	if !ok {
		return
	}
	if err := s.tenancy.RemoveProjectMember(r.Context(), p.ID, chi.URLParam(r, "user_id")); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "member not found")
			return
		}
		respondInternal(w, "remove project member", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleUpdateProjectMemberRole(w http.ResponseWriter, r *http.Request) {
	_, p, ok := s.requireProject(w, r, chi.URLParam(r, "id"), store.RoleMaintainer)
	if !ok {
		return
	}
	var req updateRoleRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	role, err := validateProjectRole(req.Role)
	if err != nil || req.Role == "" {
		respondError(w, http.StatusBadRequest, "a valid role is required")
		return
	}
	if err := s.tenancy.UpdateProjectMemberRole(r.Context(), p.ID, chi.URLParam(r, "user_id"), role); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "member not found")
			return
		}
		respondInternal(w, "update project member role", err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"role": role})
}

func projResponses(projects []store.Project) []projectResponse {
	out := make([]projectResponse, 0, len(projects))
	for i := range projects {
		out = append(out, projResponse(&projects[i]))
	}
	return out
}

func orDefault(v, def int) int {
	if v <= 0 {
		return def
	}
	return v
}
