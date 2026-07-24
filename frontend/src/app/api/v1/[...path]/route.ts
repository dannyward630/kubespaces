import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { refreshAccessToken } from "@/lib/keycloak";

/**
 * Server-side proxy to the KubeSpaces backend API.
 * Attaches the Keycloak access token from the encrypted Auth.js JWT cookie;
 * the token itself is never exposed to the browser.
 */

const API_BASE = (
  process.env.KUBESPACES_API_URL ?? "http://localhost:8080"
).replace(/\/$/, "");

const DNS1123 = "[a-z0-9]([-a-z0-9]*[a-z0-9])?";
// Each dynamic segment is [^/]+ (no slash → no path injection). The set below
// is the exact tenancy/tenant/admin surface the portal calls.
const S = "[^/]+";
const ALLOWED_PATHS: RegExp[] = [
  /^me$/,
  /^tenants$/,
  new RegExp(`^tenants/${DNS1123}$`),
  new RegExp(`^tenants/${DNS1123}/kubeconfig$`),
  // Organizations
  /^organizations$/,
  /^organizations\/default$/,
  new RegExp(`^organizations/by-name/${S}$`),
  /^organizations\/invitations$/,
  new RegExp(`^organizations/invitations/${S}/(accept|decline)$`),
  new RegExp(`^organizations/${S}$`),
  new RegExp(`^organizations/${S}/(default|stats|users|projects|invitations)$`),
  new RegExp(`^organizations/${S}/users/${S}$`),
  new RegExp(`^organizations/${S}/users/${S}/role$`),
  // Projects
  /^projects$/,
  /^projects\/invitations$/,
  new RegExp(`^projects/invitations/${S}/(accept|decline)$`),
  new RegExp(`^projects/${S}$`),
  new RegExp(`^projects/${S}/(quotas|stats|users|invitations)$`),
  new RegExp(`^projects/${S}/users/${S}$`),
  new RegExp(`^projects/${S}/users/${S}/role$`),
  // Admin
  /^admin\/users$/,
  new RegExp(`^admin/users/${S}/admin$`),
];

const pathAllowed = (joined: string) => ALLOWED_PATHS.some((re) => re.test(joined));

async function resolveAccessToken(
  request: NextRequest,
): Promise<string | null> {
  const secureCookie = (process.env.AUTH_URL ?? "").startsWith("https://");
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });
  if (!token?.accessToken) return null;

  const expiresAtMs = (token.expiresAt ?? 0) * 1000;
  if (Date.now() < expiresAtMs - 30_000) return token.accessToken;

  // Access token expired (route handlers can't rewrite the session cookie;
  // the middleware/session path persists refreshes on the next page load).
  if (!token.refreshToken) return null;
  const refreshed = await refreshAccessToken(token.refreshToken);
  return refreshed?.accessToken ?? null;
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { path } = await context.params;
  const joined = path.join("/");
  if (!pathAllowed(joined)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const accessToken = await resolveAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
  const init: RequestInit = { method: request.method, headers, cache: "no-store" };
  if (request.method === "POST") {
    headers.set("Content-Type", "application/json");
    init.body = await request.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/api/v1/${joined}`, init);
  } catch {
    return NextResponse.json(
      { error: "KubeSpaces API is unreachable" },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers({
    "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    "Cache-Control": "no-store",
  });
  if (joined.endsWith("/kubeconfig") && upstream.ok) {
    const tenant = path[1];
    responseHeaders.set(
      "Content-Disposition",
      `attachment; filename="${tenant}-kubeconfig.yaml"`,
    );
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export { proxy as GET, proxy as POST, proxy as DELETE };
