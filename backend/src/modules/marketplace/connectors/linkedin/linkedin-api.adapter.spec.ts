import { LinkedInApiAdapter, LinkedInApiError } from "./linkedin-api.adapter";

const response = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("LinkedInApiAdapter", () => {
  it("projects bounded OpenID profile fields and excludes email and picture", async () => {
    const adapter = new LinkedInApiAdapter(async (url, init) => { expect(new URL(url).pathname).toBe("/v2/userinfo"); expect(init.method).toBe("GET"); return response({ sub: "member-sub-001", name: "Alex Morgan", given_name: "Alex", family_name: "Morgan", locale: { language: "en", country: "GB" }, email: "blocked@example.com", picture: "https://blocked.example" }); });
    const profile = await adapter.getMe("token");
    expect(profile).toMatchObject({ subject: "member-sub-001", name: "Alex Morgan", locale: "en-GB", emailPictureExcluded: true });
    expect(profile).not.toHaveProperty("email"); expect(profile).not.toHaveProperty("picture");
  });

  it("publishes one fixed public text-only connected-member post", async () => {
    const adapter = new LinkedInApiAdapter(async (url, init) => { expect(new URL(url).pathname).toBe("/rest/posts"); expect(init.method).toBe("POST"); expect((init.headers as Record<string, string>)["Linkedin-Version"]).toBe("202606"); const body = JSON.parse(String(init.body)); expect(body).toEqual({ author: "urn:li:person:member123", commentary: "Ship the bounded update.", visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }); return response({}, 201, { "x-restli-id": "urn:li:share:7777777777" }); }, "202606");
    await expect(adapter.createTextPost("token", "Ship the bounded update.", "urn:li:person:member123")).resolves.toEqual({ postUrn: "urn:li:share:7777777777", postUrl: "https://www.linkedin.com/feed/update/urn:li:share:7777777777/", published: true, textOnly: true, connectedMemberOnly: true });
  });

  it("rejects invalid text and maps throttling safely", async () => {
    const adapter = new LinkedInApiAdapter(async () => response({}, 429));
    await expect(adapter.createTextPost("token", "", "urn:li:person:member123")).rejects.toMatchObject({ code: "linkedin_text_invalid" });
    await expect(adapter.getMe("token")).rejects.toMatchObject<Partial<LinkedInApiError>>({ code: "linkedin_rate_limited", statusCode: 429 });
  });
});
