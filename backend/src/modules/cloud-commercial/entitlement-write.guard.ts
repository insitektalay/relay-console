import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { WEB_ACCESS_COOKIE } from "../auth/auth.constants";
import { CloudCommercialService } from "./cloud-commercial.service";
import { ENTITLEMENT_WRITE_BYPASS_KEY } from "./entitlement-bypass.decorator";
import {
  hasExactRelayJwtAudience,
  RELAY_JWT_ALGORITHM,
  RELAY_JWT_AUDIENCES,
  RELAY_JWT_ISSUER,
} from "../auth/auth-token-policy";

type EntitlementRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  baseUrl?: string;
  route?: { path?: string };
};

type EntitlementTokenPayload = {
  sub?: string;
  kind?: string;
  workspaceId?: string;
  aud?: unknown;
};

@Injectable()
export class EntitlementWriteGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cloud: CloudCommercialService,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    if (this.reflector.getAllAndOverride<boolean>(ENTITLEMENT_WRITE_BYPASS_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<EntitlementRequest>();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method || "")) return true;

    const token = this.tokenPayload(request);
    const claimedWorkspaceId = this.explicitWorkspaceId(request)
      || this.workspaceRouteId(request);
    const bridgeWorkspaceId = token?.kind === "bridge_device"
      ? this.text(token.workspaceId)
      : null;
    const threadId = this.text(request.params?.threadId);
    const resourceWorkspaceId = threadId
      ? await this.threadWorkspaceId(threadId)
      : null;

    if (threadId && !resourceWorkspaceId) {
      throw new ForbiddenException({
        code: "ENTITLEMENT_RESOURCE_NOT_FOUND",
        message: "This write targets a thread whose workspace cannot be resolved.",
      });
    }

    const authoritativeWorkspaceId = resourceWorkspaceId || bridgeWorkspaceId;
    if (
      authoritativeWorkspaceId
      && claimedWorkspaceId
      && claimedWorkspaceId !== authoritativeWorkspaceId
    ) {
      throw new ForbiddenException({
        code: "ENTITLEMENT_WORKSPACE_MISMATCH",
        message: "The requested workspace does not match the write target.",
      });
    }
    if (
      resourceWorkspaceId
      && bridgeWorkspaceId
      && bridgeWorkspaceId !== resourceWorkspaceId
    ) {
      throw new ForbiddenException({
        code: "ENTITLEMENT_WORKSPACE_MISMATCH",
        message: "The authenticated bridge workspace does not match the write target.",
      });
    }

    let workspaceId = authoritativeWorkspaceId || claimedWorkspaceId;

    if (!workspaceId && token?.sub && token.kind !== "bridge_device") {
      const memberships = await this.userWorkspaceIds(token.sub);
      if (memberships.length === 1) {
        workspaceId = memberships[0];
      } else if (memberships.length > 1) {
        throw new ForbiddenException({
          code: "ENTITLEMENT_WORKSPACE_REQUIRED",
          message: "This write must identify its workspace before the Relay entitlement can be enforced.",
        });
      }
    }

    // Some unauthenticated recovery and provider callbacks perform bounded
    // writes before a workspace can be derived. Authentication/authorization is
    // still enforced by their own guard or one-time credential. Every normal
    // user or bridge mutation resolves above and therefore fails closed.
    if (!workspaceId) return true;
    const entitlement = await this.cloud.entitlementPayload(workspaceId);
    if (entitlement.mode === "read_only") {
      throw new ForbiddenException({
        code: "ENTITLEMENT_READ_ONLY",
        message: "This managed workspace is read-only. Export and account recovery remain available.",
        status: entitlement.status,
      });
    }
    return true;
  }

  private explicitWorkspaceId(request: EntitlementRequest) {
    return this.text(request.params?.workspaceId)
      || this.text(request.params?.wsId)
      || this.text(request.body?.workspaceId)
      || this.text(request.query?.workspaceId);
  }

  private workspaceRouteId(request: EntitlementRequest) {
    const route = `${request.baseUrl || ""}/${request.route?.path || ""}`.replace(/\/+/g, "/");
    return /(?:^|\/)workspaces\/:id(?:\/|$)/.test(route)
      ? this.text(request.params?.id)
      : null;
  }

  private tokenPayload(request: EntitlementRequest): EntitlementTokenPayload | null {
    const authorization = request.headers?.authorization;
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    const bearer = typeof header === "string" && header.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : null;
    const encoded = bearer || request.cookies?.[WEB_ACCESS_COOKIE];
    if (!encoded) return null;

    try {
      // Verify the signature before using a subject for membership lookup. The
      // endpoint's JWT/bridge guard still enforces the real expiry or bridge
      // grace window, session/device revocation, and workspace authorization.
      const payload = this.jwt.verify<EntitlementTokenPayload>(encoded, {
        ignoreExpiration: true,
        issuer: RELAY_JWT_ISSUER,
        audience: [
          RELAY_JWT_AUDIENCES.webAccess,
          RELAY_JWT_AUDIENCES.mobileAccess,
          RELAY_JWT_AUDIENCES.bridgeAccess,
        ],
        algorithms: [RELAY_JWT_ALGORITHM],
      });
      const expectedAudience =
        payload.kind === "web"
          ? RELAY_JWT_AUDIENCES.webAccess
          : payload.kind === "mobile"
            ? RELAY_JWT_AUDIENCES.mobileAccess
            : payload.kind === "bridge_device"
              ? RELAY_JWT_AUDIENCES.bridgeAccess
              : null;
      return expectedAudience &&
        hasExactRelayJwtAudience(payload, expectedAudience)
        ? payload
        : null;
    } catch {
      return null;
    }
  }

  private async userWorkspaceIds(userId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT "workspaceId"
       FROM workspace_members
       WHERE "userId" = $1
       ORDER BY "workspaceId" ASC`,
      [userId],
    );
    return rows
      .map((row: Record<string, unknown>) => this.text(row.workspaceId))
      .filter((value: string | null): value is string => Boolean(value));
  }

  private async threadWorkspaceId(threadId: string): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT "workspaceId"
       FROM threads
       WHERE id = $1
       LIMIT 1`,
      [threadId],
    );
    return this.text(rows[0]?.workspaceId);
  }

  private text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
}
