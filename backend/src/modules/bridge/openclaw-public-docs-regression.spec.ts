import * as fs from "fs";
import * as path from "path";

const repoRoot = path.resolve(__dirname, "../../../..");
const docs = [
  path.join(repoRoot, "docs/openclaw-bridge-beta-preview.md"),
  path.join(repoRoot, "docs/openclaw-clawchat-extension-install-prompt.md"),
];

describe("OpenClaw public bridge docs", () => {
  it("document the Railway bridge contract without loopback backend targets", () => {
    const content = docs
      .map((docPath) => fs.readFileSync(docPath, "utf8"))
      .join("\n");

    expect(content).toContain("/api/v1/bridge/enroll");
    expect(content).toContain("/api/v1/bridge/device/auth");
    expect(content).toContain("subscribe_bridge_control");
    expect(content).toContain("register_bridge_agent");
    expect(content).toContain("agent.dispatch");
    expect(content).toContain("Railway");
    expect(content).not.toMatch(/http:\/\/localhost|http:\/\/127\.0\.0\.1|ws:\/\/localhost|ws:\/\/127\.0\.0\.1/);
  });
});
