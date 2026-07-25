# Changelog

All notable changes to KubeSpaces are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[semver](https://semver.org) (pre-1.0: minor bumps may break — see
[RELEASING.md](RELEASING.md)).

## [Unreleased]

### Added
- **Brand logo** — the KubeSpaces cube mark and wordmark now appear across the
  portal (sidebar, sign-in page, and browser favicon) and at the top of the
  README (English, 简体中文, Italiano). Brand assets live in `assets/`.

## [0.9.2] — 2026-07-25

### Changed
- **Dynamic sidebar navigation**: the portal sidebar is now a collapsible tree.
  Tenants expands to your tenants; Organizations expands to each org and its
  projects. Branches auto-open to the current route (open a tenant → Tenants
  expands with it highlighted) and each has its own expand/collapse toggle, so
  you can jump straight to any tenant, org, or project.
- **Collapsible sidebar**: a collapse button hides the sidebar to give the
  content full width (a floating button brings it back). On narrow viewports
  (< 1024px) the sidebar auto-collapses into an overlay drawer with a backdrop,
  so the portal is usable on small screens.

## [0.9.1] — 2026-07-25

### Fixed
- **OCI chart is now cosign-signed on release.** The chart-publish job
  authenticated with `helm registry login`, which cosign can't read, so signing
  failed with `UNAUTHORIZED` (the chart still published, unsigned). It now uses
  `docker/login-action`, authenticating both `helm push` and `cosign`. (0.9.0's
  chart is published but unsigned; 0.9.1 onward is signed.)

## [0.9.0] — 2026-07-25

### Added
- **Tenancy model**: `organizations → projects → tenants` with members, roles,
  and invitations, ported from the pre-open-source `login-api` and adapted so
  Keycloak owns identity (users are a JIT-provisioned projection). See
  [docs/design/tenancy.md](docs/design/tenancy.md).
  - Schema `0002_tenancy.sql` + `store` repository (orgs, projects,
    memberships, invitations, users).
  - REST API: org/project CRUD, membership + role management, org/project
    invitations (send/accept/decline), and platform-admin user management,
    with role-based access control and JIT user provisioning from the OIDC
    token. Endpoint contract mirrors `login-api` minus the local-auth routes
    Keycloak replaces.
  - Portal UI: Organizations and Projects sections (list/detail), member and
    role management, invitations (send + accept/decline pending), quota
    editing, and a platform-admin Users page — gated by the caller's role.
- `frontend.publicUrl` value — canonical browser-facing base URL for OAuth
  callbacks (sets `AUTH_URL`); left empty, Auth.js infers it from the request.
