package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// Invitation statuses.
const (
	InvitePending  = "pending"
	InviteAccepted = "accepted"
	InviteDeclined = "declined"
	InviteExpired  = "expired"
)

// ErrInviteNotAcceptable is returned when an invitation can't be accepted
// (wrong status or expired).
var ErrInviteNotAcceptable = errors.New("invitation is no longer acceptable")

// OrgInvitation is an invitation to join an organization. OrgName is joined in
// for display on the invitee's side.
type OrgInvitation struct {
	ID             string
	OrganizationID string
	OrgName        string
	InviterUserID  string
	InviterEmail   string
	InviteeEmail   string
	Role           string
	Status         string
	ExpiresAt      time.Time
	CreatedAt      time.Time
}

// ProjectInvitation is an invitation to join a project.
type ProjectInvitation struct {
	ID             string
	ProjectID      string
	ProjectName    string
	OrganizationID string
	InviterUserID  string
	InviterEmail   string
	InviteeEmail   string
	Role           string
	Status         string
	ExpiresAt      time.Time
	CreatedAt      time.Time
}

const orgInviteCols = `oi.id::text, oi.organization_id::text, o.name, oi.inviter_user_id::text,
	COALESCE(u.email, ''), oi.invitee_email, oi.role, oi.status, oi.expires_at, oi.created_at`

func scanOrgInvite(row scanner) (*OrgInvitation, error) {
	var i OrgInvitation
	err := row.Scan(&i.ID, &i.OrganizationID, &i.OrgName, &i.InviterUserID, &i.InviterEmail,
		&i.InviteeEmail, &i.Role, &i.Status, &i.ExpiresAt, &i.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("scan org invitation: %w", err)
	}
	return &i, nil
}

// CreateOrgInvitation creates a pending org invitation.
func (s *Store) CreateOrgInvitation(ctx context.Context, orgID, inviterUserID, email, role string, expiresAt time.Time) (*OrgInvitation, error) {
	const q = `
		WITH ins AS (
			INSERT INTO organization_invitations (organization_id, inviter_user_id, invitee_email, role, expires_at)
			VALUES ($1, $2, $3, $4, $5) RETURNING *
		)
		SELECT ` + orgInviteCols + `
		FROM ins oi
		JOIN organizations o ON o.id = oi.organization_id
		LEFT JOIN users u ON u.id = oi.inviter_user_id`
	return scanOrgInvite(s.pool.QueryRow(ctx, q, orgID, inviterUserID, email, role, expiresAt))
}

// ListOrgInvitations lists an org's outbound invitations.
func (s *Store) ListOrgInvitations(ctx context.Context, orgID string) ([]OrgInvitation, error) {
	const q = `SELECT ` + orgInviteCols + `
		FROM organization_invitations oi
		JOIN organizations o ON o.id = oi.organization_id
		LEFT JOIN users u ON u.id = oi.inviter_user_id
		WHERE oi.organization_id = $1 ORDER BY oi.created_at DESC`
	return queryOrgInvites(ctx, s, q, orgID)
}

// ListOrgInvitationsForEmail lists pending invitations addressed to an email.
func (s *Store) ListOrgInvitationsForEmail(ctx context.Context, email string) ([]OrgInvitation, error) {
	const q = `SELECT ` + orgInviteCols + `
		FROM organization_invitations oi
		JOIN organizations o ON o.id = oi.organization_id
		LEFT JOIN users u ON u.id = oi.inviter_user_id
		WHERE oi.invitee_email = $1 AND oi.status = 'pending' ORDER BY oi.created_at DESC`
	return queryOrgInvites(ctx, s, q, email)
}

// GetOrgInvitation fetches an invitation by id.
func (s *Store) GetOrgInvitation(ctx context.Context, id string) (*OrgInvitation, error) {
	const q = `SELECT ` + orgInviteCols + `
		FROM organization_invitations oi
		JOIN organizations o ON o.id = oi.organization_id
		LEFT JOIN users u ON u.id = oi.inviter_user_id
		WHERE oi.id = $1`
	return scanOrgInvite(s.pool.QueryRow(ctx, q, id))
}

// AcceptOrgInvitation atomically marks an invitation accepted and adds the user
// as a member with the invited role. Returns ErrInviteNotAcceptable if the
// invitation is not pending or has expired.
func (s *Store) AcceptOrgInvitation(ctx context.Context, id, userID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx)

	var orgID, role, status string
	var expiresAt time.Time
	err = tx.QueryRow(ctx,
		`SELECT organization_id::text, role, status, expires_at FROM organization_invitations WHERE id = $1 FOR UPDATE`, id).
		Scan(&orgID, &role, &status, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("lock invitation: %w", err)
	}
	if status != InvitePending || time.Now().After(expiresAt) {
		return ErrInviteNotAcceptable
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO user_organizations (user_id, organization_id, role)
		 VALUES ($1, $2, $3) ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role`,
		userID, orgID, role); err != nil {
		return fmt.Errorf("add member: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE organization_invitations SET status = 'accepted', updated_at = now() WHERE id = $1`, id); err != nil {
		return fmt.Errorf("mark accepted: %w", err)
	}
	return tx.Commit(ctx)
}

