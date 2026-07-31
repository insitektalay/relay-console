import {
  SplitIoApiAdapter,
  type SplitIoCredentials,
} from "./split-io-api.adapter";
import { SPLIT_IO_OPERATIONS } from "./split-io-operation-registry";

describe("SplitIoApiAdapter", () => {
  const credentials: SplitIoCredentials = {
    adminApiKey: "test-admin-key",
    workspaceId: "workspace-123",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins only project-level list and exact metadata GETs", () => {
    expect(SPLIT_IO_OPERATIONS).toHaveLength(2);
    expect(
      SPLIT_IO_OPERATIONS.every((item) => item.path.includes("/splits/ws/")),
    ).toBe(true);
  });

  it("uses fixed workspace routing, bounds, and Bearer authentication", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            objects: [
              { id: "f1", name: "checkout", owners: [{ id: "private" }] },
            ],
            totalCount: 1,
          }),
        ),
      );
    const result = await new SplitIoApiAdapter().read(
      credentials,
      "list_feature_flags",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.split.io/internal/api/v2/splits/ws/workspace-123/?offset=0&limit=25",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer test-admin-key",
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("pins exact feature-flag metadata by safe name", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{"name":"checkout"}'));
    await new SplitIoApiAdapter().read(credentials, "get_feature_flag", {
      resourceId: "checkout",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.split.io/internal/api/v2/splits/ws/workspace-123/checkout",
    );
  });

  it("blocks routing, pagination, invalid IDs, and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new SplitIoApiAdapter();
    await expect(
      adapter.read(credentials, "list_feature_flags", { limit: 50 } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(credentials, "get_feature_flag", { resourceId: "../users" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() => adapter.read(credentials, "update_flag", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
