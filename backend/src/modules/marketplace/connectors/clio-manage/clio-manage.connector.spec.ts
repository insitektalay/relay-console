import {
  ClioManageApiAdapter,
  ClioManageApiError,
} from "./clio-manage-api.adapter";
import { CLIO_MANAGE_CONNECTOR_MANIFEST } from "./clio-manage.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Clio Manage connector", () => {
  const credentials = { accessToken: "test-access-token" };

  it("exposes one approval-gated identity-free US authority read", () => {
    expect(CLIO_MANAGE_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://app.clio.com/oauth/authorize",
      tokenUrl: "https://app.clio.com/oauth/token",
      requiredScopes: [],
      supportsRefresh: true,
      pkce: false,
    });
    expect(CLIO_MANAGE_CONNECTOR_MANIFEST.tools).toHaveLength(1);
    expect(CLIO_MANAGE_CONNECTOR_MANIFEST.tools[0]).toMatchObject({
      name: "clioManage.getConnectionAuthority",
      approvalRequired: true,
    });
  });

  it("uses one fixed field-minimized endpoint and strips identity", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        data: {
          id: 123456789,
          enabled: true,
          name: "Privileged Lawyer",
          email: "secret@example.com",
          roles: ["Administrator"],
        },
      }),
    );
    const api = new ClioManageApiAdapter(requester);
    await expect(api.getConnectionAuthority(credentials)).resolves.toEqual({
      authorized: true,
      userEnabled: true,
      apiRegion: "us",
      apiVersion: "4.0.13",
      redactionStatus: "identity-and-legal-practice-data-excluded",
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://app.clio.com/api/v4/users/who_am_i?fields=id,enabled",
    );
    expect(requester.mock.calls[0][1]).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: expect.objectContaining({ "X-API-VERSION": "4.0.13" }),
    });
  });

  it("rejects missing tokens, invalid authority, oversized bodies, and safe-maps errors", async () => {
    const api = new ClioManageApiAdapter(
      jest.fn().mockResolvedValue(json({ data: {} })),
    );
    await expect(api.getConnectionAuthority({ accessToken: "" })).rejects.toBeInstanceOf(
      ClioManageApiError,
    );
    await expect(api.getConnectionAuthority(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
    const forbidden = new ClioManageApiAdapter(
      jest.fn().mockResolvedValue(json({ error: {} }, 403)),
    );
    await expect(forbidden.getConnectionAuthority(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
    });
    const large = new ClioManageApiAdapter(
      jest.fn().mockResolvedValue(new Response("x".repeat(1_000_001))),
    );
    await expect(large.getConnectionAuthority(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
