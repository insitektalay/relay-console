import { ForbiddenException } from "@nestjs/common";
import {
  MARKETPLACE_RELEASE_MANIFEST,
  applyMarketplaceReleaseMetadata,
  assertMarketplaceReleaseConnectEligible,
  resolveMarketplaceReleaseDecision,
} from "./marketplace-release-policy";

describe("Marketplace release policy", () => {
  const externalApp = {
    slug: "unlisted-provider",
    name: "Unlisted Provider",
    sourceType: "external_provider" as const,
  };

  it("loads the frozen 406-provider bounded Connect cohort and fails closed for unlisted providers", () => {
    expect(MARKETPLACE_RELEASE_MANIFEST.schemaVersion).toBe(
      "relay.marketplace-release.v1",
    );
    expect(MARKETPLACE_RELEASE_MANIFEST.freeze.status).toBe("frozen");
    expect(MARKETPLACE_RELEASE_MANIFEST.providers).toHaveLength(406);
    expect(
      MARKETPLACE_RELEASE_MANIFEST.providers.every(
        (provider) =>
          provider.state === "customer_credential_required" &&
          provider.connectEligible === true &&
          provider.liveVerified === false,
      ),
    ).toBe(true);
    expect(resolveMarketplaceReleaseDecision(externalApp)).toEqual(
      expect.objectContaining({
        state: "coming_later",
        label: "Coming later",
        connectEligible: false,
        liveVerified: false,
      }),
    );
  });

  it("keeps researched providers visible as preview metadata without claiming usability", () => {
    const app = applyMarketplaceReleaseMetadata({
      ...externalApp,
      availability: "available",
    } as any);
    expect(app.availability).toBe("preview");
    expect(app.release?.connectEligible).toBe(false);
    expect(app.sourceMetadata?.marketplaceRelease).toEqual(app.release);
  });

  it("rejects direct external-provider connection attempts before credentials are read", () => {
    expect(() => assertMarketplaceReleaseConnectEligible(externalApp)).toThrow(
      ForbiddenException,
    );
    expect(() => assertMarketplaceReleaseConnectEligible(externalApp)).toThrow(
      /Coming later/,
    );
  });

  it("allows cohort members to Connect without falsely claiming Relay verification", () => {
    expect(
      assertMarketplaceReleaseConnectEligible({
        slug: MARKETPLACE_RELEASE_MANIFEST.providers[0].slug,
        name: "Cohort provider",
        sourceType: "external_provider",
      }),
    ).toEqual(
      expect.objectContaining({
        connectEligible: true,
        liveVerified: false,
        verificationLevel: "documentation_reviewed",
      }),
    );
  });

  it("keeps configure-only providers outside the launch cohort", () => {
    const app = applyMarketplaceReleaseMetadata({
      slug: "birdeye",
      name: "Birdeye",
      sourceType: "external_provider",
      availability: "preview",
      agentUseSummary: "Birdeye cannot yet be connected through Relay.",
      capabilities: [],
      allowedActions: [],
      approvalRequiredActions: [],
      runtimeSupport: [
        { format: "openclaw", installSupport: "unsupported", description: "" },
      ],
    } as any);

    expect(app.availability).toBe("preview");
    expect(app.release?.connectEligible).toBe(false);
    expect(app.sourceMetadata?.marketplaceLaunchMode).toBe("bounded_connector");
  });

  it("does not apply the external provider cohort to customer-managed local apps", () => {
    expect(
      resolveMarketplaceReleaseDecision({
        slug: "my-local-app",
        sourceType: "local_repo",
      }),
    ).toEqual(
      expect.objectContaining({
        state: "available",
        connectEligible: true,
        liveVerified: true,
      }),
    );
  });
});
