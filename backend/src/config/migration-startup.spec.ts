import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const backendRoot = resolve(__dirname, "../..");
const srcRoot = resolve(backendRoot, "src");

function readSource(relativePath: string) {
  return readFileSync(resolve(srcRoot, relativePath), "utf8");
}

describe("Railway migration startup contract", () => {
  it("audits production secrets before migrations and app bootstrap", () => {
    const backendPackage = JSON.parse(
      readFileSync(resolve(backendRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const railwayConfig = JSON.parse(
      readFileSync(resolve(backendRoot, "railway.json"), "utf8"),
    ) as { deploy: { startCommand: string } };
    const mainSource = readSource("main.ts");
    const migrationRunnerSource = readSource("scripts/run-migrations.ts");
    const dockerfile = readFileSync(resolve(backendRoot, "Dockerfile"), "utf8");
    const secretAuditSource = readFileSync(
      resolve(backendRoot, "security/production-secret-audit.mjs"),
      "utf8",
    );
    const secretPolicy = JSON.parse(
      readFileSync(
        resolve(backendRoot, "security/production-secret-policy.json"),
        "utf8",
      ),
    ) as { lifecycle: { registryVariable: string } };

    expect(railwayConfig.deploy.startCommand).toBe(
      "pnpm run railway:start:prod",
    );
    expect(backendPackage.scripts["security:audit:production"]).toBe(
      "node security/production-secret-audit.mjs",
    );
    expect(backendPackage.scripts["railway:start:prod"]).toBe(
      "node security/railway-template-bootstrap.mjs",
    );
    expect(dockerfile).toContain(
      "COPY --chown=node:node --from=base /app/security ./security",
    );
    expect(secretAuditSource).toContain("auditProductionSecrets");
    expect(
      readFileSync(
        resolve(backendRoot, "security/railway-template-bootstrap.mjs"),
        "utf8",
      ),
    ).toContain('"dist/scripts/run-migrations.js"');
    expect(secretPolicy.lifecycle.registryVariable).toBe(
      "RELAY_SECRET_LIFECYCLE_JSON",
    );
    expect(migrationRunnerSource).toContain("assertProductionEnvironment()");
    expect(migrationRunnerSource).toContain(
      "bootstrapFreshDatabase(dataSource)",
    );
    expect(migrationRunnerSource).toMatch(/dataSource\.runMigrations\(\)/);
    expect(mainSource).not.toMatch(/runMigrations\(/);
    expect(mainSource).not.toContain("Migrations complete");
  });

  it("documents historical duplicate migration prefixes without renaming applied migrations", () => {
    const migrationFiles = readdirSync(resolve(srcRoot, "migrations")).filter(
      (entry) => /^\d+_.*\.ts$/.test(entry),
    );
    const prefixCounts = migrationFiles.reduce<Record<string, number>>(
      (counts, fileName) => {
        const prefix = fileName.split("_")[0];
        counts[prefix] = (counts[prefix] ?? 0) + 1;
        return counts;
      },
      {},
    );
    const duplicatePrefixes = Object.entries(prefixCounts)
      .filter(([, count]) => count > 1)
      .map(([prefix]) => prefix)
      .sort();
    const migrationReadme = readSource("migrations/README.md");

    expect(duplicatePrefixes).toEqual(["036", "038"]);
    expect(migrationReadme).toContain(
      "Historical duplicate filename prefixes `036` and `038`",
    );
    expect(migrationReadme).toContain(
      "Do not rename applied migration classes",
    );
    expect(migrationReadme).toMatch(
      /New\s+migrations must use the next unused/,
    );
  });

  it("keeps the current pending security migrations TypeORM timestamp-compatible", () => {
    for (const fileName of [
      "070_add_bridge_credential_replay_state.ts",
      "071_add_billing_event_claim_lease.ts",
      "072_stream_relay_attachment_content.ts",
      "073_minimize_auth_audit_data.ts",
      "074_quarantine_unsafe_artifact_urls.ts",
    ]) {
      const source = readSource(`migrations/${fileName}`);
      expect(source).toMatch(/name = "[A-Za-z0-9]+178518[0-9]{7}";/);
    }
  });

  it("guards historical destructive migrations before they can mutate production-like data", () => {
    const destructiveMigrationFiles = [
      "003_remove_seed_agents.ts",
      "004_wipe_seed_data.ts",
      "005_force_wipe_seed_data.ts",
      "006_wipe_all_demo_data.ts",
      "007_final_wipe_fake_agents.ts",
      "008_wipe_bridge_injected_agents.ts",
    ];
    const guardSource = readSource(
      "infrastructure/database/destructive-migration-guard.ts",
    );

    expect(guardSource).toContain("shouldAssertProductionEnvironment");
    expect(guardSource).toContain("non-empty tables");

    for (const fileName of destructiveMigrationFiles) {
      const migrationSource = readSource(`migrations/${fileName}`);
      expect(migrationSource).toContain(
        "assertHistoricalDestructiveMigrationSafe",
      );
      expect(migrationSource).toContain("this.name");
    }
  });
});
