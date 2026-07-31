import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "crypto";
import { IncomingMessage } from "http";
import type { RawData } from "ws";
import {
  hasExactRelayJwtAudience,
  RELAY_JWT_ALGORITHM,
  RELAY_JWT_AUDIENCES,
  RELAY_JWT_ISSUER,
} from "../modules/auth/auth-token-policy";
import {
  BRIDGE_TOKEN_ISSUER,
  BRIDGE_WEBSOCKET_AUDIENCE,
  BRIDGE_WEBSOCKET_TOKEN_USE,
  isBridgeTokenId,
} from "../modules/bridge/bridge-token-policy";

export interface BrowserTicketPayload {
  sub: string;
  kind: "ws_ticket";
  sid: string;
  workspaceId: string;
  jti: string;
  aud: typeof RELAY_JWT_AUDIENCES.browserWebsocket;
}

interface MobileRealtimeAuthPayload {
  sub: string;
  kind: "mobile";
  sid: string;
  aud: typeof RELAY_JWT_AUDIENCES.mobileAccess;
}

interface BridgeRealtimeAuthPayload {
  sub: string;
  kind: "bridge_device";
  role: "bridge_device";
  tokenUse: typeof BRIDGE_WEBSOCKET_TOKEN_USE;
  jti: string;
  did: string;
  dpid: string;
  workspaceId: string;
  cv: number;
  aud: typeof RELAY_JWT_AUDIENCES.bridgeWebsocket;
}

export type RealtimeFrameAuth =
  | { family: "mobile"; payload: MobileRealtimeAuthPayload }
  | { family: "bridge"; payload: BridgeRealtimeAuthPayload };

export function getRawWebsocketDataByteLength(data: RawData): number {
  if (typeof data === "string") return Buffer.byteLength(data);
  if (Buffer.isBuffer(data)) return data.byteLength;
  if (Array.isArray(data)) {
    return data.reduce((total, chunk) => total + chunk.byteLength, 0);
  }
  return data.byteLength;
}

export function rawWebsocketDataToString(data: RawData): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data).toString("utf8");
}

export function hashRealtimeTelemetryValue(value: unknown): string {
  return createHash("sha256")
    .update(String(value ?? "unknown"))
    .digest("hex")
    .slice(0, 16);
}

export function getPositiveConfigInt(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const raw = config.get<string | number>(key);
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class RealtimeAuthPolicy {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  verifyFrame(token: string): RealtimeFrameAuth {
    try {
      return {
        family: "bridge",
        payload: this.verifyBridge(token),
      };
    } catch {
      // Continue to the independently constrained mobile family.
    }
    try {
      return {
        family: "mobile",
        payload: this.verifyMobile(token),
      };
    } catch {
      throw new Error("Invalid realtime authentication token");
    }
  }

  async verifyBrowserTicket(token: string): Promise<BrowserTicketPayload> {
    const payload = (await this.jwtService.verifyAsync(token, {
      secret: this.requiredSecret("JWT_WS_SECRET", "JWT_WS_SECRET_MISSING"),
      issuer: RELAY_JWT_ISSUER,
      audience: RELAY_JWT_AUDIENCES.browserWebsocket,
      algorithms: [RELAY_JWT_ALGORITHM],
    })) as Record<string, unknown>;
    if (
      payload.kind !== "ws_ticket" ||
      !hasExactRelayJwtAudience(
        payload,
        RELAY_JWT_AUDIENCES.browserWebsocket,
      ) ||
      !this.isNonEmptyString(payload.sub) ||
      !this.isNonEmptyString(payload.sid) ||
      !this.isNonEmptyString(payload.workspaceId) ||
      !this.isNonEmptyString(payload.jti)
    ) {
      throw new Error("Invalid ticket payload");
    }
    return payload as unknown as BrowserTicketPayload;
  }

  private verifyBridge(token: string): BridgeRealtimeAuthPayload {
    const payload = this.jwtService.verify(token, {
      secret: this.requiredSecret("JWT_WS_SECRET", "JWT_WS_SECRET_MISSING"),
      issuer: BRIDGE_TOKEN_ISSUER,
      audience: BRIDGE_WEBSOCKET_AUDIENCE,
      algorithms: [RELAY_JWT_ALGORITHM],
    }) as Record<string, unknown>;
    if (
      payload.kind !== "bridge_device" ||
      payload.role !== "bridge_device" ||
      payload.tokenUse !== BRIDGE_WEBSOCKET_TOKEN_USE ||
      !hasExactRelayJwtAudience(payload, RELAY_JWT_AUDIENCES.bridgeWebsocket) ||
      !isBridgeTokenId(payload.jti) ||
      !this.isNonEmptyString(payload.sub) ||
      !this.isNonEmptyString(payload.did) ||
      payload.sub !== payload.did ||
      !this.isNonEmptyString(payload.dpid) ||
      !this.isNonEmptyString(payload.workspaceId) ||
      !Number.isSafeInteger(payload.cv) ||
      (payload.cv as number) < 1
    ) {
      throw new Error("Invalid bridge websocket token");
    }
    return payload as unknown as BridgeRealtimeAuthPayload;
  }

  private verifyMobile(token: string): MobileRealtimeAuthPayload {
    const payload = this.jwtService.verify(token, {
      secret: this.requiredSecret("JWT_SECRET", "JWT_SECRET_MISSING"),
      issuer: RELAY_JWT_ISSUER,
      audience: RELAY_JWT_AUDIENCES.mobileAccess,
      algorithms: [RELAY_JWT_ALGORITHM],
    }) as Record<string, unknown>;
    if (
      payload.kind !== "mobile" ||
      !hasExactRelayJwtAudience(payload, RELAY_JWT_AUDIENCES.mobileAccess) ||
      !this.isNonEmptyString(payload.sub) ||
      !this.isNonEmptyString(payload.sid)
    ) {
      throw new Error("Invalid mobile websocket token");
    }
    return payload as unknown as MobileRealtimeAuthPayload;
  }

  private requiredSecret(name: string, missingError: string) {
    const secret = this.config.get<string>(name)?.trim();
    if (!secret) throw new Error(missingError);
    return secret;
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }
}

export function requestContainsCredentialQuery(request: IncomingMessage) {
  if (!request.url) return false;
  const parsed = new URL(request.url, "https://clawchat.invalid");
  return parsed.searchParams.has("ticket") || parsed.searchParams.has("token");
}

export function readRealtimeOriginHeader(
  origin: string | string[] | undefined,
) {
  if (typeof origin !== "string") return null;
  const trimmed = origin.trim();
  return trimmed || null;
}

export function getRealtimeOriginRejectionReason(
  input: {
    origin: string | null;
    hasTicket: boolean;
    userAgent: string | null;
  },
  config: ConfigService,
) {
  if (input.origin) {
    return allowedOrigins(config).has(input.origin)
      ? null
      : "Origin not allowed";
  }
  if (
    input.hasTicket ||
    (input.userAgent &&
      /\b(Mozilla|Firefox|Chrome|Chromium|Safari|Edg|OPR)\b/i.test(
        input.userAgent,
      ))
  ) {
    return "Origin required";
  }
  return null;
}

function allowedOrigins(config: ConfigService) {
  const origins = new Set(
    (config.get<string>("CORS_ORIGINS") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (config.get<string>("NODE_ENV") !== "production") {
    origins.add("http://localhost:3033");
    origins.add("http://127.0.0.1:3033");
  }
  return origins;
}
