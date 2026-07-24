// Package server wires the HTTP API: routing, handlers, authorization.
package server

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/kubespaces-io/kubespaces/api/internal/k8s"
	"github.com/kubespaces-io/kubespaces/api/internal/store"
)

// TenantStore is the narrow persistence interface the handlers need.
type TenantStore interface {
	CreateTenant(ctx context.Context, t store.TenantRecord) error
	GetTenant(ctx context.Context, name string) (*store.TenantRecord, error)
	ListTenants(ctx context.Context) ([]store.TenantRecord, error)
	ListTenantsByOwner(ctx context.Context, owner string) ([]store.TenantRecord, error)
	SoftDeleteTenant(ctx context.Context, name string) error
	HardDeleteTenant(ctx context.Context, name string) error
	Audit(ctx context.Context, actor, action string, detail map[string]any) error
}

// TenancyStore is the persistence interface for the org/project/membership
// domain. *store.Store satisfies it.
type TenancyStore interface {
	UpsertUser(ctx context.Context, subject, email, displayName string, isAdmin bool) (*store.User, error)
	GetUserBySubject(ctx context.Context, subject string) (*store.User, error)
	GetUserByEmail(ctx context.Context, email string) (*store.User, error)
	SetUserAdmin(ctx context.Context, userID string, admin bool) error
	ListUsers(ctx context.Context) ([]store.User, error)

	CreateOrganization(ctx context.Context, name, description, ownerUserID string) (*store.Organization, error)
	GetOrganization(ctx context.Context, id string) (*store.Organization, error)
	GetOrganizationByName(ctx context.Context, name string) (*store.Organization, error)
	ListOrganizationsForUser(ctx context.Context, userID string) ([]store.OrganizationWithRole, error)
	UpdateOrganization(ctx context.Context, id, name, description string) error
	DeleteOrganization(ctx context.Context, id string) error
	OrgStats(ctx context.Context, orgID string) (projects, members, tenants int, err error)

	AddOrgMember(ctx context.Context, orgID, userID, role string) error
	RemoveOrgMember(ctx context.Context, orgID, userID string) error
	UpdateOrgMemberRole(ctx context.Context, orgID, userID, role string) error
	GetOrgMemberRole(ctx context.Context, orgID, userID string) (string, error)
	ListOrgMembers(ctx context.Context, orgID string) ([]store.Member, error)
	SetDefaultOrg(ctx context.Context, userID, orgID string) error
	GetDefaultOrg(ctx context.Context, userID string) (*store.Organization, error)

	CreateProject(ctx context.Context, p store.Project, creatorUserID string) (*store.Project, error)
	GetProject(ctx context.Context, id string) (*store.Project, error)
	ListProjectsForOrg(ctx context.Context, orgID string) ([]store.Project, error)
	ListProjectsForUser(ctx context.Context, userID string) ([]store.Project, error)
	UpdateProject(ctx context.Context, id, name, description string) error
	UpdateProjectQuotas(ctx context.Context, id string, maxTenants, maxCompute, maxMemoryGB int) error
	DeleteProject(ctx context.Context, id string) error
	ProjectStats(ctx context.Context, projectID string) (members, tenants int, err error)

	AddProjectMember(ctx context.Context, projectID, userID, role string) error
	RemoveProjectMember(ctx context.Context, projectID, userID string) error
	UpdateProjectMemberRole(ctx context.Context, projectID, userID, role string) error
	GetProjectMemberRole(ctx context.Context, projectID, userID string) (string, error)
	ListProjectMembers(ctx context.Context, projectID string) ([]store.Member, error)

	CreateOrgInvitation(ctx context.Context, orgID, inviterUserID, email, role string, expiresAt time.Time) (*store.OrgInvitation, error)
	ListOrgInvitations(ctx context.Context, orgID string) ([]store.OrgInvitation, error)
	ListOrgInvitationsForEmail(ctx context.Context, email string) ([]store.OrgInvitation, error)
	GetOrgInvitation(ctx context.Context, id string) (*store.OrgInvitation, error)
	AcceptOrgInvitation(ctx context.Context, id, userID string) error
	SetOrgInvitationStatus(ctx context.Context, id, status string) error

	CreateProjectInvitation(ctx context.Context, projectID, orgID, inviterUserID, email, role string, expiresAt time.Time) (*store.ProjectInvitation, error)
	ListProjectInvitations(ctx context.Context, projectID string) ([]store.ProjectInvitation, error)
	ListProjectInvitationsForEmail(ctx context.Context, email string) ([]store.ProjectInvitation, error)
	GetProjectInvitation(ctx context.Context, id string) (*store.ProjectInvitation, error)
	AcceptProjectInvitation(ctx context.Context, id, userID string) error
	SetProjectInvitationStatus(ctx context.Context, id, status string) error
}

