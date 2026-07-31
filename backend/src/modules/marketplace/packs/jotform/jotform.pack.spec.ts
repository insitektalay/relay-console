import { MARKETPLACE_CATALOG } from "../../catalog/marketplace-catalog";
import { compileJOTFORMHermesPack } from "./jotform.pack";

describe("Jotform canonical Marketplace pack", () => {
  it("installs concrete MCP routing and exact approval guidance", () => {
    const app = MARKETPLACE_CATALOG.find(({ slug }) => slug === "jotform");
    expect(app).toBeDefined();

    const pack = compileJOTFORMHermesPack({
      app: app!,
      selectedCapabilities: ["jotform_read", "jotform_manage"],
      approvalProfileId: "jotform_safe",
      connection: {
        displayName: "Jotform",
        environment: "default",
        authType: "oauth_connector",
      },
      libraryTargetFolder: "marketplace/jotform",
    });
    const content = pack.files.map((file) => file.content).join("\n");

    expect(content).toContain("Use `form_list` and `get_submissions`");
    expect(content).toContain(
      "Use only `create_form`, `edit_form`, or `create_submission`",
    );
    expect(content).toContain(
      "Approval is bound to the final tool name and arguments",
    );
    expect(content).toContain("Never invent REST operation names");
    expect(content).not.toContain("This is a generated draft pack");
  });
});
