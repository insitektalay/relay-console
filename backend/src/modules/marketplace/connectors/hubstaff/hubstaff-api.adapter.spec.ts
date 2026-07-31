import { HubstaffApiAdapter } from "./hubstaff-api.adapter";
import {
  HUBSTAFF_MANAGE_OPERATION_IDS,
  HUBSTAFF_OPERATIONS,
  HUBSTAFF_READ_OPERATION_IDS,
} from "./hubstaff-operation-registry";

describe("HubstaffApiAdapter", () => {
  it("pins the supported official v2 operation split", () => {
    expect(HUBSTAFF_OPERATIONS).toHaveLength(160);
    expect(HUBSTAFF_READ_OPERATION_IDS).toHaveLength(96);
    expect(HUBSTAFF_MANAGE_OPERATION_IDS).toHaveLength(64);
    expect(
      HUBSTAFF_OPERATIONS.map((operation) => String(operation.group)),
    ).not.toContain("webhooks");
  });

  it("rejects unpinned and cross-tool operations before network access", () => {
    const adapter = new HubstaffApiAdapter();
    expect(() => adapter.read("test-token", "not_pinned", {})).toThrow(
      "pinned official v2 API contract",
    );
    expect(() =>
      adapter.read("test-token", HUBSTAFF_MANAGE_OPERATION_IDS[0], {}),
    ).toThrow("read accepts GET");
  });

  it("keeps OAuth tokens on the fixed API origin and redacts credential-shaped output", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ user: { id: 1 }, token: "never-return" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const result = await new HubstaffApiAdapter().read(
      "test-token",
      "getV2UsersMe",
      {},
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://api.hubstaff.com/v2/users/me"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({ user: { id: 1 }, token: "[redacted]" });
  });

  it("rejects credential-bearing runtime fields", async () => {
    await expect(
      new HubstaffApiAdapter().manage("test-token", "postV2Organizations", {
        json: { api_key: "never-forward" },
      }),
    ).rejects.toThrow("Credential-bearing field api_key is not allowed");
  });
});
