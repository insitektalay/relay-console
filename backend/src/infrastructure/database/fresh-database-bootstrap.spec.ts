import * as path from "path";
import {
  compareMigrationFileNames,
  listOrderedMigrationFileNames,
  shouldRunFreshDatabaseBootstrap,
} from "./fresh-database-bootstrap";

describe("fresh database migration bootstrap", () => {
  it("orders the historical migration files by their intended numeric prefix", () => {
    const migrationDirectory = path.resolve(__dirname, "../../migrations");
    const files = listOrderedMigrationFileNames(migrationDirectory);

    expect(files).toHaveLength(77);
    expect(files[0]).toBe("001_initial_schema.ts");
    expect(files.at(-1)).toBe(
      "075_invalidate_legacy_jwt_sessions.ts",
    );
    expect(files).toEqual([...files].sort(compareMigrationFileNames));
    expect(files.filter((file) => file.startsWith("036_"))).toEqual([
      "036_add_response_presentation.ts",
      "036_add_x_marketplace_oauth.ts",
    ]);
    expect(files.filter((file) => file.startsWith("038_"))).toEqual([
      "038_add_documentation_version_history.ts",
      "038_add_marketplace_oauth_authority.ts",
    ]);
  });

  it("starts or resumes only an unmistakably fresh bootstrap", () => {
    expect(
      shouldRunFreshDatabaseBootstrap({
        hasBootstrapMarker: false,
        hasMigrationsTable: false,
        migrationCount: 0,
        applicationTableCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldRunFreshDatabaseBootstrap({
        hasBootstrapMarker: false,
        hasMigrationsTable: true,
        migrationCount: 0,
        applicationTableCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldRunFreshDatabaseBootstrap({
        hasBootstrapMarker: true,
        hasMigrationsTable: true,
        migrationCount: 12,
        applicationTableCount: 30,
      }),
    ).toBe(true);
  });

  it("never baselines a database that already contains application state", () => {
    expect(
      shouldRunFreshDatabaseBootstrap({
        hasBootstrapMarker: false,
        hasMigrationsTable: true,
        migrationCount: 1,
        applicationTableCount: 0,
      }),
    ).toBe(false);
    expect(
      shouldRunFreshDatabaseBootstrap({
        hasBootstrapMarker: false,
        hasMigrationsTable: false,
        migrationCount: 0,
        applicationTableCount: 1,
      }),
    ).toBe(false);
  });
});
