import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeamRuntimeMessagePublication1786023512080
  implements MigrationInterface
{
  name = "AddTeamRuntimeMessagePublication1786023512080";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "runtimeDispatchId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "runtimeToolCallId" character varying(160)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_messages_runtime_publication_call" ON "messages" ("runtimeDispatchId", "runtimeToolCallId") WHERE "runtimeDispatchId" IS NOT NULL AND "runtimeToolCallId" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_messages_runtime_publication_call"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN IF EXISTS "runtimeToolCallId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN IF EXISTS "runtimeDispatchId"`,
    );
  }
}