// SetOrgInvitationStatus updates an invitation's status (e.g. declined).
func (s *Store) SetOrgInvitationStatus(ctx context.Context, id, status string) error {
	ct, err := s.pool.Exec(ctx,
		`UPDATE organization_invitations SET status = $2, updated_at = now() WHERE id = $1`, id, status)
	if err != nil {
		return fmt.Errorf("set invitation status: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func queryOrgInvites(ctx context.Context, s *Store, q string, args ...any) ([]OrgInvitation, error) {
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list org invitations: %w", err)
	}
	defer rows.Close()
	var out []OrgInvitation
	for rows.Next() {
		i, err := scanOrgInvite(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *i)
	}
	return out, rows.Err()
}

// ---- Project invitations ----

const projInviteCols = `pi.id::text, pi.project_id::text, p.name, pi.organization_id::text,
	pi.inviter_user_id::text, COALESCE(u.email, ''), pi.invitee_email, pi.role, pi.status, pi.expires_at, pi.created_at`

func scanProjInvite(row scanner) (*ProjectInvitation, error) {
	var i ProjectInvitation
	err := row.Scan(&i.ID, &i.ProjectID, &i.ProjectName, &i.OrganizationID, &i.InviterUserID,
		&i.InviterEmail, &i.InviteeEmail, &i.Role, &i.Status, &i.ExpiresAt, &i.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("scan project invitation: %w", err)
	}
	return &i, nil
}

// CreateProjectInvitation creates a pending project invitation.
func (s *Store) CreateProjectInvitation(ctx context.Context, projectID, orgID, inviterUserID, email, role string, expiresAt time.Time) (*ProjectInvitation, error) {
	const q = `
		WITH ins AS (
			INSERT INTO project_invitations (project_id, organization_id, inviter_user_id, invitee_email, role, expires_at)
			VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
		)
		SELECT ` + projInviteCols + `
		FROM ins pi
		JOIN projects p ON p.id = pi.project_id
		LEFT JOIN users u ON u.id = pi.inviter_user_id`
	return scanProjInvite(s.pool.QueryRow(ctx, q, projectID, orgID, inviterUserID, email, role, expiresAt))
}

// ListProjectInvitations lists a project's outbound invitations.
func (s *Store) ListProjectInvitations(ctx context.Context, projectID string) ([]ProjectInvitation, error) {
	const q = `SELECT ` + projInviteCols + `
		FROM project_invitations pi
		JOIN projects p ON p.id = pi.project_id
		LEFT JOIN users u ON u.id = pi.inviter_user_id
		WHERE pi.project_id = $1 ORDER BY pi.created_at DESC`
	return queryProjInvites(ctx, s, q, projectID)
}

// ListProjectInvitationsForEmail lists pending project invitations for an email.
func (s *Store) ListProjectInvitationsForEmail(ctx context.Context, email string) ([]ProjectInvitation, error) {
	const q = `SELECT ` + projInviteCols + `
		FROM project_invitations pi
		JOIN projects p ON p.id = pi.project_id
		LEFT JOIN users u ON u.id = pi.inviter_user_id
		WHERE pi.invitee_email = $1 AND pi.status = 'pending' ORDER BY pi.created_at DESC`
	return queryProjInvites(ctx, s, q, email)
}

// GetProjectInvitation fetches a project invitation by id.
func (s *Store) GetProjectInvitation(ctx context.Context, id string) (*ProjectInvitation, error) {
	const q = `SELECT ` + projInviteCols + `
		FROM project_invitations pi
		JOIN projects p ON p.id = pi.project_id
		LEFT JOIN users u ON u.id = pi.inviter_user_id
		WHERE pi.id = $1`
	return scanProjInvite(s.pool.QueryRow(ctx, q, id))
}

// AcceptProjectInvitation atomically accepts a project invitation.
func (s *Store) AcceptProjectInvitation(ctx context.Context, id, userID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx)

	var projectID, role, status string
	var expiresAt time.Time
	err = tx.QueryRow(ctx,
		`SELECT project_id::text, role, status, expires_at FROM project_invitations WHERE id = $1 FOR UPDATE`, id).
		Scan(&projectID, &role, &status, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("lock invitation: %w", err)
	}
	if status != InvitePending || time.Now().After(expiresAt) {
		return ErrInviteNotAcceptable
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO project_users (project_id, user_id, role)
		 VALUES ($1, $2, $3) ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
		projectID, userID, role); err != nil {
		return fmt.Errorf("add member: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE project_invitations SET status = 'accepted', updated_at = now() WHERE id = $1`, id); err != nil {
		return fmt.Errorf("mark accepted: %w", err)
	}
	return tx.Commit(ctx)
}

// SetProjectInvitationStatus updates a project invitation's status.
func (s *Store) SetProjectInvitationStatus(ctx context.Context, id, status string) error {
	ct, err := s.pool.Exec(ctx,
		`UPDATE project_invitations SET status = $2, updated_at = now() WHERE id = $1`, id, status)
	if err != nil {
		return fmt.Errorf("set invitation status: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func queryProjInvites(ctx context.Context, s *Store, q string, args ...any) ([]ProjectInvitation, error) {
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list project invitations: %w", err)
	}
	defer rows.Close()
	var out []ProjectInvitation
	for rows.Next() {
		i, err := scanProjInvite(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *i)
	}
	return out, rows.Err()
}
