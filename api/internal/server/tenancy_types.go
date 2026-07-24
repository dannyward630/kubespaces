package server

import (
	"fmt"
	"strings"
	"time"

	"github.com/kubespaces-io/kubespaces/api/internal/store"
)

// ---- Organizations ----

type organizationResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Role        string    `json:"role,omitempty"`
	IsDefault   bool      `json:"isDefault"`
	CreatedAt   time.Time `json:"createdAt"`
}

func orgResponse(o *store.Organization, role string, isDefault bool) organizationResponse {
	return organizationResponse{
		ID: o.ID, Name: o.Name, Description: o.Description,
		Role: role, IsDefault: isDefault, CreatedAt: o.CreatedAt,
	}
}

type createOrgRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type updateOrgRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// ---- Members ----

type memberResponse struct {
	UserID      string `json:"userId"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	Role        string `json:"role"`
	IsDefault   bool   `json:"isDefault,omitempty"`
}

func memberResponses(members []store.Member) []memberResponse {
	out := make([]memberResponse, 0, len(members))
	for _, m := range members {
		out = append(out, memberResponse{
			UserID: m.UserID, Email: m.Email, DisplayName: m.DisplayName,
			Role: m.Role, IsDefault: m.IsDefault,
		})
	}
	return out
}

type addMemberRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type updateRoleRequest struct {
	Role string `json:"role"`
}

// ---- Projects ----

type projectResponse struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organizationId"`
	Name           string    `json:"name"`
	Description    string    `json:"description"`
	MaxTenants     int       `json:"maxTenants"`
	MaxCompute     int       `json:"maxCompute"`
	MaxMemoryGB    int       `json:"maxMemoryGb"`
	CreatedAt      time.Time `json:"createdAt"`
}

func projResponse(p *store.Project) projectResponse {
	return projectResponse{
		ID: p.ID, OrganizationID: p.OrganizationID, Name: p.Name, Description: p.Description,
		MaxTenants: p.MaxTenants, MaxCompute: p.MaxCompute, MaxMemoryGB: p.MaxMemoryGB,
		CreatedAt: p.CreatedAt,
	}
}

type createProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	MaxTenants  int    `json:"maxTenants"`
	MaxCompute  int    `json:"maxCompute"`
	MaxMemoryGB int    `json:"maxMemoryGb"`
}

type updateProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type updateQuotasRequest struct {
	MaxTenants  int `json:"maxTenants"`
	MaxCompute  int `json:"maxCompute"`
	MaxMemoryGB int `json:"maxMemoryGb"`
}

// ---- Validation ----

const maxNameLength = 255

func validateDisplayName(kind, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("%s name is required", kind)
	}
	if len(name) > maxNameLength {
		return fmt.Errorf("%s name must be at most %d characters", kind, maxNameLength)
	}
	return nil
}

// ---- Invitations ----

type invitationResponse struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organizationId"`
	ProjectID      string    `json:"projectId,omitempty"`
	Name           string    `json:"name"` // org or project name
	InviterEmail   string    `json:"inviterEmail"`
	InviteeEmail   string    `json:"inviteeEmail"`
	Role           string    `json:"role"`
	Status         string    `json:"status"`
	ExpiresAt      time.Time `json:"expiresAt"`
	CreatedAt      time.Time `json:"createdAt"`
}

func orgInviteResponse(i *store.OrgInvitation) invitationResponse {
	return invitationResponse{
		ID: i.ID, OrganizationID: i.OrganizationID, Name: i.OrgName,
		InviterEmail: i.InviterEmail, InviteeEmail: i.InviteeEmail, Role: i.Role,
		Status: i.Status, ExpiresAt: i.ExpiresAt, CreatedAt: i.CreatedAt,
	}
}

func projInviteResponse(i *store.ProjectInvitation) invitationResponse {
	return invitationResponse{
		ID: i.ID, OrganizationID: i.OrganizationID, ProjectID: i.ProjectID, Name: i.ProjectName,
		InviterEmail: i.InviterEmail, InviteeEmail: i.InviteeEmail, Role: i.Role,
		Status: i.Status, ExpiresAt: i.ExpiresAt, CreatedAt: i.CreatedAt,
	}
}

type createInvitationRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

func validateEmail(email string) error {
	email = strings.TrimSpace(email)
	if email == "" || !strings.Contains(email, "@") || len(email) > maxNameLength {
		return fmt.Errorf("a valid invitee email is required")
	}
	return nil
}

// invitationTTL is how long a new invitation stays acceptable.
const invitationDays = 7

// ---- Admin ----

type userResponse struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"displayName"`
	IsAdmin     bool      `json:"isAdmin"`
	CreatedAt   time.Time `json:"createdAt"`
}

func userResponses(users []store.User) []userResponse {
	out := make([]userResponse, 0, len(users))
	for _, u := range users {
		out = append(out, userResponse{ID: u.ID, Email: u.Email, DisplayName: u.DisplayName, IsAdmin: u.IsAdmin, CreatedAt: u.CreatedAt})
	}
	return out
}

type setAdminRequest struct {
	IsAdmin bool `json:"isAdmin"`
}

var validOrgRoles = map[string]bool{store.RoleOwner: true, store.RoleAdmin: true, store.RoleMember: true}
var validProjectRoles = map[string]bool{store.RoleMaintainer: true, store.RoleMember: true}

func validateOrgRole(role string) (string, error) {
	if role == "" {
		return store.RoleMember, nil
	}
	if !validOrgRoles[role] {
		return "", fmt.Errorf("invalid organization role %q (want owner, admin, or member)", role)
	}
	return role, nil
}

func validateProjectRole(role string) (string, error) {
	if role == "" {
		return store.RoleMember, nil
	}
	if !validProjectRoles[role] {
		return "", fmt.Errorf("invalid project role %q (want maintainer or member)", role)
	}
	return role, nil
}
