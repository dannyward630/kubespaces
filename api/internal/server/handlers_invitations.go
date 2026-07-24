package server

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/kubespaces-io/kubespaces/api/internal/store"
)

// Email delivery is best-effort: with no SMTP configured we log the invite so
// the address is recorded and the invitee can still see it via their pending
// invitations list. Wiring an SMTP sender here is a drop-in follow-up.
func logInvite(kind, email, name string) {
	slog.Info("invitation created", "kind", kind, "invitee", email, "target", name)
}

// ---- Organization invitations ----

func (s *Server) handleCreateOrgInvitation(w http.ResponseWriter, r *http.Request) {
	u, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleAdmin)
	if !ok {
		return
	}
	var req createInvitationRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := validateEmail(req.Email); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	role, err := validateOrgRole(req.Role)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	email := strings.TrimSpace(req.Email)
	invite, err := s.tenancy.CreateOrgInvitation(r.Context(), org.ID, u.ID, email, role, time.Now().AddDate(0, 0, invitationDays))
	if err != nil {
		respondInternal(w, "create org invitation", err)
		return
	}
	logInvite("organization", email, org.Name)
	respondJSON(w, http.StatusCreated, orgInviteResponse(invite))
}

func (s *Server) handleListOrgInvitations(w http.ResponseWriter, r *http.Request) {
	_, org, ok := s.requireOrg(w, r, chi.URLParam(r, "id"), store.RoleAdmin)
	if !ok {
		return
	}
	invites, err := s.tenancy.ListOrgInvitations(r.Context(), org.ID)
	if err != nil {
		respondInternal(w, "list org invitations", err)
		return
	}
	respondJSON(w, http.StatusOK, mapOrgInvites(invites))
}

func (s *Server) handleListMyOrgInvitations(w http.ResponseWriter, r *http.Request) {
	u, ok := caller(w, r)
	if !ok {
		return
	}
	invites, err := s.tenancy.ListOrgInvitationsForEmail(r.Context(), u.Email)
	if err != nil {
		respondInternal(w, "list my org invitations", err)
		return
	}
	respondJSON(w, http.StatusOK, mapOrgInvites(invites))
}

