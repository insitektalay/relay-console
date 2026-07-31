import * as fs from "node:fs";
import * as path from "node:path";

describe("Claude runtime host-path boundary", () => {
  const modulesRoot = path.resolve(__dirname, "..");

  it("does not send cwd or persisted repo paths through structured prompts", () => {
    const files = [
      path.join(modulesRoot, "claude", "claude-cli.service.ts"),
      path.join(
        modulesRoot,
        "agent-documentation",
        "services",
        "agent-documentation-install.service.ts",
      ),
      path.join(
        modulesRoot,
        "agent-documentation",
        "services",
        "documentation-apply.service.ts",
      ),
      path.join(
        modulesRoot,
        "agent-documentation",
        "services",
        "linked-application.service.ts",
      ),
      path.join(
        modulesRoot,
        "agent-documentation",
        "services",
        "documentation-compiler.service.ts",
      ),
      path.join(
        modulesRoot,
        "agent-documentation",
        "services",
        "documentation-pack-sync.service.ts",
      ),
      path.join(
        modulesRoot,
        "agent-documentation",
        "services",
        "documentation-drift.service.ts",
      ),
    ];
    const combined = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");

    expect(combined).not.toMatch(/\bcwd\s*:/);
    expect(
      fs.readFileSync(
        path.join(modulesRoot, "claude", "claude-cli.service.ts"),
        "utf8",
      ),
    ).not.toMatch(/\bcwd\??\s*:/);
  });
});
