package server

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/kubespaces-io/kubespaces/api/internal/store"
)

// requireAdmin ensures the caller is a platform admin.
func (s *Server) requireAdmin(w http.ResponseWriter, r *http.Request) (*store.User, bool) {
	u, ok := caller(w, r)
	if !ok {
		return nil, false
	}
	if !u.IsAdmin {
		respondError(w, http.StatusForbidden, "platform admin access required")
		return nil, false
	}
	return u, true
}

func (s *Server) handleAdminListUsers(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	users, err := s.tenancy.ListUsers(r.Context())
	if err != nil {
		respondInternal(w, "list users", err)
		return
	}
	respondJSON(w, http.StatusOK, userResponses(users))
}

func (s *Server) handleAdminSetUserAdmin(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	var req setAdminRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := s.tenancy.SetUserAdmin(r.Context(), chi.URLParam(r, "id"), req.IsAdmin); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "user not found")
			return
		}
		respondInternal(w, "set user admin", err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"isAdmin": req.IsAdmin})
}
