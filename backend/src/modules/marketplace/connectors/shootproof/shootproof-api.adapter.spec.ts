import {
  ShootProofApiAdapter,
  ShootProofApiError,
} from "./shootproof-api.adapter";
import {
  SHOOTPROOF_MANAGE_OPERATION_IDS,
  SHOOTPROOF_OPERATIONS,
  SHOOTPROOF_READ_OPERATION_IDS,
  SHOOTPROOF_SOURCE_SHA256,
} from "./shootproof-operation-registry";

describe("ShootProofApiAdapter", () => {
  it("pins the complete official Studio API operation split", () => {
    expect(SHOOTPROOF_SOURCE_SHA256).toBe(
      "635c005b078ebe2c7fd7276329eaf17beafcdf4d0048a99aa06113c1eab84f47",
    );
    expect(SHOOTPROOF_OPERATIONS).toHaveLength(302);
    expect(SHOOTPROOF_READ_OPERATION_IDS).toHaveLength(125);
    expect(SHOOTPROOF_MANAGE_OPERATION_IDS).toHaveLength(177);
  });

  it("rejects unpinned and cross-tool operations before network access", () => {
    const adapter = new ShootProofApiAdapter();
    expect(() => adapter.read("test-token", "not_pinned", {})).toThrow(
      ShootProofApiError,
    );
    expect(() =>
      adapter.read("test-token", SHOOTPROOF_MANAGE_OPERATION_IDS[0], {}),
    ).toThrow("read accepts GET");
  });

  it("validates paths and credential-bearing inputs before network access", async () => {
    const adapter = new ShootProofApiAdapter();
    await expect(
      adapter.read("test-token", "readResourceBrand", {
        pathParameters: { brandId: "../unsafe" },
      }),
    ).rejects.toThrow("path parameter is invalid");
    await expect(
      adapter.manage("test-token", "createResourceContact", {
        pathParameters: { brandId: "123" },
        json: { accessToken: "must-not-pass" },
      }),
    ).rejects.toThrow("Credential-bearing field");
  });
});
