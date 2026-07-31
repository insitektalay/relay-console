import { Injectable } from "@nestjs/common";
export class MicrosoftBookingsApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
export type MicrosoftBookingsBinding = { businessId: string };
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const ORIGIN = "https://graph.microsoft.com";
const SAFE_ID = /^[A-Za-z0-9._@!~=-]{1,512}$/;

@Injectable()
export class MicrosoftBookingsApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}
  async health(token: string, binding: MicrosoftBookingsBinding) {
    const business = await this.getBusiness(token, binding);
    return { reachable: true, businessId: business.business.id };
  }
  async getBusiness(token: string, binding: MicrosoftBookingsBinding) {
    return {
      business: this.business(this.object(await this.get(token, binding, ""))),
    };
  }
  async listServices(token: string, binding: MicrosoftBookingsBinding) {
    return this.services(await this.get(token, binding, "/services"));
  }
  async getService(
    token: string,
    binding: MicrosoftBookingsBinding,
    input: Record<string, unknown>,
  ) {
    const serviceId = this.id(input.serviceId, "serviceId");
    return {
      service: this.service(
        this.object(await this.get(token, binding, `/services/${serviceId}`)),
      ),
    };
  }
  async calendarView(
    token: string,
    binding: MicrosoftBookingsBinding,
    input: Record<string, unknown>,
  ) {
    const { start, end } = this.range(input);
    const query = new URLSearchParams({ start, end });
    return this.appointments(
      await this.get(token, binding, `/calendarView?${query.toString()}`),
    );
  }
  private async get(
    token: string,
    binding: MicrosoftBookingsBinding,
    suffix: string,
  ) {
    if (!token.trim())
      throw new MicrosoftBookingsApiError(
        "microsoft_bookings_token_invalid",
        "Microsoft Bookings connection token is missing.",
      );
    const businessId = this.id(binding.businessId, "selectedBusinessId");
    const url = new URL(
      `/v1.0/solutions/bookingBusinesses/${encodeURIComponent(businessId)}${suffix}`,
      ORIGIN,
    );
    const allowedPath =
      /^\/v1\.0\/solutions\/bookingBusinesses\/[A-Za-z0-9._%40!~=-]{1,1536}(?:\/services(?:\/[A-Za-z0-9._@!~=-]{1,512})?|\/calendarView)?$/;
    const keys = [...url.searchParams.keys()];
    if (
      url.origin !== ORIGIN ||
      !allowedPath.test(url.pathname) ||
      /\/(customers|staffMembers|customQuestions|appointments)(\/|$)/i.test(
        url.pathname,
      ) ||
      (url.pathname.endsWith("/calendarView")
        ? keys.length !== 2 || !keys.includes("start") || !keys.includes("end")
        : keys.length !== 0)
    )
      throw new MicrosoftBookingsApiError(
        "microsoft_bookings_path_blocked",
        "Microsoft Bookings request is outside the selected-business privacy-scrubbed V1 allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new MicrosoftBookingsApiError(
        "microsoft_bookings_unavailable",
        "Microsoft Graph Bookings is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new MicrosoftBookingsApiError(
        "microsoft_bookings_response_too_large",
        "Microsoft Graph Bookings response exceeded 1 MB.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new MicrosoftBookingsApiError(
        "microsoft_bookings_response_invalid",
        "Microsoft Graph returned an invalid Bookings response.",
      );
    }
    if (!response.ok)
      throw new MicrosoftBookingsApiError(
        response.status === 401
          ? "microsoft_bookings_token_invalid"
          : response.status === 403
            ? "microsoft_bookings_permission_denied"
            : response.status === 404
              ? "microsoft_bookings_not_found"
              : response.status === 429
                ? "microsoft_bookings_rate_limited"
                : "microsoft_bookings_graph_error",
        "Microsoft Graph Bookings request failed.",
        response.status,
      );
    return body;
  }
  private rows(value: unknown) {
    const root = this.object(value);
    return Array.isArray(root.value)
      ? root.value.slice(0, 25).map((v) => this.object(v))
      : [];
  }
  private services(value: unknown) {
    const rows = this.rows(value).map((v) => this.service(v));
    return {
      services: rows,
      resultCount: rows.length,
      nextPageFollowed: false,
    };
  }
  private appointments(value: unknown) {
    const rows = this.rows(value).map((v) => this.appointment(v));
    return {
      appointments: rows,
      resultCount: rows.length,
      nextPageFollowed: false,
    };
  }
  private business(r: Record<string, unknown>) {
    return {
      id: this.scalar(r.id),
      displayName: this.scalar(r.displayName),
      businessType: this.scalar(r.businessType),
      defaultCurrencyIso: this.scalar(r.defaultCurrencyIso, 16),
      timeZone: this.scalar(r.timeZone, 128),
      emailExcluded: true,
      phoneExcluded: true,
      addressExcluded: true,
      websiteExcluded: true,
    };
  }
  private service(r: Record<string, unknown>) {
    return {
      id: this.scalar(r.id),
      displayName: this.scalar(r.displayName),
      duration: this.scalar(r.defaultDuration, 64),
      price: this.scalar(r.defaultPrice),
      priceType: this.scalar(r.defaultPriceType, 64),
      maximumAttendeesCount: this.scalar(r.maximumAttendeesCount),
      descriptionExcluded: true,
      notesExcluded: true,
      staffMembersExcluded: true,
      customQuestionsExcluded: true,
    };
  }
  private appointment(r: Record<string, unknown>) {
    return {
      id: this.scalar(r.id),
      serviceId: this.scalar(r.serviceId),
      serviceName: this.scalar(r.serviceName),
      start: this.dateTime(r.start),
      end: this.dateTime(r.end),
      duration: this.scalar(r.duration, 64),
      appointmentLabel: this.scalar(r.appointmentLabel),
      customersExcluded: true,
      customerContactExcluded: true,
      customerNotesExcluded: true,
      staffMembersExcluded: true,
      joinURLExcluded: true,
      additionalInformationExcluded: true,
    };
  }
  private dateTime(v: unknown) {
    const r = this.object(v);
    return {
      dateTime: this.scalar(r.dateTime, 64),
      timeZone: this.scalar(r.timeZone, 128),
    };
  }
  private range(input: Record<string, unknown>) {
    const start = input.start,
      end = input.end;
    if (typeof start !== "string" || typeof end !== "string")
      throw new MicrosoftBookingsApiError(
        "microsoft_bookings_input_invalid",
        "Calendar view requires explicit ISO-8601 start and end values.",
      );
    const s = Date.parse(start),
      e = Date.parse(end);
    if (
      !Number.isFinite(s) ||
      !Number.isFinite(e) ||
      e <= s ||
      e - s > 7 * 86_400_000
    )
      throw new MicrosoftBookingsApiError(
        "microsoft_bookings_input_invalid",
        "Calendar view range must be positive and at most seven days.",
      );
    return { start, end };
  }
  private id(v: unknown, field: string) {
    if (typeof v !== "string" || !SAFE_ID.test(v))
      throw new MicrosoftBookingsApiError(
        "microsoft_bookings_input_invalid",
        `A safe explicit ${field} is required.`,
      );
    return v;
  }
  private object(v: unknown): Record<string, unknown> {
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};
  }
  private scalar(v: unknown, max = 512): string | number | boolean | null {
    if (typeof v === "string") return v.slice(0, max);
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "boolean") return v;
    return null;
  }
}
