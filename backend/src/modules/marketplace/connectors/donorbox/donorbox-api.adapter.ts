import { EventPlatformApiError } from "../event-platform/event-platform-read-api.adapter";

type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
type JsonObject = Record<string, unknown>;

export type DonorboxCredentials = { accountEmail: string; apiKey: string };

/** Fixed-origin, read-only Donorbox campaign metadata boundary. */
export class DonorboxApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: DonorboxCredentials) {
    await this.listCampaigns(credentials, { limit: 1 });
    return { apiOrigin: "https://donorbox.org" };
  }

  async listCampaigns(
    credentials: DonorboxCredentials,
    input: { limit?: number } = {},
  ) {
    const limit =
      Number.isInteger(input.limit) && input.limit! >= 1 && input.limit! <= 25
        ? input.limit!
        : 25;
    const email = credentials.accountEmail?.trim().toLowerCase();
    const apiKey = credentials.apiKey?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new EventPlatformApiError(
        "credential_missing",
        "Donorbox organization login email is required.",
        401,
      );
    if (!apiKey)
      throw new EventPlatformApiError(
        "credential_missing",
        "Donorbox API key is required.",
        401,
      );

    const url = new URL("https://donorbox.org/api/v1/campaigns");
    url.search = new URLSearchParams({
      page: "1",
      per_page: String(limit),
      order: "desc",
    }).toString();
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${email}:${apiKey}`).toString("base64")}`,
          "User-Agent": "RelayConsole-donorbox/1.0",
        },
      });
    } catch {
      throw new EventPlatformApiError(
        "provider_unavailable",
        "Donorbox could not be reached.",
        502,
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new EventPlatformApiError(
        "provider_validation_error",
        "Donorbox response exceeds Relay's 2 MB boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new EventPlatformApiError(
        "provider_validation_error",
        "Donorbox response exceeds Relay's 2 MB boundary.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : [];
    } catch {
      throw new EventPlatformApiError(
        "provider_validation_error",
        "Donorbox returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new EventPlatformApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        `Donorbox returned HTTP ${response.status}.`,
        response.status,
      );
    if (!Array.isArray(body))
      throw new EventPlatformApiError(
        "provider_validation_error",
        "Donorbox returned an invalid campaign list.",
      );
    return {
      campaigns: body.slice(0, limit).map((value) => this.campaign(value)),
      pageBound: limit,
      automaticPagination: false,
    };
  }

  private campaign(value: unknown) {
    const item =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : {};
    const id =
      typeof item.id === "number" || typeof item.id === "string"
        ? String(item.id)
        : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!/^\d{1,20}$/.test(id) || !name)
      throw new EventPlatformApiError(
        "provider_validation_error",
        "Donorbox returned an incomplete campaign.",
      );
    return {
      campaignId: id,
      name: name.slice(0, 500),
      slug:
        typeof item.slug === "string"
          ? item.slug.trim().slice(0, 200) || null
          : null,
      createdAt: this.date(item.created_at),
      updatedAt: this.date(item.updated_at),
    };
  }

  private date(value: unknown) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value))
      ? value.slice(0, 100)
      : null;
  }
}
