import { BridgeService } from "../../../bridge/bridge.service";
import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  ANYTYPE_MANAGE_OPERATIONS,
  ANYTYPE_READ_OPERATIONS,
  AnytypeApiError,
  AnytypeLocalApiAdapter,
} from "./anytype-local-api.adapter";
import { ANYTYPE_CONNECTOR_MANIFEST } from "./anytype.connector";

const credentials = {
  apiKey: "dedicated-key",
  sourceHostId: "host-1",
  sourceHostType: "hermes_bridge" as const,
  runtime: "desktop" as const,
};

describe("Anytype connector", () => {
  it("registers encrypted device-bound authority and the complete bounded JSON surface", () => {
    expect(new MarketplaceConnectorRegistry().get("anytype")).toBe(
      ANYTYPE_CONNECTOR_MANIFEST,
    );
    expect(ANYTYPE_CONNECTOR_MANIFEST.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ANYTYPE_API_KEY",
          secret: true,
          storedIn: "encrypted_secret",
        }),
        expect.objectContaining({
          name: "ANYTYPE_SOURCE_HOST_ID",
          storedIn: "metadata",
        }),
      ]),
    );
    expect(ANYTYPE_READ_OPERATIONS).toHaveLength(22);
    expect(ANYTYPE_MANAGE_OPERATIONS).toHaveLength(24);
  });

  it("pins the versioned provider-local target and keeps the bearer credential bridge-only", async () => {
    const bridge = {
      callMarketplaceLocalApi: jest
        .fn()
        .mockResolvedValue({
          status: "ok",
          httpStatus: 200,
          data: { data: [{ id: "space-1" }] },
        }),
    } as unknown as BridgeService;
    const result = await new AnytypeLocalApiAdapter(bridge).health(
      "workspace-1",
      credentials,
    );
    expect(result).toMatchObject({ spaceCount: 1, providerRequestCount: 1 });
    expect(bridge.callMarketplaceLocalApi).toHaveBeenCalledWith(
      expect.objectContaining({
        appSlug: "anytype",
        sourceHostId: "host-1",
        runtime: "desktop",
        apiVersion: "2025-11-08",
        method: "GET",
        path: "/v1/spaces",
        bearerToken: "dedicated-key",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("dedicated-key");
  });

  it("maps exact read and mutation routes without agent-selected paths", async () => {
    const bridge = {
      callMarketplaceLocalApi: jest
        .fn()
        .mockResolvedValue({
          status: "ok",
          httpStatus: 200,
          data: { object: { id: "object-1" } },
        }),
    } as unknown as BridgeService;
    const adapter = new AnytypeLocalApiAdapter(bridge);
    await adapter.callRead("workspace-1", credentials, {
      operation: "get_object",
      pathParams: { spaceId: "space-1", objectId: "object-1" },
    });
    await adapter.callManage("workspace-1", credentials, {
      operation: "update_object",
      pathParams: { spaceId: "space-1", objectId: "object-1" },
      body: { name: "Updated" },
    });
    expect(
      (bridge.callMarketplaceLocalApi as jest.Mock).mock.calls.map((call) => ({
        method: call[0].method,
        path: call[0].path,
      })),
    ).toEqual([
      { method: "GET", path: "/v1/spaces/space-1/objects/object-1" },
      { method: "PATCH", path: "/v1/spaces/space-1/objects/object-1" },
    ]);
  });

  it("rejects cross-policy operations, invalid identifiers, and credential-bearing input", async () => {
    const bridge = {
      callMarketplaceLocalApi: jest.fn(),
    } as unknown as BridgeService;
    const adapter = new AnytypeLocalApiAdapter(bridge);
    expect(() =>
      adapter.callRead("workspace-1", credentials, {
        operation: "delete_object",
      }),
    ).toThrow("not supported");
    await expect(
      adapter.callRead("workspace-1", credentials, {
        operation: "get_object",
        pathParams: { spaceId: "../escape", objectId: "object-1" },
      }),
    ).rejects.toBeInstanceOf(AnytypeApiError);
    await expect(
      adapter.callManage("workspace-1", credentials, {
        operation: "update_object",
        pathParams: { spaceId: "space-1", objectId: "object-1" },
        body: { apiKey: "nope" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(bridge.callMarketplaceLocalApi).not.toHaveBeenCalled();
  });
});
