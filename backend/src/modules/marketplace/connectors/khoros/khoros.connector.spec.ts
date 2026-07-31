import { KhorosApiAdapter, KhorosApiError } from "./khoros-api.adapter";
import { KHOROS_CONNECTOR_MANIFEST } from "./khoros.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Khoros connector", () => {
  const credentials = { accessToken: "test-token", companyId: "123" };

  it("exposes only one approval-gated Marketing authority read", () => {
    expect(KHOROS_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "khoros.getMarketingCompanyAuthority",
    ]);
    expect(KHOROS_CONNECTOR_MANIFEST.tools[0].approvalRequired).toBe(true);
  });

  it("uses the fixed Marketing Me endpoint and redacts identity", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        data: {
          email: "private@example.test",
          userId: "private-user",
          companies: [
            { id: "123", name: "Private Company", environment: "Production" },
            { id: "999", name: "Other Company", environment: "VPC1" },
          ],
        },
        status: { succeeded: true },
      }),
    );
    const result = await new KhorosApiAdapter(requester).getCompanyAuthority(
      credentials,
    );
    expect(result).toEqual({
      companyId: "123",
      environment: "Production",
      redactionStatus: "user-and-company-identity-excluded",
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.spredfast.com/v2/me",
    );
    expect(requester.mock.calls[0][1].headers).toMatchObject({
      Authorization: "Bearer test-token",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /Private|example|999|Other|VPC1/,
    );
  });

  it("rejects unsafe company IDs and cross-company responses", async () => {
    await expect(
      new KhorosApiAdapter(jest.fn()).health({
        ...credentials,
        companyId: "../company",
      }),
    ).rejects.toBeInstanceOf(KhorosApiError);
    await expect(
      new KhorosApiAdapter(
        jest
          .fn()
          .mockResolvedValue(
            json({
              data: { companies: [{ id: "999", environment: "Production" }] },
            }),
          ),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
  });

  it("preserves provider rate limits", async () => {
    await expect(
      new KhorosApiAdapter(jest.fn().mockResolvedValue(json({}, 429))).health(
        credentials,
      ),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
