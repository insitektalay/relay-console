import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveHermesHostPathAuthority1785182600068
  implements MigrationInterface
{
  name = "RemoveHermesHostPathAuthority1785182600068";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "runtime_bindings"
      SET
        "workspaceRoot" = NULL,
        "configMetadata" =
          COALESCE("configMetadata", '{}'::jsonb)
          - 'workspaceRoot'
          - 'repoPath'
          - 'cwd',
        "updatedAt" = now()
      WHERE "runtimeType" = 'hermes'
        AND (
          "workspaceRoot" IS NOT NULL
          OR COALESCE("configMetadata", '{}'::jsonb)
            ?| ARRAY['workspaceRoot', 'repoPath', 'cwd']
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "runtime_bindings"
      ADD CONSTRAINT "CHK_runtime_bindings_no_hermes_host_path"
      CHECK (
        "runtimeType" <> 'hermes'
        OR (
          "workspaceRoot" IS NULL
          AND NOT (
            COALESCE("configMetadata", '{}'::jsonb)
            ?| ARRAY['workspaceRoot', 'repoPath', 'cwd']
          )
        )
      )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Forward-only security boundary. Restoring tenant-selected host paths is
    // not an acceptable rollback.
  }
}
