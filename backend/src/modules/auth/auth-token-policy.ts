export const RELAY_JWT_ISSUER = "https://your-backend.up.railway.app/api/v1";
export const RELAY_JWT_ALGORITHM = "HS256" as const;

export const RELAY_JWT_AUDIENCES = Object.freeze({
  webAccess: "relay-web-api",
  mobileAccess: "relay-mobile-api",
  webRefresh: "relay-web-refresh",
  mobileRefresh: "relay-mobile-refresh",
  browserWebsocket: "relay-browser-websocket",
  bridgeAccess: "relay-bridge-api",
  bridgeWebsocket: "relay-bridge-websocket",
});

export type RelayJwtAudience =
  (typeof RELAY_JWT_AUDIENCES)[keyof typeof RELAY_JWT_AUDIENCES];

export function resolveRelayJwtIssuer(rawValue?: string): string {
  const value = rawValue?.trim();
  if (!value) return RELAY_JWT_ISSUER;

  let issuer: URL;
  try {
    issuer = new URL(value);
  } catch {
    throw new Error(
      "JWT_ISSUER must be a valid public HTTPS URL ending in /api/v1.",
    );
  }

  const hostname = issuer.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const canonical = `${issuer.origin}/api/v1`;
  if (
    issuer.protocol !== "https:" ||
    issuer.username ||
    issuer.password ||
    issuer.port ||
    issuer.pathname !== "/api/v1" ||
    issuer.search ||
    issuer.hash ||
    ["localhost", "127.0.0.1", "::1"].includes(hostname) ||
    value !== canonical
  ) {
    throw new Error(
      "JWT_ISSUER must be a canonical public HTTPS origin followed by /api/v1, with no credentials, port, query, or fragment.",
    );
  }

  return value;
}

export function hasExactRelayJwtAudience(
  payload: { aud?: unknown },
  expected: RelayJwtAudience,
): boolean {
  return typeof payload.aud === "string" && payload.aud === expected;
}
