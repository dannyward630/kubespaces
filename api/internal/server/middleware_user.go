package server

import (
	"context"
	"net/http"

	"github.com/kubespaces-io/kubespaces/api/internal/auth"
	"github.com/kubespaces-io/kubespaces/api/internal/store"
)

type userContextKey struct{}

// provisionUser is middleware that runs after authentication: it upserts the
// caller into the users table (JIT provisioning from the OIDC token) and stores
// the resulting store.User — with its DB id — in the request context. Keycloak
// remains the source of truth for identity; this is just a local projection.
func (s *Server) provisionUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.FromContext(r.Context())
		if !ok {
			respondError(w, http.StatusUnauthorized, "missing authentication")
			return
		}
		user, err := s.tenancy.UpsertUser(r.Context(), claims.Subject, claims.Email, displayNameFrom(claims), claims.IsAdmin())
		if err != nil {
			respondInternal(w, "provision user", err)
			return
		}
		next.ServeHTTP(w, r.WithContext(withUser(r.Context(), user)))
	})
}

func displayNameFrom(c *auth.Claims) string {
	// The token carries no name claim in our minimal Claims; fall back to the
	// local part of the email, else the subject.
	if c.Email != "" {
		return c.Email
	}
	return c.Subject
}

func withUser(ctx context.Context, u *store.User) context.Context {
	return context.WithValue(ctx, userContextKey{}, u)
}

// userFromContext returns the provisioned caller. The provisionUser middleware
// guarantees it is present on tenancy routes.
func userFromContext(ctx context.Context) (*store.User, bool) {
	u, ok := ctx.Value(userContextKey{}).(*store.User)
	return u, ok
}