func (s *Server) handleAcceptOrgInvitation(w http.ResponseWriter, r *http.Request) {
	u, invite, ok := s.loadOrgInviteForCaller(w, r)
	if !ok {
		return
	}
	if err := s.tenancy.AcceptOrgInvitation(r.Context(), invite.ID, u.ID); err != nil {
		if errors.Is(err, store.ErrInviteNotAcceptable) {
			respondError(w, http.StatusConflict, "this invitation has expired or was already handled")
			return
		}
		respondInternal(w, "accept org invitation", err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": store.InviteAccepted, "organizationId": invite.OrganizationID})
}

func (s *Server) handleDeclineOrgInvitation(w http.ResponseWriter, r *http.Request) {
	_, invite, ok := s.loadOrgInviteForCaller(w, r)
	if !ok {
		return
	}
	if err := s.tenancy.SetOrgInvitationStatus(r.Context(), invite.ID, store.InviteDeclined); err != nil {
		respondInternal(w, "decline org invitation", err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": store.InviteDeclined})
}

// loadOrgInviteForCaller fetches an invitation and verifies it is addressed to
// the caller.
func (s *Server) loadOrgInviteForCaller(w http.ResponseWriter, r *http.Request) (*store.User, *store.OrgInvitation, bool) {
	u, ok := caller(w, r)
	if !ok {
		return nil, nil, false
	}
	invite, err := s.tenancy.GetOrgInvitation(r.Context(), chi.URLParam(r, "id"))
	if errors.Is(err, store.ErrNotFound) {
		respondError(w, http.StatusNotFound, "invitation not found")
		return nil, nil, false
	}
	if err != nil {
		respondInternal(w, "get org invitation", err)
		return nil, nil, false
	}
	if !strings.EqualFold(invite.InviteeEmail, u.Email) {
		respondError(w, http.StatusForbidden, "this invitation is addressed to someone else")
		return nil, nil, false
	}
	return u, invite, true
}

func mapOrgInvites(invites []store.OrgInvitation) []invitationResponse {
	out := make([]invitationResponse, 0, len(invites))
	for i := range invites {
		out = append(out, orgInviteResponse(&invites[i]))
	}
	return out
}

// ---- Project invitations ----

func (s *Server) handleCreateProjectInvitation(w http.ResponseWriter, r *http.Request) {
	u, p, ok := s.requireProject(w, r, chi.URLParam(r, "id"), store.RoleMaintainer)
	if !ok {
		return
	}
	var req createInvitationRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := validateEmail(req.Email); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	role, err := validateProjectRole(req.Role)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	email := strings.TrimSpace(req.Email)
	invite, err := s.tenancy.CreateProjectInvitation(r.Context(), p.ID, p.OrganizationID, u.ID, email, role, time.Now().AddDate(0, 0, invitationDays))
	if err != nil {
		respondInternal(w, "create project invitation", err)
		return
	}
	logInvite("project", email, p.Name)
	respondJSON(w, http.StatusCreated, projInviteResponse(invite))
}

func (s *Server) handleListProjectInvitations(w http.ResponseWriter, r *http.Request) {
	_, p, ok := s.requireProject(w, r, chi.URLParam(r, "id"), store.RoleMaintainer)
	if !ok {
		return
	}
	invites, err := s.tenancy.ListProjectInvitations(r.Context(), p.ID)
	if err != nil {
		respondInternal(w, "list project invitations", err)
		return
	}
	respondJSON(w, http.StatusOK, mapProjInvites(invites))
}

func (s *Server) handleListMyProjectInvitations(w http.ResponseWriter, r *http.Request) {
	u, ok := caller(w, r)
	if !ok {
		return
	}
	invites, err := s.tenancy.ListProjectInvitationsForEmail(r.Context(), u.Email)
	if err != nil {
		respondInternal(w, "list my project invitations", err)
		return
	}
	respondJSON(w, http.StatusOK, mapProjInvites(invites))
}

func (s *Server) handleAcceptProjectInvitation(w http.ResponseWriter, r *http.Request) {
	u, invite, ok := s.loadProjectInviteForCaller(w, r)
	if !ok {
		return
	}
	if err := s.tenancy.AcceptProjectInvitation(r.Context(), invite.ID, u.ID); err != nil {
		if errors.Is(err, store.ErrInviteNotAcceptable) {
			respondError(w, http.StatusConflict, "this invitation has expired or was already handled")
			return
		}
		respondInternal(w, "accept project invitation", err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": store.InviteAccepted, "projectId": invite.ProjectID})
}

func (s *Server) handleDeclineProjectInvitation(w http.ResponseWriter, r *http.Request) {
	_, invite, ok := s.loadProjectInviteForCaller(w, r)
	if !ok {
		return
	}
	if err := s.tenancy.SetProjectInvitationStatus(r.Context(), invite.ID, store.InviteDeclined); err != nil {
		respondInternal(w, "decline project invitation", err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": store.InviteDeclined})
}

func (s *Server) loadProjectInviteForCaller(w http.ResponseWriter, r *http.Request) (*store.User, *store.ProjectInvitation, bool) {
	u, ok := caller(w, r)
	if !ok {
		return nil, nil, false
	}
	invite, err := s.tenancy.GetProjectInvitation(r.Context(), chi.URLParam(r, "id"))
	if errors.Is(err, store.ErrNotFound) {
		respondError(w, http.StatusNotFound, "invitation not found")
		return nil, nil, false
	}
	if err != nil {
		respondInternal(w, "get project invitation", err)
		return nil, nil, false
	}
	if !strings.EqualFold(invite.InviteeEmail, u.Email) {
		respondError(w, http.StatusForbidden, "this invitation is addressed to someone else")
		return nil, nil, false
	}
	return u, invite, true
}

func mapProjInvites(invites []store.ProjectInvitation) []invitationResponse {
	out := make([]invitationResponse, 0, len(invites))
	for i := range invites {
		out = append(out, projInviteResponse(&invites[i]))
	}
	return out
}