- **Chart published as an OCI artifact** (#21): release tags push a
  cosign-signed chart to `oci://ghcr.io/kubespaces-io/charts/kubespaces`, so the
  quickstart `helm install kubespaces oci://…` works as documented.
- **`networking.*` chart values + production gateway-stack guide** (#17): a
  shared home for the domain, gateway references, cluster-issuer, and
  external-dns target — wired as backward-compatible defaults behind the
  existing `operator.tenantApi`/`tenantApps` keys — plus
  [docs/guides/gateway-stack.md](docs/guides/gateway-stack.md) covering Envoy
  Gateway, cert-manager (DNS-01 wildcard), and external-dns.

### Changed
- **Operator: TLSRoute migrated to `gateway.networking.k8s.io/v1`** (#23):
  Gateway API 1.5 GA. Raises the floor to Gateway API ≥ 1.5 CRDs (and
  Kubernetes ≥ 1.31 for TLSRoute CEL validation).
- **Portal UI redesign**: a console-style left-sidebar shell (organization
  switcher, grouped nav, user menu), a Dashboard overview with aggregate stat
  cards, tenant stat cards on the Tenants page, and an optional dark theme.

### Fixed
- **Portal login works from `helm install`** — no manual patching. The chart
  now wires the frontend's Auth.js environment: an auto-generated `AUTH_SECRET`
  (persisted across upgrades, overridable via `frontend.authSecret` /
  `frontend.existingSecret`), `AUTH_KEYCLOAK_ISSUER` (the same issuer the API
  validates against), and `AUTH_KEYCLOAK_ID`. Previously the frontend shipped
  with none of these, so next-auth failed to initialize.
- **Frontend proxy target corrected**: `KUBESPACES_API_URL` was `/api`, which
  the server-side Next.js route handler can't fetch. It now points at the
  in-cluster API Service (`http://<release>-api:<port>`).
- **Footer shows the real version**: the frontend footer was hardcoded to
  `v0.1`. It now reads `APP_VERSION`, baked into the image at build time from
  the release tag (goreleaser/metadata-action), and falls back to `dev`.

## [0.8.0] — 2026-07-24

### Added
- **Headless / operator-only installs**: new `api.enabled` and
  `frontend.enabled` chart values (both default `true`). Set them to `false`
  to run the operator on its own — it reconciles `Tenant` CRs into vClusters
  with no portal API, frontend, database, or OIDC dependency. The
  operator-only render is a clean four documents (operator Deployment, CRD,
  ServiceAccount, ClusterRoleBinding), for bring-your-own-control-plane
  deployments.
- **Release-gating E2E test** (#18): every push and PR now builds the
  operator, provisions a real `Tenant` on a kind cluster, verifies the served
  kubeconfig answers, and asserts clean teardown — a hermetic, offline gate
  with no external image or IdP dependencies. Full tenant lifecycle in ~3
  minutes.
- **AI policy** ([AI.md](AI.md)): how the project uses AI and how AI-assisted
  contributions are accepted, modeled on the Linux Foundation Generative AI
  Policy and adapted to KubeSpaces' Apache-2.0 inbound=outbound model.

## [0.3.0] — 2026-07-23

### Added
- **Tenant app exposure** (#16): with `operator.tenantApps.*` configured,
  the operator adds a per-tenant HTTPS listener to the shared apps Gateway
  (`*.{tenant}.apps.{domain}`, per-tenant cert-manager wildcard Certificate,
  `allowedRoutes` locked to the tenant namespace) and enables vCluster's
  native Gateway API HTTPRoute sync — tenants expose apps with a plain
  HTTPRoute inside their virtual cluster. Isolation is structural (routes
  only attach to the tenant's own listener); `status.appsDomain` reports the
  wildcard. Hardening: the API gateway example now uses
  `allowedRoutes: Same`.
- **Tenant API exposure** (#15): when configured with a shared Gateway
  (`operator.tenantApi.*` chart values), the operator creates a per-tenant
  SNI-passthrough `TLSRoute` + `ReferenceGrant`, adds the public hostname to
  the vCluster cert SANs, points the exported kubeconfig at
  `https://<tenant>.api.<domain>:443`, and reports it in
  `status.apiServerUrl`. Routes carry external-dns annotations; a wildcard
  `*.api.<domain>` record works without external-dns.
- **Documentation site** at [docs.kubespaces.io](https://docs.kubespaces.io)
  (#19): MkDocs Material, built from `docs/` and deployed by CI — getting
  started, concepts, guides, and reference.
- **Local reachable tenants on kind**: `examples/host/kind/` and a guide walk
  the full Tier-2 networking path on a laptop with no domain — nip.io wildcard
  DNS plus kind port mappings and pinned Envoy NodePorts give real,
  TLS-verified tenant API endpoints and app URLs.

### Fixed
- **Chart installs the `Tenant` CRD** (#24): `operator.installCRDs` was a
  no-op — the chart shipped no CRD, so a clean `helm install` left the cluster
  unable to create tenants. The CRD is now rendered from the chart (synced from
  the operator source of truth) and carries `helm.sh/resource-policy: keep`, so
  `helm uninstall` never cascade-deletes tenants.

## [0.2.0] — 2026-07-22

### Changed
- **Breaking**: the CLI is renamed from `spacectl` to `kubespaces` — binary,
  Homebrew formula (`kubespaces-io/tap/kubespaces`), release archive names,
  config directory (`~/.config/kubespaces`), and env vars
  (`KUBESPACES_CLI_*`). The old name collided with Spacelift's spacectl
  (#20). No migration: pre-1.0, and the rename landed before any
  compatibility promise.

## [0.1.1] — 2026-07-22

First release built and signed entirely by CI.

### Added
- Windows release artifacts (zip) for spacectl
- SBOMs (syft) and cosign keyless signatures on release artifacts and images
- SECURITY.md, security architecture doc, CodeQL, Dependabot, secret-scanning
  push protection
- CONTRIBUTING.md (including the AI-assisted contribution policy), RELEASING.md
- Public [roadmap](ROADMAP.md) and
  [project board](https://github.com/orgs/kubespaces-io/projects/3)

### Fixed
- **Security**: bumped `golang.org/x/net` in the API and spacectl (DoS
  advisory) and forced the transitive `postcss` above the vulnerable
  version (XSS advisory)
- Frontend lockfile regenerated against the public npm registry — the
  previous lockfile resolved packages from a private feed, breaking
  `npm ci` (and the container build) for everyone outside it; a
  project-local `.npmrc` prevents recurrence

## [0.1.0] — 2026-07-18

First public release. 🎉

### Added
- **API** (Go): OIDC-authenticated tenant CRUD; persists metadata/audit to
  PostgreSQL and drives `Tenant` custom resources; kubeconfig retrieval
- **Operator** (Go, controller-runtime): sole provisioner — reconciles
  `Tenant` CRs (kubespaces.io/v1alpha1, cluster-scoped) into namespace +
  ResourceQuota + LimitRange + vCluster; finalizer teardown; status with
  phases and kubeconfig secret reference
- **Frontend** (Next.js): self-service portal with Keycloak (OIDC/PKCE)
  login, tenant list/create/delete, live provisioning status, kubeconfig
  download; tokens never reach the browser
- **spacectl** (Go): OIDC device-flow login, tenant management,
  `tenant kubeconfig --merge`; Homebrew tap + `curl | sh` installer
- **Umbrella Helm chart**: all-in-one install (API, portal, PostgreSQL 18,
  Keycloak 26.7) with production toggles (external DB, external OIDC,
  ingress or Gateway API HTTPRoute)
- **vCluster supply chain**: chart pinned (0.35.2) and installed from the
  KubeSpaces OCI mirror `ghcr.io/kubespaces-io/charts/vcluster`

[Unreleased]: https://github.com/kubespaces-io/kubespaces/compare/v0.9.2...HEAD
[0.9.2]: https://github.com/kubespaces-io/kubespaces/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/kubespaces-io/kubespaces/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/kubespaces-io/kubespaces/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/kubespaces-io/kubespaces/compare/v0.3.0...v0.8.0
[0.3.0]: https://github.com/kubespaces-io/kubespaces/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/kubespaces-io/kubespaces/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/kubespaces-io/kubespaces/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/kubespaces-io/kubespaces/releases/tag/v0.1.0
