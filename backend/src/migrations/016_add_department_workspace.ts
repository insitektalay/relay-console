import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDepartmentWorkspace1774400000000 implements MigrationInterface {
  name = 'AddDepartmentWorkspace1774400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "departments"
      ADD COLUMN IF NOT EXISTS "workspaceId" character varying
    `)
    // Backfill workspaceId from the related company (companyId is UUID, can't be empty string)
    await queryRunner.query(`
      UPDATE "departments" d
      SET "workspaceId" = c."workspaceId"
      FROM "companies" c
      WHERE d."companyId" = c.id
        AND d."workspaceId" IS NULL
        AND d."companyId" IS NOT NULL
    `)
    // For orphaned departments (null companyId), assign to the first workspace found
    await queryRunner.query(`
      UPDATE "departments" d
      SET "workspaceId" = (SELECT id FROM "workspaces" ORDER BY "createdAt" ASC LIMIT 1)
      WHERE d."workspaceId" IS NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "departments"
      DROP COLUMN IF EXISTS "workspaceId"
    `)
  }
}
