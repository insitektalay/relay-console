import { SmartsheetApiAdapter } from "./smartsheet-api.adapter";

const credentials = {
  accessToken: "fixture-value",
  apiOrigin: "https://api.smartsheet.com/2.0",
  accountId: "1001",
  userId: "2002",
};

describe("SmartsheetApiAdapter", () => {
  it("binds health to the exact account, user, and API origin", async () => {
    const requester = jest.fn(
      async (_url: string | URL, _init: RequestInit) =>
        new Response(JSON.stringify({ id: 2002, account: { id: 1001 } }), {
          status: 200,
        }),
    );
    await expect(
      new SmartsheetApiAdapter(requester).health(credentials),
    ).resolves.toEqual({
      accountId: "1001",
      userId: "2002",
      apiOrigin: credentials.apiOrigin,
    });
    expect((requester.mock.calls[0][0] as URL).pathname).toBe("/2.0/users/me");
  });

  it("uses bounded sheet and row reads", async () => {
    const requester = jest.fn(
      async (url: string | URL) =>
        new Response(
          JSON.stringify(
            (url as URL).pathname.endsWith("/sheets")
              ? { data: [{ id: 3003, name: "Launch" }] }
              : {
                  id: 4004,
                  rowNumber: 2,
                  cells: [{ columnId: 5005, displayValue: "Ready" }],
                },
          ),
          { status: 200 },
        ),
    );
    const adapter = new SmartsheetApiAdapter(requester);
    await expect(
      adapter.listSheets(credentials, { limit: 10 }),
    ).resolves.toMatchObject({ sheets: [{ sheetId: "3003", name: "Launch" }] });
    await expect(
      adapter.getRow(credentials, { sheetId: "3003", rowId: "4004" }),
    ).resolves.toMatchObject({
      row: { rowId: "4004", cells: [{ displayValue: "Ready" }] },
    });
    expect(
      (requester.mock.calls[0][0] as URL).searchParams.get("pageSize"),
    ).toBe("10");
    expect((requester.mock.calls[1][0] as URL).pathname).toBe(
      "/2.0/sheets/3003/rows/4004",
    );
  });

  it("rejects traversal, credential fields, invalid IDs, and lookalike hosts", async () => {
    const adapter = new SmartsheetApiAdapter(jest.fn());
    await expect(
      adapter.request(credentials, { method: "GET", path: "/sheets/../users" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/sheets",
        json: { access_token: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.getRow(credentials, { sheetId: "bad", rowId: "4004" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listSheets({
        ...credentials,
        apiOrigin: "https://api.smartsheet.com.evil.example/2.0",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
  });
});
