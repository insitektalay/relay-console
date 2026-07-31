import {
  RELAY_JWT_AUDIENCES,
  RELAY_JWT_ISSUER,
} from "../auth/auth-token-policy";

export const BRIDGE_TOKEN_ISSUER = RELAY_JWT_ISSUER;
export const BRIDGE_ACCESS_AUDIENCE = RELAY_JWT_AUDIENCES.bridgeAccess;
export const BRIDGE_WEBSOCKET_AUDIENCE =
  RELAY_JWT_AUDIENCES.bridgeWebsocket;
export const BRIDGE_ACCESS_TOKEN_USE = "bridge_access";
export const BRIDGE_WEBSOCKET_TOKEN_USE = "bridge_websocket";
export const BRIDGE_ROTATING_CREDENTIAL_CAPABILITY =
  "clawchat.bridge.rotating_credentials.v1";

export const DEFAULT_BRIDGE_ACCESS_EXPIRES_IN = "15m";
export const DEFAULT_BRIDGE_WS_EXPIRES_IN = "5m";
export const DEFAULT_BRIDGE_EXPIRED_TOKEN_GRACE_IN = "2m";

export type BridgeTokenPolicy = {
  accessExpiresInSeconds: number;
  websocketExpiresInSeconds: number;
  expiredAccessGraceSeconds: number;
};

const DURATION_PATTERN = /^(\d+)(s|m|h)$/;
const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
};

function parseBoundedDuration(
  name: string,
  rawValue: string,
  minimumSeconds: number,
  maximumSeconds: number,
) {
  const value = rawValue.trim().toLowerCase();
  const match = DURATION_PATTERN.exec(value);
  if (!match) {
    throw new Error(
      `${name} must be an integer duration with an explicit s, m, or h suffix.`,
    );
  }
  const seconds = Number(match[1]) * UNIT_SECONDS[match[2]];
  if (
    !Number.isSafeInteger(seconds) ||
    seconds < minimumSeconds ||
    seconds > maximumSeconds
  ) {
    throw new Error(
      `${name} must be between ${minimumSeconds} and ${maximumSeconds} seconds.`,
    );
  }
  return seconds;
}

export function resolveBridgeTokenPolicy(
  get: (name: string) => string | undefined,
): BridgeTokenPolicy {
  return Object.freeze({
    accessExpiresInSeconds: parseBoundedDuration(
      "BRIDGE_ACCESS_EXPIRES_IN",
      get("BRIDGE_ACCESS_EXPIRES_IN") ?? DEFAULT_BRIDGE_ACCESS_EXPIRES_IN,
      15 * 60,
      60 * 60,
    ),
    websocketExpiresInSeconds: parseBoundedDuration(
      "BRIDGE_WS_EXPIRES_IN",
      get("BRIDGE_WS_EXPIRES_IN") ?? DEFAULT_BRIDGE_WS_EXPIRES_IN,
      60,
      15 * 60,
    ),
    expiredAccessGraceSeconds: parseBoundedDuration(
      "BRIDGE_ACCESS_EXPIRED_GRACE_IN",
      get("BRIDGE_ACCESS_EXPIRED_GRACE_IN") ??
        DEFAULT_BRIDGE_EXPIRED_TOKEN_GRACE_IN,
      0,
      5 * 60,
    ),
  });
}

export function assertBridgeTokenEnvironment(
  env: NodeJS.ProcessEnv,
): BridgeTokenPolicy {
  return resolveBridgeTokenPolicy((name) => env[name]);
}

export function isBridgeTokenId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
