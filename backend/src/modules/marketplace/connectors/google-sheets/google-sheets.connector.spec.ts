import {
  GoogleSheetsApiAdapter,
  GoogleSheetsApiError,
} from "./google-sheets-api.adapter";
import {
  GOOGLE_SHEETS_CONNECTOR_MANIFEST,
  GOOGLE_SHEETS_SCOPES,
} from "./google-sheets.connector";

describe("Google Sheets connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses exact app-file OAuth and exposes five bounded tools", () => {
    expect(GOOGLE_SHEETS_SCOPES).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/drive.file",
    ]);
    expect(GOOGLE_SHEETS_CONNECTOR_MANIFEST.tools).toHaveLength(5);
    expect(
      GOOGLE_SHEETS_CONNECTOR_MANIFEST.tools
        .filter((tool) => tool.approvalRequired)
        .map((tool) => tool.functionName),
    ).toEqual(["google_sheets_values_update", "google_sheets_values_append"]);
  });

  it("reads metadata without grid data from one fixed endpoint", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          spreadsheetId: "sheet_1",
          properties: { title: "Plan" },
          sheets: [],
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleSheetsApiAdapter().getSpreadsheet("token", {
      spreadsheetId: "sheet_1",
    });
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [URL];
    expect(url.origin + url.pathname).toBe(
      "https://sheets.googleapis.com/v4/spreadsheets/sheet_1",
    );
    expect(url.searchParams.get("includeGridData")).toBe("false");
    expect(result).toMatchObject({
      spreadsheet: { spreadsheetId: "sheet_1", title: "Plan" },
      providerRequestCount: 1,
    });
  });

  it("rejects oversized or non-scalar value matrices locally", () => {
    const adapter = new GoogleSheetsApiAdapter();
    expect(() =>
      adapter.prepareValues({
        spreadsheetId: "sheet_1",
        range: "A1",
        operation: "update",
        values: [[{ unsafe: true }]],
      }),
    ).toThrow(GoogleSheetsApiError);
    expect(() =>
      adapter.prepareValues({
        spreadsheetId: "sheet_1",
        range: "A1",
        operation: "append",
        values: Array.from({ length: 201 }, () => [1]),
      }),
    ).toThrow(GoogleSheetsApiError);
  });

  it("pins append semantics and returns only bounded update metadata", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          spreadsheetId: "sheet_1",
          tableRange: "A1:B2",
          updates: {
            spreadsheetId: "sheet_1",
            updatedRange: "A3:B3",
            updatedRows: 1,
            updatedColumns: 2,
            updatedCells: 2,
          },
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleSheetsApiAdapter().appendValues("token", {
      spreadsheetId: "sheet_1",
      range: "A:B",
      values: [["Relay", true]],
      valueInputOption: "RAW",
      idempotencyKey: "request-123",
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(url.pathname).toBe("/v4/spreadsheets/sheet_1/values/A%3AB:append");
    expect(url.searchParams.get("insertDataOption")).toBe("INSERT_ROWS");
    expect(init.method).toBe("POST");
    expect(result).toMatchObject({
      operation: "append_values",
      updatedCells: 2,
      idempotencyKey: "request-123",
      providerRequestCount: 1,
    });
  });
});
