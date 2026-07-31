import {
  QuickBooksTimeApiAdapter,
  QuickBooksTimeApiError,
} from "./quickbooks-time-api.adapter";
import {
  QUICKBOOKS_TIME_MANAGE_OPERATION_IDS,
  QUICKBOOKS_TIME_OPERATIONS,
  QUICKBOOKS_TIME_READ_OPERATION_IDS,
  QUICKBOOKS_TIME_SOURCE_COMMIT,
} from "./quickbooks-time-operation-registry";

describe("QuickBooksTimeApiAdapter", () => {
  it("pins the complete provider-maintained v1 operation split", () => {
    expect(QUICKBOOKS_TIME_SOURCE_COMMIT).toBe(
      "3cc0b81b2c380b85571bc44f7f55e7a553c451c4",
    );
    expect(QUICKBOOKS_TIME_OPERATIONS).toHaveLength(86);
    expect(QUICKBOOKS_TIME_READ_OPERATION_IDS).toHaveLength(34);
    expect(QUICKBOOKS_TIME_MANAGE_OPERATION_IDS).toHaveLength(52);
    expect(QUICKBOOKS_TIME_OPERATIONS.map((operation) => operation.id)).toEqual(
      expect.arrayContaining([
        "getCurrentUser",
        "getTimesheets",
        "getFilesRaw",
        "postReportsPayroll",
        "deleteTimesheets",
      ]),
    );
  });

  it("rejects unpinned and cross-tool operations before network access", () => {
    const adapter = new QuickBooksTimeApiAdapter();
    const credentials = { accessToken: "test-access-token-long-enough" };
    expect(() => adapter.read(credentials, "not_pinned", {})).toThrow(
      QuickBooksTimeApiError,
    );
    expect(() =>
      adapter.read(credentials, QUICKBOOKS_TIME_MANAGE_OPERATION_IDS[0], {}),
    ).toThrow("read accepts GET");
  });

  it("sends the bearer token only to the fixed v1 origin and redacts credential-shaped output", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: { timesheets: {} },
          token: "provider-secret",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const adapter = new QuickBooksTimeApiAdapter();
    const result = await adapter.read(
      { accessToken: "test-access-token-long-enough" },
      "getTimesheets",
      { query: { start_date: "2026-07-01", limit: 200 } },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL(
        "https://rest.tsheets.com/api/v1/timesheets?start_date=2026-07-01&limit=200",
      ),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token-long-enough",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      results: { timesheets: {} },
      token: "[REDACTED]",
    });
  });

  it("rejects undocumented filters and credential-bearing runtime fields", async () => {
    const adapter = new QuickBooksTimeApiAdapter();
    const credentials = { accessToken: "test-access-token-long-enough" };
    await expect(
      adapter.read(credentials, "getTimesheets", {
        query: { redirect_uri: "https://example.com" },
      }),
    ).rejects.toThrow("query parameter redirect_uri is not allowed");
    await expect(
      adapter.manage(credentials, "postTimesheets", {
        json: { password: "never-forward-this" },
      }),
    ).rejects.toThrow("Credential-bearing field password is not allowed");
  });
});
