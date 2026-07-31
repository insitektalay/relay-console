export const BAMBOOHR_SCOPES = ["field", "meta", "offline_access"];

export type BambooHRCredentials = {
  accessToken: string;
  companyDomain: string;
  locationId: string;
};

export class BambooHRApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class BambooHRApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: BambooHRCredentials) {
    const { location } = await this.getLocation(credentials);
    return {
      ready: true,
      companyDomain: this.companyDomain(credentials.companyDomain),
      locationId: location.id,
    };
  }

  async listLocations(
    credentials: BambooHRCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const root = this.record(
      await this.request(
        credentials,
        `/api/v1/hris/org/locations?page=0&pageSize=${limit}&select=id%2Clabel%2Carchived%2Cmanageable%2Caddress%2Ftimezone%2Caddress%2FremoteLocation%2CcreatedAt%2CarchivedAt`,
      ),
    );
    const values = Array.isArray(root.data) ? root.data : [];
    return {
      locations: values.slice(0, limit).map((value) => this.location(value)),
      page: 0,
      limit,
      automaticPagination: false,
    };
  }

  async getLocation(credentials: BambooHRCredentials) {
    const expectedId = this.locationId(credentials.locationId);
    const location = this.location(
      await this.request(
        credentials,
        `/api/v1/hris/org/locations/${expectedId}`,
      ),
    );
    if (location.id !== expectedId)
      throw new BambooHRApiError(
        "bamboohr_location_binding_mismatch",
        "BambooHR selected Location binding changed.",
        403,
      );
    return { location };
  }

  async listCountries(
    credentials: BambooHRCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const root = await this.request(
      credentials,
      "/api/v1/meta/countries/options",
    );
    const values = Array.isArray(root) ? root : [];
    return {
      countries: values.slice(0, limit).map((value) => this.country(value)),
      limit,
      automaticPagination: false,
    };
  }

  private async request(credentials: BambooHRCredentials, path: string) {
    if (
      !/^\/api\/v1\/(?:hris\/org\/locations(?:\/[A-Za-z0-9_-]{1,128}|\?page=0&pageSize=(?:[1-9]|1[0-9]|2[0-5])&select=id%2Clabel%2Carchived%2Cmanageable%2Caddress%2Ftimezone%2Caddress%2FremoteLocation%2CcreatedAt%2CarchivedAt)?|meta\/countries\/options)$/.test(
        path,
      )
    )
      throw new BambooHRApiError(
        "bamboohr_path_invalid",
        "BambooHR API path is invalid.",
        400,
      );
    if (!credentials.accessToken || credentials.accessToken.length > 30_000)
      throw new BambooHRApiError(
        "bamboohr_credential_missing",
        "BambooHR OAuth access token is missing.",
        401,
      );
    const company = this.companyDomain(credentials.companyDomain);
    const response = await this.requester(
      `https://${company}.bamboohr.com${path}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "User-Agent": "RelayConsole-BambooHR/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const code =
        response.status === 401
          ? "bamboohr_token_invalid"
          : response.status === 403
            ? "bamboohr_scope_denied"
            : response.status === 404
              ? "bamboohr_resource_not_found"
              : response.status === 429 || response.status === 503
                ? "bamboohr_rate_limited"
                : "bamboohr_unavailable";
      throw new BambooHRApiError(
        code,
        "BambooHR API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new BambooHRApiError(
        "bamboohr_response_too_large",
        "BambooHR response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new BambooHRApiError(
        "bamboohr_response_invalid",
        "BambooHR returned an invalid response.",
      );
    }
  }

  private location(value: unknown) {
    const location = this.record(value);
    const address = this.record(location.address);
    return {
      id: this.locationId(location.id),
      label: this.text(location.label),
      archived: this.boolean(location.archived),
      manageable: this.boolean(location.manageable),
      timezone: this.text(address.timezone),
      remoteLocation: this.boolean(address.remoteLocation),
      createdAt: this.text(location.createdAt),
      archivedAt: this.text(location.archivedAt),
      addressDetailsReturned: false,
      employeeDataReturned: false,
    };
  }

  private country(value: unknown) {
    const country = this.record(value);
    return {
      id: this.text(country.id),
      name: this.text(country.name),
      isoCode: this.text(country.isoCode),
    };
  }

  private companyDomain(value: unknown) {
    const text = this.text(value).toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(text))
      throw new BambooHRApiError(
        "bamboohr_company_domain_invalid",
        "BambooHR Company Domain is invalid.",
        400,
      );
    return text;
  }

  private locationId(value: unknown) {
    const text = typeof value === "number" ? String(value) : this.text(value);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(text))
      throw new BambooHRApiError(
        "bamboohr_location_id_invalid",
        "BambooHR Location ID is invalid.",
        400,
      );
    return text;
  }

  private limit(value: unknown) {
    const limit = value === undefined ? 25 : Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25)
      throw new BambooHRApiError(
        "bamboohr_limit_invalid",
        "BambooHR limit must be an integer from 1 through 25.",
        400,
      );
    return limit;
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 1_200) : "";
  }

  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : false;
  }
}
