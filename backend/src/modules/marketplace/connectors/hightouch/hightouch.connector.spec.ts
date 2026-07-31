import { HightouchApiAdapter } from "./hightouch-api.adapter";
import { HIGHTOUCH_CONNECTOR_MANIFEST } from "./hightouch.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Hightouch connector", () => {
  const credentials = { apiKey: "test-api-key" };

  it("exposes one approved model-readiness aggregate", () => {
    expect(HIGHTOUCH_CONNECTOR_MANIFEST.slug).toBe("hightouch");
    expect(HIGHTOUCH_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "hightouch.getModelReadinessSummary",
    ]);
    expect(HIGHTOUCH_CONNECTOR_MANIFEST.tools[0].approvalRequired).toBe(true);
  });

  it("uses the fixed models endpoint and returns only a count", async () => {
    const requester = jest.fn().mockResolvedValue(
      json([
        {
          id: "private-id",
          name: "VIP Customers",
          queryType: "sql",
          query: "select email from customers",
          sourceId: "source-id",
        },
        { id: "other-id", name: "Recent Buyers", audience: true },
      ]),
    );
    const result = await new HightouchApiAdapter(
      requester,
    ).getModelReadinessSummary(credentials);
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.hightouch.com/api/v1/models",
    );
    expect(requester.mock.calls[0][1].headers).toMatchObject({
      Authorization: "Bearer test-api-key",
    });
    expect(result).toEqual({
      modelCount: 2,
      redactionStatus:
        "model-identity-definition-query-source-destination-sync-run-and-customer-data-excluded",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private-id|VIP Customers|select email|customers|source-id|other-id|Recent Buyers|test-api-key/,
    );
  });

  it("rejects malformed keys before network access", async () => {
    const requester = jest.fn();
    await expect(
      new HightouchApiAdapter(requester).health({ apiKey: "bad\nkey" }),
    ).rejects.toMatchObject({ code: "credential_missing", statusCode: 401 });
    expect(requester).not.toHaveBeenCalled();
  });

  it("preserves provider rate limits", async () => {
    await expect(
      new HightouchApiAdapter(
        jest.fn().mockResolvedValue(json({}, 429)),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
