import { MARKETPLACE_CATALOG } from "../../catalog/marketplace-catalog";
import { FACEBOOK_PAGES_APPROVAL_PROFILES } from "./approval-profiles";
import { FACEBOOK_PAGES_CAPABILITIES } from "./capabilities";
import { FACEBOOK_PAGES_ENDPOINT_FAMILIES } from "./endpoints";

describe("Facebook Pages current pack contract", () => {
  it("exposes exactly the selected-Page capabilities and four actions", () => {
    const page = MARKETPLACE_CATALOG.find(
      (entry) => entry.slug === "facebook-pages",
    )!;
    expect(
      FACEBOOK_PAGES_CAPABILITIES.map((capability) => capability.id),
    ).toEqual([
      "read_selected_page",
      "read_own_posts",
      "draft_posts",
      "publish_posts",
    ]);
    expect(page.credentialRequirements).toEqual([]);
    expect(page.allowedActions.map((action) => action.id)).toEqual([
      "facebook_pages_page_get",
      "facebook_pages_own_posts_list",
      "facebook_pages_post_draft",
    ]);
    expect(page.approvalRequiredActions.map((action) => action.id)).toEqual([
      "facebook_pages_text_post_create",
    ]);
  });

  it("keeps exact permissions, selected-Page endpoints, and four authority presets", () => {
    expect(
      FACEBOOK_PAGES_ENDPOINT_FAMILIES.map((endpoint) => endpoint.id),
    ).toEqual(["oauth", "selected_page", "own_posts", "publish"]);
    expect(
      FACEBOOK_PAGES_APPROVAL_PROFILES.find(
        (profile) => profile.defaultSelected,
      )?.id,
    ).toBe("facebook_pages_approval_required");
    expect(FACEBOOK_PAGES_APPROVAL_PROFILES).toHaveLength(4);
  });
});