// TenantCluster is the narrow Kubernetes interface the handlers need.
type TenantCluster interface {
	CreateTenant(ctx context.Context, spec k8s.TenantSpec) error
	GetTenantState(ctx context.Context, name string) (*k8s.TenantState, error)
	ListTenantStates(ctx context.Context) (map[string]k8s.TenantState, error)
	DeleteTenant(ctx context.Context, name string) error
	Kubeconfig(ctx context.Context, name string) ([]byte, error)
}

// Middleware is an http middleware; auth is injected so tests can fake it.
type Middleware func(http.Handler) http.Handler

// Server holds handler dependencies.
type Server struct {
	store   TenantStore
	tenancy TenancyStore
	cluster TenantCluster
	auth    Middleware
}

// New builds a Server.
func New(st TenantStore, tenancy TenancyStore, cluster TenantCluster, auth Middleware) *Server {
	return &Server{store: st, tenancy: tenancy, cluster: cluster, auth: auth}
}

// Router builds the chi router with all routes mounted.
func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", handleHealthz)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(s.auth)
		r.Get("/me", handleMe)
		r.Route("/tenants", func(r chi.Router) {
			r.Get("/", s.handleListTenants)
			r.Post("/", s.handleCreateTenant)
			r.Get("/{name}", s.handleGetTenant)
			r.Delete("/{name}", s.handleDeleteTenant)
			r.Get("/{name}/kubeconfig", s.handleKubeconfig)
		})
		// The tenancy domain needs the DB-projected caller, so it runs behind
		// the JIT user-provisioning middleware.
		r.Group(func(r chi.Router) {
			r.Use(s.provisionUser)
			s.mountOrganizations(r)
			s.mountProjects(r)
			s.mountAdmin(r)
		})
	})
	return r
}

// mountOrganizations mounts the organization + org-membership routes.
func (s *Server) mountOrganizations(r chi.Router) {
	r.Route("/organizations", func(r chi.Router) {
		r.Get("/", s.handleListOrgs)
		r.Post("/", s.handleCreateOrg)
		r.Get("/default", s.handleGetDefaultOrg)
		r.Get("/by-name/{name}", s.handleGetOrgByName)
		// Invitations addressed to the caller (static segment beats /{id}).
		r.Route("/invitations", func(r chi.Router) {
			r.Get("/", s.handleListMyOrgInvitations)
			r.Post("/{id}/accept", s.handleAcceptOrgInvitation)
			r.Post("/{id}/decline", s.handleDeclineOrgInvitation)
		})
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", s.handleGetOrg)
			r.Put("/", s.handleUpdateOrg)
			r.Delete("/", s.handleDeleteOrg)
			r.Put("/default", s.handleSetDefaultOrg)
			r.Get("/stats", s.handleOrgStats)
			r.Get("/users", s.handleListOrgMembers)
			r.Post("/users", s.handleAddOrgMember)
			r.Delete("/users/{user_id}", s.handleRemoveOrgMember)
			r.Patch("/users/{user_id}/role", s.handleUpdateOrgMemberRole)
			r.Get("/projects", s.handleListOrgProjects)
			r.Post("/projects", s.handleCreateProject)
			r.Get("/invitations", s.handleListOrgInvitations)
			r.Post("/invitations", s.handleCreateOrgInvitation)
		})
	})
}

// mountAdmin mounts platform-admin routes.
func (s *Server) mountAdmin(r chi.Router) {
	r.Route("/admin", func(r chi.Router) {
		r.Get("/users", s.handleAdminListUsers)
		r.Post("/users/{id}/admin", s.handleAdminSetUserAdmin)
	})
}

// mountProjects mounts the project + project-membership routes.
func (s *Server) mountProjects(r chi.Router) {
	r.Route("/projects", func(r chi.Router) {
		r.Get("/", s.handleListProjects)
		r.Route("/invitations", func(r chi.Router) {
			r.Get("/", s.handleListMyProjectInvitations)
			r.Post("/{id}/accept", s.handleAcceptProjectInvitation)
			r.Post("/{id}/decline", s.handleDeclineProjectInvitation)
		})
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", s.handleGetProject)
			r.Put("/", s.handleUpdateProject)
			r.Patch("/quotas", s.handleUpdateProjectQuotas)
			r.Delete("/", s.handleDeleteProject)
			r.Get("/stats", s.handleProjectStats)
			r.Get("/users", s.handleListProjectMembers)
			r.Post("/users", s.handleAddProjectMember)
			r.Delete("/users/{user_id}", s.handleRemoveProjectMember)
			r.Patch("/users/{user_id}/role", s.handleUpdateProjectMemberRole)
			r.Get("/invitations", s.handleListProjectInvitations)
			r.Post("/invitations", s.handleCreateProjectInvitation)
		})
	})
}

func handleHealthz(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
