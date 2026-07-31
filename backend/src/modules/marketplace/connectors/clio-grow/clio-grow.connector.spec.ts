import {
  ClioGrowApiAdapter,
  ClioGrowApiError,
} from "./clio-grow-api.adapter";
import { CLIO_GROW_CONNECTOR_MANIFEST } from "./clio-grow.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Clio Grow connector", () => {
  const credentials = { accessToken: "test-access-token" };

  it("exposes one approval-gated identity-free US authority read", () => {
    expect(CLIO_GROW_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://auth.api.clio.com/oauth/authorize",
      tokenUrl: "https://auth.api.clio.com/oauth/token",
      requiredScopes: ["grow_user_read"],
      supportsRefresh: true,
      pkce: true,
    });
    expect(CLIO_GROW_CONNECTOR_MANIFEST.tools).toHaveLength(1);
    expect(CLIO_GROW_CONNECTOR_MANIFEST.tools[0]).toMatchObject({
      name: "clioGrow.getConnectionAuthority",
      approvalRequired: true,
    });
  });

  it("uses one fixed endpoint and strips user, firm, and legal-intake data", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        data: {
          id: 123,
          first_name: "Privileged",
          last_name: "Lawyer",
          email: "secret@example.com",
          account: { id: 456, firm_name: "Secret Firm" },
        },
      }),
    );
    const api = new ClioGrowApiAdapter(requester);
    await expect(api.getConnectionAuthority(credentials)).resolves.toEqual({
      authorized: true,
      apiRegion: "us",
      apiVersion: "v2",
      redactionStatus: "identity-firm-and-legal-intake-data-excluded",
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.clio.com/grow/users/who_am_i",
    );
    expect(requester.mock.calls[0][1]).toMatchObject({
      method: "GET",
      redirect: "error",
    });
  });

  it("rejects missing tokens, incomplete authority, oversized bodies, and safe-maps errors", async () => {
    const api = new ClioGrowApiAdapter(
      jest.fn().mockResolvedValue(json({ data: { id: 123, account: {} } })),
    );
    await expect(
      api.getConnectionAuthority({ accessToken: "" }),
    ).rejects.toBeInstanceOf(ClioGrowApiError);
    await expect(api.getConnectionAuthority(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
    const forbidden = new ClioGrowApiAdapter(
      jest.fn().mockResolvedValue(json({ error: {} }, 403)),
    );
    await expect(forbidden.getConnectionAuthority(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
    });
    const large = new ClioGrowApiAdapter(
      jest.fn().mockResolvedValue(new Response("x".repeat(1_000_001))),
    );
    await expect(large.getConnectionAuthority(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
