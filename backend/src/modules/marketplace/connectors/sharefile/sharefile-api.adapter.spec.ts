import {
  ShareFileApiAdapter,
  ShareFileApiError,
} from "./sharefile-api.adapter";
import {
  SHAREFILE_ADMIN_OPERATION_IDS,
  SHAREFILE_READ_OPERATION_IDS,
} from "./sharefile-operation-registry";

describe("ShareFileApiAdapter", () => {
  const adapter = new ShareFileApiAdapter();

  it("accepts only documented ShareFile tenant control planes", () => {
    expect(adapter.normalizeApiOrigin("https://acme.sf-api.com")).toBe(
      "https://acme.sf-api.com",
    );
    expect(() => adapter.normalizeApiOrigin("https://example.com")).toThrow(
      ShareFileApiError,
    );
    expect(() => adapter.normalizeApiOrigin("https://127.0.0.1")).toThrow(
      ShareFileApiError,
    );
  });

  it("keeps generated operation groups complete and separate", () => {
    expect(SHAREFILE_READ_OPERATION_IDS).toHaveLength(141);
    expect(SHAREFILE_ADMIN_OPERATION_IDS).toHaveLength(109);
    expect(new Set(SHAREFILE_READ_OPERATION_IDS).size).toBe(141);
  });

  it("rejects credential-shaped caller input before network access", async () => {
    await expect(
      adapter.read(
        "token",
        "https://acme.sf-api.com",
        SHAREFILE_READ_OPERATION_IDS[0],
        { query: { access_token: "leak" } },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
