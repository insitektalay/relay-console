import { SprinklrApiAdapter, SprinklrApiError } from "./sprinklr-api.adapter";
import { SPRINKLR_CONNECTOR_MANIFEST } from "./sprinklr.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Sprinklr connector", () => {
  const credentials = {
    apiKey: "test-key",
    accessToken: "test-token",
    environment: "prod2",
    workspaceId: "66000002",
  };

  it("exposes only one approval-gated governance read", () => {
    expect(SPRINKLR_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "sprinklr.getGovernanceStatus",
    ]);
    expect(SPRINKLR_CONNECTOR_MANIFEST.tools[0].approvalRequired).toBe(true);
  });

  it("uses the exact environment, headers, and workspace binding", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        data: {
          id: 66014640,
          name: "Private User",
          email: "private@example.test",
          customerId: 66000000,
          workspaceId: 66000002,
          type: "PARTNER_ADMIN",
          properties: { private: true },
        },
      }),
    );
    const result = await new SprinklrApiAdapter(requester).getGovernanceStatus(
      credentials,
    );
    expect(result).toEqual({
      userType: "PARTNER_ADMIN",
      primaryWorkspaceConfirmed: true,
      customerBound: true,
      redactionStatus: "identity-and-platform-data-excluded",
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api3.sprinklr.com/prod2/api/v2/me",
    );
    expect(requester.mock.calls[0][1].headers).toMatchObject({
      Authorization: "Bearer test-token",
      Key: "test-key",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /Private|example|66014640|66000000/,
    );
  });

  it("omits an environment path for production", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(
        json({ data: { workspaceId: 66000002, customerId: 1, type: "USER" } }),
      );
    await new SprinklrApiAdapter(requester).health({
      ...credentials,
      environment: "production",
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api3.sprinklr.com/api/v2/me",
    );
  });

  it("rejects unsafe environments and cross-workspace responses", async () => {
    await expect(
      new SprinklrApiAdapter(jest.fn()).health({
        ...credentials,
        environment: "../prod2",
      }),
    ).rejects.toBeInstanceOf(SprinklrApiError);
    await expect(
      new SprinklrApiAdapter(
        jest
          .fn()
          .mockResolvedValue(
            json({ data: { workspaceId: 999, customerId: 1, type: "USER" } }),
          ),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
  });

  it("maps Sprinklr's Developer Over Rate response", async () => {
    await expect(
      new SprinklrApiAdapter(
        jest
          .fn()
          .mockResolvedValue(json({ message: "Developer Over Rate" }, 403)),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 403 });
  });
});
