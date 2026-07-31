import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Security boundary migration. This intentionally cannot restore
 * `current_backend`: rollback must not reactivate Railway filesystem access.
 */
export class RetireCurrentBackendMarketplaceSources1785179000067 implements MigrationInterface {
  name = "RetireCurrentBackendMarketplaceSources1785179000067";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH unsafe_apps AS (
        SELECT "workspaceId", slug
        FROM linked_applications
        WHERE COALESCE(
          metadata ->> 'sourceHostType',
          "apiStyleMetadata" ->> 'sourceHostType',
          "frameworkMetadata" ->> 'sourceHostType'
        ) = 'current_backend'
      )
      UPDATE marketplace_pack_sources AS source
      SET
        "filePath" = NULL,
        metadata = (
          source.metadata
          - 'filePath'
          - 'repoPath'
          - 'sourcePath'
          - 'absolutePath'
        ) || jsonb_build_object(
          'currentBackendSourceRetiredAt',
          now()
        ),
        "updatedAt" = now()
      FROM unsafe_apps
      WHERE source."workspaceId" = unsafe_apps."workspaceId"
        AND source."appSlug" = unsafe_apps.slug;

      WITH unsafe_apps AS (
        SELECT "workspaceId", slug
        FROM linked_applications
        WHERE COALESCE(
          metadata ->> 'sourceHostType',
          "apiStyleMetadata" ->> 'sourceHostType',
          "frameworkMetadata" ->> 'sourceHostType'
        ) = 'current_backend'
      )
      UPDATE marketplace_generated_packs AS pack
      SET
        "publicationStatus" = 'blocked',
        "reviewStatus" = 'needs_sources',
        "sourceUrls" = '[]'::jsonb,
        "generatedPack" = '{}'::jsonb,
        metadata = jsonb_build_object(
          'currentBackendSourceRetiredAt',
          now(),
          'sourceMigrationRequired',
          true
        ),
        "updatedAt" = now()
      FROM unsafe_apps
      WHERE pack."workspaceId" = unsafe_apps."workspaceId"
        AND pack."appSlug" = unsafe_apps.slug;

      UPDATE linked_applications
      SET
        "repoPath" = 'migration-required://paired-runtime-host',
        "repoKey" = NULL,
        "currentGitCommit" = NULL,
        "dirtyState" = false,
        "lastScannedAt" = NULL,
        "agentOperableStatus" = 'source_host_migration_required',
        "documentationPackStatus" = 'blocked',
        metadata = (
          metadata
          - 'bridgeDeviceId'
          - 'sourceHostId'
          - 'openApiSpecPath'
          - 'repoPath'
          - 'runtimeProfile'
          - 'sourceConfig'
        ) || jsonb_build_object(
          'sourceHostType',
          'retired_current_backend',
          'sourceHostLabel',
          'Migration required',
          'sourceMigrationRequired',
          true,
          'currentBackendSourceRetiredAt',
          now()
        ),
        "apiStyleMetadata" = (
          "apiStyleMetadata"
          - 'bridgeDeviceId'
          - 'sourceHostId'
          - 'openApiSpecPath'
          - 'repoPath'
          - 'runtimeProfile'
          - 'sourceConfig'
        ) || jsonb_build_object(
          'sourceHostType',
          'retired_current_backend',
          'sourceMigrationRequired',
          true
        ),
        "frameworkMetadata" = (
          "frameworkMetadata"
          - 'bridgeDeviceId'
          - 'sourceHostId'
          - 'openApiSpecPath'
          - 'repoPath'
          - 'runtimeProfile'
          - 'sourceConfig'
        ) || jsonb_build_object(
          'sourceHostType',
          'retired_current_backend',
          'sourceMigrationRequired',
          true
        ),
        "updatedAt" = now()
      WHERE COALESCE(
        metadata ->> 'sourceHostType',
        "apiStyleMetadata" ->> 'sourceHostType',
        "frameworkMetadata" ->> 'sourceHostType'
      ) = 'current_backend';
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Forward-only by design: restoring `current_backend` would recreate the
    // production filesystem security vulnerability retired by this migration.
  }
}
