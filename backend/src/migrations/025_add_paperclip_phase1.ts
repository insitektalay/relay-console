import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPaperclipPhase1177510000000 implements MigrationInterface {
  name = 'AddPaperclipPhase1177510000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE paperclip_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "displayName" VARCHAR(200) NOT NULL,
        "baseUrl" VARCHAR(500) NOT NULL,
        "companyId" VARCHAR(128) NOT NULL,
        "companyName" VARCHAR(200),
        "authType" VARCHAR(32) NOT NULL DEFAULT 'bearer_token',
        "bearerTokenCiphertext" TEXT NOT NULL,
        "bearerTokenIv" VARCHAR(128) NOT NULL,
        "bearerTokenAuthTag" VARCHAR(128) NOT NULL,
        "bearerTokenKeyVersion" VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'unverified',
        "lastValidatedAt" TIMESTAMPTZ,
        "lastSuccessAt" TIMESTAMPTZ,
        "lastErrorCode" VARCHAR(64),
        "lastErrorMessage" TEXT,
        "createdByUserId" UUID NOT NULL REFERENCES users(id),
        "updatedByUserId" UUID NOT NULL REFERENCES users(id),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE paperclip_thread_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "threadId" UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        "connectionId" UUID NOT NULL REFERENCES paperclip_connections(id) ON DELETE RESTRICT,
        "objectType" VARCHAR(32) NOT NULL,
        "paperclipObjectId" VARCHAR(128) NOT NULL,
        "paperclipObjectRef" VARCHAR(128),
        "createdByUserId" UUID NOT NULL REFERENCES users(id),
        "updatedByUserId" UUID NOT NULL REFERENCES users(id),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("threadId")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX idx_paperclip_connections_workspace
      ON paperclip_connections ("workspaceId")
    `)
    await queryRunner.query(`
      CREATE INDEX idx_paperclip_connections_workspace_status
      ON paperclip_connections ("workspaceId", status)
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_paperclip_connections_workspace_base_company
      ON paperclip_connections ("workspaceId", "baseUrl", "companyId")
    `)
    await queryRunner.query(`
      CREATE INDEX idx_paperclip_thread_links_workspace_connection
      ON paperclip_thread_links ("workspaceId", "connectionId")
    `)
    await queryRunner.query(`
      CREATE INDEX idx_paperclip_thread_links_connection_type
      ON paperclip_thread_links ("connectionId", "objectType")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_paperclip_thread_links_connection_type`,
    )
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_paperclip_thread_links_workspace_connection`,
    )
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_paperclip_connections_workspace_base_company`,
    )
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_paperclip_connections_workspace_status`,
    )
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_paperclip_connections_workspace`,
    )
    await queryRunner.query(`DROP TABLE IF EXISTS paperclip_thread_links`)
    await queryRunner.query(`DROP TABLE IF EXISTS paperclip_connections`)
  }
}
