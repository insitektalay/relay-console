import { MARKETPLACE_CATALOG } from "../../catalog/marketplace-catalog";
import { INSTAGRAM_BUSINESS_APPROVAL_PROFILES } from "./approval-profiles";
import { INSTAGRAM_BUSINESS_CAPABILITIES } from "./capabilities";
import { INSTAGRAM_BUSINESS_ENDPOINT_FAMILIES } from "./endpoints";

describe("Instagram Business current pack contract", () => {
  it("exposes exactly the bound-account capabilities and three read actions", () => {
    const provider = MARKETPLACE_CATALOG.find(
      (entry) => entry.slug === "instagram-business",
    )!;
    expect(
      INSTAGRAM_BUSINESS_CAPABILITIES.map((capability) => capability.id),
    ).toEqual(["read_bound_account", "read_own_media"]);
    expect(provider.credentialRequirements).toEqual([]);
    expect(provider.allowedActions.map((action) => action.id)).toEqual([
      "instagram_business_account_get",
      "instagram_business_own_media_list",
      "instagram_business_own_media_get",
    ]);
    expect(provider.approvalRequiredActions).toEqual([]);
  });

  it("keeps exact Instagram Login endpoints and read-only authority presets", () => {
    expect(
      INSTAGRAM_BUSINESS_ENDPOINT_FAMILIES.map((endpoint) => endpoint.id),
    ).toEqual(["oauth", "account", "owned_media"]);
    expect(
      INSTAGRAM_BUSINESS_APPROVAL_PROFILES.find(
        (profile) => profile.defaultSelected,
      )?.id,
    ).toBe("instagram_business_read_only");
    expect(INSTAGRAM_BUSINESS_APPROVAL_PROFILES).toHaveLength(2);
  });
});
