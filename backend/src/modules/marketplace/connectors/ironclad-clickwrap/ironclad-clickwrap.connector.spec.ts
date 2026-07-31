import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  IroncladClickwrapApiAdapter,
  IroncladClickwrapApiError,
} from "./ironclad-clickwrap-api.adapter";
import { IRONCLAD_CLICKWRAP_CONNECTOR_MANIFEST } from "./ironclad-clickwrap.connector";

const credentials = { accessToken: "customer-token", siteId: "123" };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Ironclad Clickwrap Marketplace connector", () => {
  it("registers a customer-owned user-bound bearer token and exact Site", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("ironclad-clickwrap")).toBe(
      IRONCLAD_CLICKWRAP_CONNECTOR_MANIFEST,
    );
    expect(IRONCLAD_CLICKWRAP_CONNECTOR_MANIFEST.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "IRONCLAD_CLICKWRAP_ACCESS_TOKEN",
          secret: true,
          storedIn: "encrypted_secret",
        }),
        expect.objectContaining({
          name: "IRONCLAD_CLICKWRAP_SITE_ID",
          secret: false,
          storedIn: "metadata",
        }),
      ],
    });
  });

  it("exposes only three bounded approval-gated reads", () => {
    expect(IRONCLAD_CLICKWRAP_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      IRONCLAD_CLICKWRAP_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("pins Contract lists to page one, the requested bound and the exact Site", async () => {
    let requestUrl = "";
    let authorization = "";
    const adapter = new IroncladClickwrapApiAdapter(async (url, init) => {
      requestUrl = String(url);
      authorization = new Headers(init.headers).get("authorization") ?? "";
      return response({ data: [] });
    });
    await adapter.listContracts(credentials, { limit: 12 });
    expect(requestUrl).toBe(
      "https://api.pactsafe.com/v1.1/sites/123/contract?page=1&per_page=12&includeArchived=false",
    );
    expect(authorization).toBe("Bearer customer-token");
  });

  it("reduces sensitive Site, Contract and Group fields", async () => {
    const adapter = new IroncladClickwrapApiAdapter(async (url) => {
      if (String(url).endsWith("/sites/123"))
        return response({
          data: {
            id: 123,
            name: "Production terms",
            key: "prod_terms",
            owner: { email: "private@example.com" },
            settings: { secret: "hidden" },
          },
        });
      return response({
        data: [
          {
            id: 5,
            name: "Terms",
            body: "private agreement body",
            signer: { email: "signer@example.com" },
          },
        ],
      });
    });
    const site = await adapter.getSite(credentials);
    const contracts = await adapter.listContracts(credentials);
    const serialized = JSON.stringify({ site, contracts });
    expect(serialized).toContain("Production terms");
    expect(serialized).toContain("Terms");
    for (const forbidden of [
      "private@example.com",
      "hidden",
      "private agreement body",
      "signer@example.com",
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it("rejects invalid Site IDs before any request", async () => {
    const adapter = new IroncladClickwrapApiAdapter(async () => response({}));
    await expect(
      adapter.getSite({ ...credentials, siteId: "../activity" }),
    ).rejects.toMatchObject<Partial<IroncladClickwrapApiError>>({
      code: "provider_validation_error",
    });
  });
});
