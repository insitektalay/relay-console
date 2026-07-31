import { Injectable } from "@nestjs/common";

export class LinkedInApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode?: number) { super(message); }
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const ORIGIN = "https://api.linkedin.com";
const PERSON_URN = /^urn:li:person:[A-Za-z0-9_-]{1,256}$/;

@Injectable()
export class LinkedInApiAdapter {
  constructor(private readonly request: HttpClient = fetch, private readonly linkedinVersion = process.env.LINKEDIN_API_VERSION ?? "202606") {}

  async health(accessToken: string) { return this.getMe(accessToken); }

  async getMe(accessToken: string) {
    const row = this.object(await this.call(accessToken, "/v2/userinfo", "GET"));
    const subject = this.scalar(row.sub, 256);
    if (!subject) throw new LinkedInApiError("linkedin_profile_invalid", "LinkedIn did not return the connected member subject.");
    return { subject, name: this.scalar(row.name, 512), givenName: this.scalar(row.given_name, 256), familyName: this.scalar(row.family_name, 256), locale: this.locale(row.locale), emailPictureExcluded: true };
  }

  async createTextPost(accessToken: string, text: unknown, memberUrn: unknown) {
    const commentary = typeof text === "string" ? text.trim() : "";
    if (!commentary || commentary.length > 3000) throw new LinkedInApiError("linkedin_text_invalid", "LinkedIn text must contain 1 to 3,000 characters.");
    if (typeof memberUrn !== "string" || !PERSON_URN.test(memberUrn)) throw new LinkedInApiError("linkedin_member_invalid", "A verified connected-member URN is required.");
    const result = await this.call(accessToken, "/rest/posts", "POST", { author: memberUrn, commentary, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }, true);
    const object = this.object(result);
    const postUrn = this.scalar(object.postUrn, 256);
    if (!postUrn) throw new LinkedInApiError("linkedin_response_invalid", "LinkedIn did not return the published post URN.");
    return { postUrn, postUrl: this.postUrl(postUrn), published: true, textOnly: true, connectedMemberOnly: true };
  }

  private async call(accessToken: string, path: string, method: "GET" | "POST", body?: unknown, includeHeaders = false) {
    if (!accessToken.trim()) throw new LinkedInApiError("linkedin_token_invalid", "LinkedIn access token is missing.");
    const url = new URL(path, ORIGIN);
    if (url.origin !== ORIGIN || !((url.pathname === "/v2/userinfo" && url.search === "" && method === "GET") || (url.pathname === "/rest/posts" && url.search === "" && method === "POST"))) throw new LinkedInApiError("linkedin_path_blocked", "LinkedIn request is outside the fixed member-profile/text-post V1 allowlist.");
    let response: Response;
    try { response = await this.request(url.toString(), { method, headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}`, ...(method === "POST" ? { "Content-Type": "application/json", "Linkedin-Version": this.linkedinVersion, "X-Restli-Protocol-Version": "2.0.0" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(30_000) }); }
    catch { throw new LinkedInApiError("linkedin_unavailable", "LinkedIn is temporarily unavailable."); }
    const raw = await response.text();
    if (raw.length > 1_000_000) throw new LinkedInApiError("linkedin_response_too_large", "LinkedIn response exceeded 1 MB.");
    let parsed: unknown = {};
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { throw new LinkedInApiError("linkedin_response_invalid", "LinkedIn returned an invalid response."); }
    if (!response.ok) throw new LinkedInApiError(response.status === 401 ? "linkedin_token_invalid" : response.status === 403 ? "linkedin_permission_denied" : response.status === 429 ? "linkedin_rate_limited" : "linkedin_api_error", "LinkedIn request failed.", response.status);
    return includeHeaders ? { body: parsed, postUrn: response.headers.get("x-restli-id") ?? response.headers.get("x-linkedin-id") } : parsed;
  }

  private postUrl(urn: string) { const id = urn.split(":").pop() ?? ""; return /^\d{1,32}$/.test(id) ? `https://www.linkedin.com/feed/update/${urn}/` : null; }
  private locale(value: unknown) { if (typeof value === "string") return value.slice(0, 32); const row = this.object(value); const language = this.scalar(row.language, 8), country = this.scalar(row.country, 8); return language ? country ? `${language}-${country}` : language : null; }
  private object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  private scalar(value: unknown, max: number): string | null { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null; }
}
