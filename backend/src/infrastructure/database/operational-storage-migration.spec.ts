import { readFileSync } from "fs";
import { join } from "path";

describe("bounded operational storage migration", () => {
  const source = readFileSync(
    join(__dirname, "../../migrations/078_bound_operational_storage.ts"),
    "utf8",
  );

  it("globalizes standard packs while preserving workspace custom packs", () => {
    expect(source).toContain("metadata ->> 'source' = 'pack_factory'");
    expect(source).toContain("uq_marketplace_generated_packs_global_app");
    expect(source).toContain('WHERE "workspaceId" IS NULL');
    expect(source).toContain("uq_marketplace_generated_packs_workspace_app");
    expect(source).toContain('WHERE "workspaceId" IS NOT NULL');
  });

  it("materializes managed documents before deleting their legacy copies", () => {
    const materialize = source.indexOf("INSERT INTO managed_agent_documents");
    const removeLegacy = source.indexOf("DELETE FROM relay_sync_objects");
    expect(materialize).toBeGreaterThan(-1);
    expect(removeLegacy).toBeGreaterThan(materialize);
  });

  it("bounds operational history without deleting messages", () => {
    expect(source).toContain("DELETE FROM runtime_dispatches");
    expect(source).toContain("DELETE FROM audit_logs");
    expect(source).toContain("DELETE FROM relay_workspace_changes");
    expect(source).not.toMatch(/DELETE\s+FROM\s+messages/i);
    expect(source).not.toMatch(/TRUNCATE[\s\S]*messages/i);
  });
});
