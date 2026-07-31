import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { WEB_ACCESS_COOKIE } from "../auth/auth.constants";
import { AuthController } from "../auth/auth.controller";
import { BridgeController } from "../bridge/bridge.controller";
import { CloudCommercialService } from "./cloud-commercial.service";
import { RelayOperatorController } from "./cloud-commercial.controller";
import { ENTITLEMENT_WRITE_BYPASS_KEY } from "./entitlement-bypass.decorator";
import { EntitlementWriteGuard } from "./entitlement-write.guard";
import { WorkspaceBillingController } from "./stripe-billing.controller";
import { RELAY_JWT_AUDIENCES } from "../auth/auth-token-policy";

type RequestShape = {
  method: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  baseUrl?: string;
  route?: { path?: string };
};

function context(request: RequestShape): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("EntitlementWriteGuard", () => {
  let isPublic = false;
  let bypass = false;
  let membershipRows: Array<{ workspaceId: string }> = [];
  let threadRows: Array<{ workspaceId: string }> = [];
  let tokenPayloads: Record<string, Record<string, unknown>> = {};
  let entitlementMode: "read_only" | "read_write" = "read_only";
  let reflector: Pick<Reflector, "getAllAndOverride">;
  let cloud: Pick<CloudCommercialService, "entitlementPayload">;
  let dataSource: Pick<DataSource, "query">;
  let jwt: Pick<JwtService, "verify">;
  let guard: EntitlementWriteGuard;

  beforeEach(() => {
    isPublic = false;
    bypass = false;
    membershipRows = [];
    threadRows = [];
    tokenPayloads = {};
    entitlementMode = "read_only";
    reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === IS_PUBLIC_KEY) return isPublic;
        if (key === ENTITLEMENT_WRITE_BYPASS_KEY) return bypass;
        return false;
      }),
    };
    cloud = {
      entitlementPayload: jest.fn(async (workspaceId: string) => ({
        workspaceId,
        status: entitlementMode === "read_write" ? "active" : "subscription_required",
        mode: entitlementMode,
      })) as any,
    };
    dataSource = {
      query: jest.fn(async (sql: string) => (
        sql.includes("FROM threads") ? threadRows : membershipRows
      )) as any,
    };
    jwt = {
      verify: jest.fn((token: string) => {
        const payload = tokenPayloads[token];
        if (!payload) throw new Error("invalid signature");
        return payload;
      }) as any,
    };
    guard = new EntitlementWriteGuard(
      reflector as Reflector,
      cloud as CloudCommercialService,
      dataSource as DataSource,
      jwt as JwtService,
    );
  });

  it("allows public, explicitly bypassed, and read-only HTTP methods without entitlement lookup", async () => {
    isPublic = true;
    await expect(guard.canActivate(context({ method: "POST", body: { workspaceId: "workspace-1" } }))).resolves.toBe(true);
    isPublic = false;
    bypass = true;
    await expect(guard.canActivate(context({ method: "DELETE", body: { workspaceId: "workspace-1" } }))).resolves.toBe(true);
    bypass = false;
    await expect(guard.canActivate(context({ method: "GET", params: { workspaceId: "workspace-1" } }))).resolves.toBe(true);
    expect(cloud.entitlementPayload).not.toHaveBeenCalled();
  });

  it("blocks explicit workspace writes in read-only mode and allows active subscriptions", async () => {
    await expect(guard.canActivate(context({
      method: "POST",
      body: { workspaceId: "workspace-1" },
    }))).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ENTITLEMENT_READ_ONLY" }),
    });
    expect(cloud.entitlementPayload).toHaveBeenCalledWith("workspace-1");

    entitlementMode = "read_write";
    await expect(guard.canActivate(context({
      method: "PATCH",
      params: { workspaceId: "workspace-1" },
    }))).resolves.toBe(true);
  });

  it("recognizes a workspace id carried by a workspace route named :id", async () => {
    await expect(guard.canActivate(context({
      method: "PATCH",
      baseUrl: "/api/v1/workspaces",
      route: { path: "/:id" },
      params: { id: "workspace-route-1" },
    }))).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ENTITLEMENT_READ_ONLY" }),
    });
    expect(cloud.entitlementPayload).toHaveBeenCalledWith("workspace-route-1");
  });

  it("enforces the signed bridge token workspace before runtime HTTP mutations", async () => {
    tokenPayloads["bridge-token"] = {
      sub: "device-1",
      kind: "bridge_device",
      workspaceId: "bridge-workspace-1",
      aud: RELAY_JWT_AUDIENCES.bridgeAccess,
    };
    await expect(guard.canActivate(context({
      method: "POST",
      headers: { authorization: "Bearer bridge-token" },
      body: { threadId: "thread-1" },
    }))).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ENTITLEMENT_READ_ONLY" }),
    });
    expect(cloud.entitlementPayload).toHaveBeenCalledWith("bridge-workspace-1");
  });

  it("resolves resource-addressed bearer and browser writes through a single user workspace", async () => {
    membershipRows = [{ workspaceId: "personal-workspace-1" }];
    tokenPayloads["mobile-token"] = {
      sub: "user-1",
      kind: "mobile",
      aud: RELAY_JWT_AUDIENCES.mobileAccess,
    };
    tokenPayloads["browser-token"] = {
      sub: "user-1",
      kind: "web",
      aud: RELAY_JWT_AUDIENCES.webAccess,
    };

    await expect(guard.canActivate(context({
      method: "POST",
      headers: { authorization: "Bearer mobile-token" },
      params: { id: "resource-1" },
      body: { content: "Hello" },
    }))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(context({
      method: "DELETE",
      cookies: { [WEB_ACCESS_COOKIE]: "browser-token" },
      params: { id: "agent-1" },
    }))).rejects.toBeInstanceOf(ForbiddenException);

    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining("FROM workspace_members"), ["user-1"]);
    expect(cloud.entitlementPayload).toHaveBeenNthCalledWith(1, "personal-workspace-1");
    expect(cloud.entitlementPayload).toHaveBeenNthCalledWith(2, "personal-workspace-1");
  });

  it("fails closed when a multi-workspace user omits the mutation workspace", async () => {
    membershipRows = [
      { workspaceId: "workspace-1" },
      { workspaceId: "workspace-2" },
    ];
    tokenPayloads["user-token"] = {
      sub: "user-1",
      kind: "web",
      aud: RELAY_JWT_AUDIENCES.webAccess,
    };

    await expect(guard.canActivate(context({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      params: { id: "resource-1" },
    }))).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ENTITLEMENT_WORKSPACE_REQUIRED" }),
    });
    expect(cloud.entitlementPayload).not.toHaveBeenCalled();
  });

  it("resolves a multi-workspace thread write from the authoritative thread record", async () => {
    membershipRows = [
      { workspaceId: "workspace-1" },
      { workspaceId: "workspace-2" },
    ];
    threadRows = [{ workspaceId: "workspace-2" }];
    tokenPayloads["user-token"] = {
      sub: "user-1",
      kind: "web",
      aud: RELAY_JWT_AUDIENCES.webAccess,
    };
    entitlementMode = "read_write";

    await expect(guard.canActivate(context({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      params: { threadId: "thread-1" },
      body: { content: "Hello" },
    }))).resolves.toBe(true);

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM threads"),
      ["thread-1"],
    );
    expect(dataSource.query).not.toHaveBeenCalledWith(
      expect.stringContaining("FROM workspace_members"),
      expect.anything(),
    );
    expect(cloud.entitlementPayload).toHaveBeenCalledWith("workspace-2");
  });

  it("enforces read-only mode for an authoritatively resolved thread workspace", async () => {
    threadRows = [{ workspaceId: "workspace-2" }];
    tokenPayloads["user-token"] = {
      sub: "user-1",
      kind: "web",
      aud: RELAY_JWT_AUDIENCES.webAccess,
    };

    await expect(guard.canActivate(context({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      params: { threadId: "thread-1" },
      body: { content: "Hello" },
    }))).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ENTITLEMENT_READ_ONLY" }),
    });
    expect(cloud.entitlementPayload).toHaveBeenCalledWith("workspace-2");
  });

  it("rejects a client workspace claim that conflicts with the thread record", async () => {
    threadRows = [{ workspaceId: "workspace-2" }];

    await expect(guard.canActivate(context({
      method: "POST",
      params: { threadId: "thread-1" },
      body: { workspaceId: "workspace-1", content: "Hello" },
    }))).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ENTITLEMENT_WORKSPACE_MISMATCH" }),
    });
    expect(cloud.entitlementPayload).not.toHaveBeenCalled();
  });

  it("fails closed when a thread-scoped write targets an unknown thread", async () => {
    tokenPayloads["user-token"] = {
      sub: "user-1",
      kind: "web",
      aud: RELAY_JWT_AUDIENCES.webAccess,
    };

    await expect(guard.canActivate(context({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      params: { threadId: "unknown-thread" },
      body: { content: "Hello" },
    }))).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ENTITLEMENT_RESOURCE_NOT_FOUND" }),
    });
    expect(cloud.entitlementPayload).not.toHaveBeenCalled();
  });

  it("allows first-workspace and bounded unauthenticated setup writes when no workspace can exist yet", async () => {
    tokenPayloads["new-user-token"] = {
      sub: "new-user",
      kind: "web",
      aud: RELAY_JWT_AUDIENCES.webAccess,
    };
    await expect(guard.canActivate(context({
      method: "POST",
      headers: { authorization: "Bearer new-user-token" },
      baseUrl: "/api/v1/workspaces",
      body: { name: "First workspace" },
    }))).resolves.toBe(true);
    await expect(guard.canActivate(context({
      method: "POST",
      body: { code: "one-time-enrollment-code" },
    }))).resolves.toBe(true);
    expect(cloud.entitlementPayload).not.toHaveBeenCalled();
  });

  it("does not trust an unsigned token subject for entitlement membership lookup", async () => {
    await expect(guard.canActivate(context({
      method: "POST",
      headers: { authorization: "Bearer forged-token" },
      body: { code: "bounded-credential" },
    }))).resolves.toBe(true);
    expect(dataSource.query).not.toHaveBeenCalled();
    expect(cloud.entitlementPayload).not.toHaveBeenCalled();
  });

  it("limits read-only bypass metadata to account, billing, operator, and bridge-revocation recovery", () => {
    const metadata = new Reflector();
    expect(metadata.get(ENTITLEMENT_WRITE_BYPASS_KEY, AuthController)).toBe(true);
    expect(metadata.get(ENTITLEMENT_WRITE_BYPASS_KEY, WorkspaceBillingController)).toBe(true);
    expect(metadata.get(ENTITLEMENT_WRITE_BYPASS_KEY, RelayOperatorController)).toBe(true);
    expect(metadata.get(ENTITLEMENT_WRITE_BYPASS_KEY, BridgeController)).not.toBe(true);
    expect(metadata.get(
      ENTITLEMENT_WRITE_BYPASS_KEY,
      Object.getOwnPropertyDescriptor(BridgeController.prototype, "revokeDevice")!.value,
    )).toBe(true);
    expect(metadata.get(
      ENTITLEMENT_WRITE_BYPASS_KEY,
      Object.getOwnPropertyDescriptor(BridgeController.prototype, "revokeAllDevices")!.value,
    )).toBe(true);
  });
});
