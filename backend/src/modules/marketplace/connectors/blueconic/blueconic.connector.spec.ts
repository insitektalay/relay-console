import { BlueConicApiAdapter } from "./blueconic-api.adapter";
import { BLUECONIC_CONNECTOR_MANIFEST } from "./blueconic.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("BlueConic connector", () => {
  const credentials = {
    tenantName: "example-tenant",
    clientId: "test-client",
    clientSecret: "test-secret",
  };

  it("exposes one approved aggregate segment read", () => {
    expect(BLUECONIC_CONNECTOR_MANIFEST.slug).toBe("blueconic");
    expect(BLUECONIC_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "blueconic.getSegmentReadinessSummary",
    ]);
    expect(BLUECONIC_CONNECTOR_MANIFEST.tools[0].approvalRequired).toBe(true);
  });

  it("uses tenant-bound v2 OAuth and segments endpoints and returns only a count", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(json({ access_token: "short-lived-token", expires_in: 3600 }))
      .mockResolvedValueOnce(
        json([
          { id: "private-id", name: "VIP", definition: "email exists", size: 999 },
          { id: "other-id", name: "Recent buyers", members: ["customer"] },
        ]),
      );
    const result = await new BlueConicApiAdapter(
      requester,
    ).getSegmentReadinessSummary(credentials);
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://www.example-tenant.blueconic.net/rest/v2/oauth/token",
    );
    expect(requester.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    expect(requester.mock.calls[0][1].body).toContain("grant_type=client_credentials");
    expect(String(requester.mock.calls[1][0])).toBe(
      "https://www.example-tenant.blueconic.net/rest/v2/segments",
    );
    expect(requester.mock.calls[1][1].headers).toMatchObject({
      Authorization: "Bearer short-lived-token",
    });
    expect(result).toEqual({
      segmentCount: 2,
      redactionStatus:
        "tenant-segment-identity-definitions-membership-profile-and-customer-data-excluded",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /example-tenant|private-id|VIP|email exists|999|Recent buyers|short-lived-token|test-secret/,
    );
  });

  it("rejects a non-tenant host label before network access", async () => {
    const requester = jest.fn();
    await expect(
      new BlueConicApiAdapter(requester).health({
        ...credentials,
        tenantName: "evil.example.com",
      }),
    ).rejects.toMatchObject({ code: "credential_missing", statusCode: 401 });
    expect(requester).not.toHaveBeenCalled();
  });

  it("preserves provider rate limits", async () => {
    const requester = jest.fn().mockResolvedValue(json({}, 429));
    await expect(
      new BlueConicApiAdapter(requester).health(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
