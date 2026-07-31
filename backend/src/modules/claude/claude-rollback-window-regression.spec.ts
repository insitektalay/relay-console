import { readFileSync } from "fs";
import { resolve } from "path";

const repoRoot = resolve(__dirname, "../../../..");

function readRepoFile(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("Claude rollback window audit", () => {
  it("records that the rollback window remains open until parity is proven", () => {
    const audit = readRepoFile(
      "docs/claude-rollback-window-audit-2026-06-19.md",
    );

    expect(audit).toContain("Rollback window remains open");
    expect(audit).toContain("No removal was performed");
    expect(audit).toContain("production-like Claude dispatch creation");
    expect(audit).toContain("stability window");
    expect(audit).toContain("real rollback exercise");
    expect(audit).toContain("legacy `claude_*` tables");
    expect(audit).toContain("`claudeBinding`");
    expect(audit).toContain("Claude-specific callback-only semantics");
  });

  it("links the audit from the unified runtime handoff", () => {
    const handoff = readRepoFile("docs/UNIFIED_RUNTIME_HANDOFF.md");

    expect(handoff).toContain("Rollback-Window Closure Criteria");
    expect(handoff).toContain("LOOP-0030 audit status as of 2026-06-19");
    expect(handoff).toContain("claude-rollback-window-audit-2026-06-19.md");
    expect(handoff).toContain("not closed");
  });

  it("keeps compatibility code explicit while the window is open", () => {
    expect(readRepoFile("backend/src/modules/agent/dto/agent.dto.ts")).toContain(
      "claudeBinding",
    );
    expect(readRepoFile("backend/src/entities/agent.entity.ts")).toContain(
      "claudeBinding?: ClaudeAgentBindingEntity | null",
    );
    expect(
      readRepoFile("backend/src/modules/claude/claude-code-runtime.adapter.ts"),
    ).toContain("claude_bridge_callbacks");
    expect(readRepoFile("backend/src/modules/claude/claude.service.ts")).toContain(
      "backfillLegacyClaudeStateToRuntimeDomain",
    );
    expect(readRepoFile("backend/src/modules/bridge/bridge.controller.ts")).toContain(
      "attachPostedMessage",
    );
  });
});
