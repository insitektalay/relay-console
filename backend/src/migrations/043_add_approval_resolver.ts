import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApprovalResolver1760000000043 implements MigrationInterface {
  name = "AddApprovalResolver1760000000043";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE approvals ADD COLUMN IF NOT EXISTS "resolvedByUserId" UUID`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE approvals DROP COLUMN IF EXISTS "resolvedByUserId"`,
    );
  }
}
