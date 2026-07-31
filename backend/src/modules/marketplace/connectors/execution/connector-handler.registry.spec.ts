import { MarketplaceConnectorHandlerRegistry } from "./connector-handler.registry";
import type {
  MarketplaceConnectorHandler,
  MarketplaceConnectorReleaseProvider,
} from "./connector-handler";
import type { MarketplaceConnectorManifest } from "../types";

function manifest(
  slug: string,
  functionNames = [`${slug}_read`],
): MarketplaceConnectorManifest {
  return {
    slug,
    name: slug,
    connectorType: "native_clawchat",
    providerDocsUrl: `https://docs.example.com/${slug}`,
    providerWebsiteUrl: `https://example.com/${slug}`,
    capabilities: [],
    auth: {
      type: "api_key",
      credentialSchema: [],
    },
    tools: functionNames.map((functionName) => ({
      name: `${slug}.${functionName}`,
      functionName,
      aliases: [`relay_${functionName}`],
      capability: "read",
      platformCapability: `${slug}_read`,
      action: "read",
      approvalRequired: false,
      description: `Read ${slug}`,
      inputSchema: {},
    })),
    approvalProfiles: [],
    healthChecks: [{ id: "identity", label: "Identity" }],
  };
}

function handler(
  slug: string,
  functionNames = [`${slug}_read`],
): MarketplaceConnectorHandler {
  return {
    id: `native:${slug}`,
    providerSlugs: [slug],
    supportedTools: { [slug]: functionNames },
    healthStrategy: "native-provider-check",
    credentialSchemaIdentity: `manifest:${slug}`,
    errorMapperIdentity: "connector-safe-error-v1",
    execute: jest.fn(),
  };
}

const eligible = (slug: string): MarketplaceConnectorReleaseProvider => ({
  slug,
  connectEligible: true,
});

describe("MarketplaceConnectorHandlerRegistry", () => {
  it("resolves every canonical tool name and alias to one handler", () => {
    const registry = new MarketplaceConnectorHandlerRegistry(
      [manifest("example")],
      [handler("example")],
      [eligible("example")],
    );

    expect(registry.resolve("example", "example_read")).toMatchObject({
      handler: { id: "native:example" },
      tool: { functionName: "example_read" },
    });
    expect(registry.resolve("example", "relay_example_read")).toMatchObject({
      handler: { id: "native:example" },
    });
    expect(registry.coverage()).toEqual([
      {
        providerSlug: "example",
        handlerId: "native:example",
        healthStrategy: "native-provider-check",
        supportedTools: ["example_read"],
      },
    ]);
  });

  it("rejects duplicate provider and tool ownership", () => {
    expect(
      () =>
        new MarketplaceConnectorHandlerRegistry(
          [manifest("example")],
          [handler("example"), handler("example")],
        ),
    ).toThrow(/both own example/);

    const duplicateAlias = manifest("example", [
      "example_first",
      "example_second",
    ]);
    duplicateAlias.tools[1].aliases = ["relay_example_first"];
    expect(
      () =>
        new MarketplaceConnectorHandlerRegistry(
          [duplicateAlias],
          [handler("example", ["example_first", "example_second"])],
        ),
    ).toThrow(/both own example\/relay_example_first/);
  });

  it("rejects unknown providers and tool declaration drift", () => {
    expect(
      () =>
        new MarketplaceConnectorHandlerRegistry(
          [manifest("known")],
          [handler("unknown")],
        ),
    ).toThrow(/unknown manifest unknown/);
    expect(
      () =>
        new MarketplaceConnectorHandlerRegistry(
          [manifest("example")],
          [handler("example", ["missing_tool"])],
        ),
    ).toThrow(/does not own advertised tool example\/example_read/);
  });

  it("rejects connect-eligible providers without a handler or health strategy", () => {
    expect(
      () =>
        new MarketplaceConnectorHandlerRegistry(
          [manifest("example")],
          [],
          [eligible("example")],
        ),
    ).toThrow(/example has no connector handler/);

    const noHealth = handler("example");
    noHealth.healthStrategy = null;
    expect(
      () =>
        new MarketplaceConnectorHandlerRegistry(
          [manifest("example")],
          [noHealth],
          [eligible("example")],
        ),
    ).toThrow(/example has no health strategy/);
  });
});
