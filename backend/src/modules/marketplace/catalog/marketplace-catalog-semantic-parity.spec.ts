import catalogDocument = require("./generated-provider-catalog.json");
import releaseManifest = require("../marketplace-release-manifest.json");
import { MarketplaceConnectorRegistry } from "../connectors/connector-registry";
import {
  GENERATED_MARKETPLACE_PROVIDER_IDENTITIES,
  GENERATED_MARKETPLACE_PROVIDER_SOURCE_SHA256,
  type MarketplaceProviderSlug,
} from "./generated-provider-identities";
import { GENERATED_MARKETPLACE_CATALOG } from "./generated-marketplace-catalog";
import { MARKETPLACE_CATALOG } from "./marketplace-catalog";

describe("Marketplace canonical semantic parity", () => {
  const catalogBySlug = new Map(
    GENERATED_MARKETPLACE_CATALOG.map((provider) => [provider.slug, provider]),
  );
  const manifestBySlug = new Map(
    catalogDocument.manifests.map((provider) => [provider.slug, provider]),
  );

  it("uses the generated catalog directly without a legacy runtime overlay", () => {
    expect(MARKETPLACE_CATALOG).toBe(GENERATED_MARKETPLACE_CATALOG);
  });

  it("keeps every generated provider identity aligned with the runtime catalog", () => {
    expect(catalogDocument.sourceSHA256).toBe(
      GENERATED_MARKETPLACE_PROVIDER_SOURCE_SHA256,
    );
    expect(catalogBySlug.size).toBe(catalogDocument.manifestCount);
    expect(Object.keys(GENERATED_MARKETPLACE_PROVIDER_IDENTITIES)).toHaveLength(
      catalogDocument.manifestCount,
    );

    for (const [slug, identity] of Object.entries(
      GENERATED_MARKETPLACE_PROVIDER_IDENTITIES,
    )) {
      const provider = catalogBySlug.get(slug);
      const manifest = manifestBySlug.get(slug);
      expect(provider).toBeDefined();
      expect(manifest).toBeDefined();
      const authentication = provider?.sourceMetadata?.authentication as
        | { model?: string; relayOwned?: boolean }
        | undefined;
      expect(authentication?.model).toBe(identity.authModel);
      expect(authentication?.relayOwned === true).toBe(identity.relayOwned);
      expect(provider?.capabilities.map(({ id }) => id)).toEqual(
        identity.capabilityIds,
      );
      expect(
        [
          ...(provider?.allowedActions ?? []),
          ...(provider?.approvalRequiredActions ?? []),
        ].map(({ id }) => id),
      ).toEqual(identity.executableActionIds);
      expect(provider?.blockedActions.map(({ id }) => id)).toEqual(
        identity.blockedActionIds,
      );
      expect(
        provider?.runtimeSupport
          .filter(({ installSupport }) => installSupport !== "unsupported")
          .map(({ format }) => format),
      ).toEqual(identity.runtimeFormats);

      const credentialRequirements =
        manifest?.connection?.credentialRequirements ?? [];
      if (
        credentialRequirements.every(
          (credential) =>
            credential &&
            typeof credential === "object" &&
            "name" in credential,
        )
      ) {
        expect(
          provider?.credentialRequirements.map(({ name }) => name),
        ).toEqual(identity.credentialFieldNames);
      }
    }
  });

  it("publishes OAuth-first Jotform with a bounded legacy API-key region selector", () => {
    const jotform = catalogBySlug.get("jotform");
    const region = jotform?.credentialRequirements.find(
      (credential) => credential.name === "JOTFORM_API_REGION",
    );

    expect(jotform?.connectionTypes).toEqual([
      "oauth_connector",
      "customer_owned_api_key",
    ]);
    expect(region).toMatchObject({
      inputType: "select",
      defaultValue: "standard",
      options: [
        { value: "standard", label: "Standard" },
        { value: "eu", label: "EU" },
        { value: "hipaa", label: "HIPAA" },
      ],
    });
  });

  it("requires one backend connector for every Connect-eligible provider", () => {
    const connectorRegistry = new MarketplaceConnectorRegistry();
    const connectEligible = releaseManifest.providers.filter(
      (provider) => provider.connectEligible,
    );
    expect(connectEligible).toHaveLength(406);

    for (const releaseProvider of connectEligible) {
      const slug = releaseProvider.slug as MarketplaceProviderSlug;
      const identity = GENERATED_MARKETPLACE_PROVIDER_IDENTITIES[slug];
      const connector = connectorRegistry.get(slug);
      expect(identity).toBeDefined();
      expect(identity.relayOwned).toBe(false);
      expect(identity.credentialFieldNames.length).toBeGreaterThan(0);
      expect(identity.executableActionIds.length).toBeGreaterThan(0);
      expect(identity.runtimeFormats.length).toBeGreaterThan(0);
      expect(connector).not.toBeNull();
      expect(connector?.tools.length).toBeGreaterThan(0);
    }
  });
});
