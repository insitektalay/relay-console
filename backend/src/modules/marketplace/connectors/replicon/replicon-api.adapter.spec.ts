import { RepliconApiAdapter, RepliconApiError } from "./replicon-api.adapter";
import {
  REPLICON_MANAGE_OPERATION_IDS,
  REPLICON_OPERATIONS,
  REPLICON_READ_OPERATION_IDS,
  REPLICON_SOURCE_SHA256,
} from "./replicon-operation-registry";

describe("RepliconApiAdapter", () => {
  it("pins the complete public REST reference split", () => {
    expect(REPLICON_SOURCE_SHA256).toHaveLength(64);
    expect(REPLICON_OPERATIONS).toHaveLength(158);
    expect(REPLICON_READ_OPERATION_IDS).toHaveLength(102);
    expect(REPLICON_MANAGE_OPERATION_IDS).toHaveLength(56);
    expect(REPLICON_OPERATIONS.map((operation) => operation.id)).toEqual(
      expect.arrayContaining([
        "ProjectService1.CreateProjectOrApplyModifications",
        "TaskService1.CreateTaskOrApplyModifications",
        "ImportService2.CreateUserOrApplyModifications",
        "TimeDataExportService1.GetAllColumns",
        "UserAccessControlService1.GetMyIdentity",
      ]),
    );
  });

  it("rejects unpinned and cross-tool operations before network access", () => {
    const adapter = new RepliconApiAdapter();
    const credentials = {
      companyKey: "relay-test",
      accessToken: "test-access-token-long-enough",
    };
    expect(() => adapter.read(credentials, "not_pinned", {})).toThrow(
      RepliconApiError,
    );
    expect(() =>
      adapter.read(credentials, REPLICON_MANAGE_OPERATION_IDS[0], {}),
    ).toThrow("read accepts read-only");
  });

  it("discovers the tenant then sends the token only to its pinned services route", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            d: { applicationRootUrl: "https://na3.replicon.com/" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ d: { displayText: "Alex" }, accessToken: "nope" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const adapter = new RepliconApiAdapter();
    const result = await adapter.read(
      {
        companyKey: "relay-test",
        accessToken: "test-access-token-long-enough",
      },
      "UserAccessControlService1.GetMyIdentity",
      {},
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "https://global.replicon.com/DiscoveryService1.svc/GetTenantEndpointDetails",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ tenant: { companyKey: "relay-test" } }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      new URL(
        "https://na3.replicon.com/relay-test/services/UserAccessControlService1.svc/GetMyIdentity",
      ),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token-long-enough",
          "X-Replicon-Application": "RelayConsole_Marketplace_1.0",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      d: { displayText: "Alex" },
      accessToken: "[REDACTED]",
    });
  });

  it("rejects forged discovery hosts and credential-bearing runtime fields", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            d: { applicationRootUrl: "https://evil.example/" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const adapter = new RepliconApiAdapter();
    const credentials = {
      companyKey: "relay-test",
      accessToken: "test-access-token-long-enough",
    };
    await expect(
      adapter.read(credentials, "UserAccessControlService1.GetMyIdentity", {}),
    ).rejects.toThrow("outside replicon.com");
    await expect(
      adapter.manage(
        credentials,
        "ProjectService1.CreateProjectOrApplyModifications",
        { json: { password: "never-forward-this" } },
      ),
    ).rejects.toThrow("Credential-bearing field password is not allowed");
  });
});
