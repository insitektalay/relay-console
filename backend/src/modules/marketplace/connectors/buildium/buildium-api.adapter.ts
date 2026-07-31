import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type BuildiumCredentials = { clientId: string; clientSecret: string };

export class BuildiumApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

/** Fixed-production, property-inventory-only Buildium boundary. */
export class BuildiumApiAdapter {
  private readonly origin = "https://api.buildium.com";

  constructor(private readonly requester: typeof fetch = fetch) {}

  async health(credentials: BuildiumCredentials) {
    await this.listRentals(credentials, { limit: 1 });
    return { apiOrigin: this.origin };
  }

  async listRentals(
    credentials: BuildiumCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = await this.request(credentials, "/v1/rentals", {
      orderby: "Id",
      offset: "0",
      limit: String(limit),
    });
    return {
      rentals: this.array(body)
        .slice(0, limit)
        .map((item) => this.rental(item)),
      pageBound: limit,
      automaticPagination: false,
    };
  }

  async getRental(
    credentials: BuildiumCredentials,
    input: { rentalId: number },
  ) {
    const rentalId = this.identifier(input.rentalId, "rental ID");
    return {
      rental: this.rental(
        await this.request(credentials, `/v1/rentals/${rentalId}`, {}),
      ),
    };
  }

  async listUnits(
    credentials: BuildiumCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = await this.request(credentials, "/v1/rentals/units", {
      orderby: "Id",
      offset: "0",
      limit: String(limit),
    });
    return {
      units: this.array(body)
        .slice(0, limit)
        .map((item) => this.unit(item)),
      pageBound: limit,
      automaticPagination: false,
    };
  }

  async getUnit(credentials: BuildiumCredentials, input: { unitId: number }) {
    const unitId = this.identifier(input.unitId, "unit ID");
    return {
      unit: this.unit(
        await this.request(credentials, `/v1/rentals/units/${unitId}`, {}),
      ),
    };
  }

  private async request(
    credentials: BuildiumCredentials,
    path: string,
    query: Record<string, string>,
  ) {
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    if (!clientId || !clientSecret)
      throw new BuildiumApiError(
        "credential_missing",
        "Buildium client ID and secret are required.",
        401,
      );
    if (!/^\/v1\/rentals(?:\/units)?(?:\/[1-9][0-9]*)?$/.test(path))
      throw new BuildiumApiError(
        "provider_validation_error",
        "Buildium API path is invalid.",
      );
    const url = new URL(path, this.origin);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "x-buildium-client-id": clientId,
          "x-buildium-client-secret": clientSecret,
          "User-Agent": "RelayConsole-buildium/1.0",
        },
      });
    } catch (error) {
      if (error instanceof BuildiumApiError) throw error;
      throw new BuildiumApiError(
        "provider_unavailable",
        "Buildium could not be reached.",
        502,
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new BuildiumApiError(
        "provider_validation_error",
        "Buildium response exceeds Relay's 2 MB boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new BuildiumApiError(
        "provider_validation_error",
        "Buildium response exceeds Relay's 2 MB boundary.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new BuildiumApiError(
        "provider_validation_error",
        "Buildium returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new BuildiumApiError(
        this.safeCode(response.status),
        `Buildium returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private rental(value: unknown) {
    const item = this.object(value);
    const id = this.positiveNumber(item.Id);
    const name = this.text(item.Name, 300);
    if (!id || !name)
      throw new BuildiumApiError(
        "provider_validation_error",
        "Buildium returned an incomplete rental property.",
      );
    const address = this.object(item.Address);
    return {
      rentalId: id,
      name,
      active: typeof item.IsActive === "boolean" ? item.IsActive : null,
      rentalType: this.text(item.RentalType, 100),
      rentalSubType: this.text(item.RentalSubType, 100),
      unitCount: this.nonNegativeNumber(item.NumberUnits),
      city: this.text(address.City, 200),
      state: this.text(address.State, 100),
      postalCode: this.text(address.PostalCode, 30),
    };
  }

  private unit(value: unknown) {
    const item = this.object(value);
    const id = this.positiveNumber(item.Id);
    const propertyId = this.positiveNumber(item.PropertyId);
    if (!id || !propertyId)
      throw new BuildiumApiError(
        "provider_validation_error",
        "Buildium returned an incomplete rental unit.",
      );
    return {
      unitId: id,
      rentalId: propertyId,
      unitNumber: this.text(item.UnitNumber, 100),
      buildingName: this.text(item.BuildingName, 300),
      active: typeof item.IsActive === "boolean" ? item.IsActive : null,
      bedrooms: this.nonNegativeNumber(item.Bedrooms),
      bathrooms: this.nonNegativeNumber(item.Bathrooms),
      squareFeet: this.nonNegativeNumber(item.SquareFeet),
    };
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maximum)
      : null;
  }
  private positiveNumber(value: unknown) {
    return Number.isSafeInteger(value) && Number(value) > 0
      ? Number(value)
      : null;
  }
  private nonNegativeNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : null;
  }
  private identifier(value: unknown, label: string) {
    if (!Number.isSafeInteger(value) || Number(value) <= 0)
      throw new BuildiumApiError(
        "provider_validation_error",
        `Buildium ${label} is invalid.`,
      );
    return Number(value);
  }
  private limit(value?: number) {
    return Number.isInteger(value) && value! >= 1 && value! <= 25 ? value! : 25;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }
}
