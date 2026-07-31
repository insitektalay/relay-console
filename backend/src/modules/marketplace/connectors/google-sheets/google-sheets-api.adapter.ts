import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Scalar = string | number | boolean | null;

export class GoogleSheetsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleSheetsApiAdapter {
  private readonly apiOrigin = "https://sheets.googleapis.com/v4";

  async health(token: string) {
    if (!token || token.length > 8000)
      throw new GoogleSheetsApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
  }

  async getSpreadsheet(token: string, input: JsonObject) {
    const spreadsheetId = this.id(input.spreadsheetId);
    const value = await this.requestJson(
      token,
      "GET",
      `${this.apiOrigin}/spreadsheets/${spreadsheetId}`,
      {
        includeGridData: "false",
        fields:
          "spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,index,sheetType,gridProperties(rowCount,columnCount)))",
      },
    );
    const properties = this.object(value.properties);
    return {
      spreadsheet: {
        spreadsheetId: this.text(value.spreadsheetId),
        title: this.text(properties.title),
        locale: this.text(properties.locale),
        timeZone: this.text(properties.timeZone),
        sheets: this.array(value.sheets)
          .slice(0, 50)
          .map((sheet) => this.sheet(sheet)),
      },
      providerRequestCount: 1,
    };
  }

  async getValues(token: string, input: JsonObject) {
    const spreadsheetId = this.id(input.spreadsheetId),
      range = this.range(input.range);
    const value = await this.requestJson(
      token,
      "GET",
      `${this.apiOrigin}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { majorDimension: "ROWS" },
    );
    return {
      valueRange: {
        range: this.text(value.range),
        majorDimension: "ROWS",
        values: this.values(value.values, true),
      },
      providerRequestCount: 1,
    };
  }

  prepareValues(input: JsonObject) {
    const operation =
      input.operation === "update" || input.operation === "append"
        ? input.operation
        : null;
    if (!operation)
      throw new GoogleSheetsApiError(
        "provider_validation_error",
        "operation must be update or append.",
      );
    const change = {
      spreadsheetId: this.id(input.spreadsheetId),
      range: this.range(input.range),
      operation,
      values: this.values(input.values, false),
      valueInputOption: this.inputOption(input.valueInputOption),
    };
    return {
      change,
      digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"),
      providerRequestCount: 0,
    };
  }

  async updateValues(token: string, input: JsonObject) {
    return this.writeValues(token, input, false);
  }
  async appendValues(token: string, input: JsonObject) {
    return this.writeValues(token, input, true);
  }

  private async writeValues(token: string, input: JsonObject, append: boolean) {
    const spreadsheetId = this.id(input.spreadsheetId),
      range = this.range(input.range),
      values = this.values(input.values, false),
      valueInputOption = this.inputOption(input.valueInputOption);
    const suffix = append ? ":append" : "";
    const value = await this.requestJson(
      token,
      append ? "POST" : "PUT",
      `${this.apiOrigin}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}${suffix}`,
      {
        valueInputOption,
        includeValuesInResponse: "false",
        ...(append ? { insertDataOption: "INSERT_ROWS" } : {}),
      },
      { range, majorDimension: "ROWS", values },
    );
    const updates = append ? this.object(value.updates) : value;
    return {
      operation: append ? "append_values" : "update_values",
      spreadsheetId: this.text(updates.spreadsheetId) ?? spreadsheetId,
      tableRange: this.text(value.tableRange),
      updatedRange: this.text(updates.updatedRange),
      updatedRows: this.number(updates.updatedRows),
      updatedColumns: this.number(updates.updatedColumns),
      updatedCells: this.number(updates.updatedCells),
      idempotencyKey: this.key(input.idempotencyKey),
      providerRequestCount: 1,
    };
  }

  private async requestJson(
    token: string,
    method: string,
    baseUrl: string,
    query: Record<string, string>,
    body?: JsonObject,
  ) {
    if (!token || token.length > 8000)
      throw new GoogleSheetsApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
    const url = new URL(baseUrl);
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new GoogleSheetsApiError(
        "provider_unavailable",
        "Google Sheets could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2097152)
      throw new GoogleSheetsApiError(
        "provider_validation_error",
        "Google Sheets response exceeded the 2 MiB Relay bound.",
      );
    if (!response.ok)
      throw new GoogleSheetsApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        response.status === 429
          ? "Google Sheets rate limit reached; retry later."
          : "Google Sheets rejected the bounded request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleSheetsApiError(
        "provider_validation_error",
        "Google Sheets returned invalid JSON.",
      );
    }
  }

  private values(value: unknown, allowEmpty: boolean): Scalar[][] {
    if (
      !Array.isArray(value) ||
      (!allowEmpty && !value.length) ||
      value.length > 200
    )
      throw new GoogleSheetsApiError(
        "provider_validation_error",
        "Values require at most 200 rows.",
      );
    let cells = 0,
      characters = 0;
    const rows = value.map((row) => {
      if (!Array.isArray(row) || row.length > 26)
        throw new GoogleSheetsApiError(
          "provider_validation_error",
          "Each row is limited to 26 cells.",
        );
      cells += row.length;
      return row.map((cell) => {
        if (
          cell !== null &&
          !["string", "number", "boolean"].includes(typeof cell)
        )
          throw new GoogleSheetsApiError(
            "provider_validation_error",
            "Cells must be string, number, boolean, or empty.",
          );
        if (typeof cell === "string") characters += cell.length;
        if (typeof cell === "number" && !Number.isFinite(cell))
          throw new GoogleSheetsApiError(
            "provider_validation_error",
            "Numeric cells must be finite.",
          );
        return cell as Scalar;
      });
    });
    if (cells > 5000 || characters > 100000)
      throw new GoogleSheetsApiError(
        "provider_validation_error",
        "Values exceed the 5,000-cell or 100,000-character Relay bound.",
      );
    return rows;
  }

  private sheet(value: unknown) {
    const properties = this.object(this.object(value).properties),
      grid = this.object(properties.gridProperties);
    return {
      sheetId: this.number(properties.sheetId),
      title: this.text(properties.title),
      index: this.number(properties.index),
      sheetType: this.text(properties.sheetType),
      rowCount: this.number(grid.rowCount),
      columnCount: this.number(grid.columnCount),
    };
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private text(value: unknown) {
    return typeof value === "string" && value.length <= 2000 ? value : null;
  }
  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private id(value: unknown) {
    const result = this.text(value);
    if (!result || !/^[A-Za-z0-9_-]{1,200}$/.test(result))
      throw new GoogleSheetsApiError(
        "provider_validation_error",
        "spreadsheetId is invalid.",
      );
    return result;
  }
  private range(value: unknown) {
    const result = this.text(value)?.trim();
    if (!result || result.length > 500 || /[\r\n]/.test(result))
      throw new GoogleSheetsApiError(
        "provider_validation_error",
        "A bounded explicit A1 range is required.",
      );
    return result;
  }
  private inputOption(value: unknown) {
    if (value == null) return "RAW";
    if (value !== "RAW" && value !== "USER_ENTERED")
      throw new GoogleSheetsApiError(
        "provider_validation_error",
        "valueInputOption must be RAW or USER_ENTERED.",
      );
    return value;
  }
  private key(value: unknown) {
    const result = this.text(value);
    if (!result || result.length < 8 || result.length > 200)
      throw new GoogleSheetsApiError(
        "provider_validation_error",
        "idempotencyKey is invalid.",
      );
    return result;
  }
}
