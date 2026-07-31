import { MigrationInterface, QueryRunner } from "typeorm";

export class RestoreOpenClawRuntimeTimeout0310000000000
  implements MigrationInterface
{
  name = "RestoreOpenClawRuntimeTimeout0310000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE runtime_bindings
      SET "configMetadata" = jsonb_set(
        "configMetadata",
        '{timeoutMs}',
        '1200000'::jsonb,
        true
      )
      WHERE "runtimeType" = 'openclaw'
        AND "adapterKind" = 'bridge_ws'
        AND "configMetadata"->>'timeoutMs' ~ '^[0-9]+$'
        AND ("configMetadata"->>'timeoutMs')::integer = 90000
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE runtime_bindings
      SET "configMetadata" = jsonb_set(
        "configMetadata",
        '{timeoutMs}',
        '90000'::jsonb,
        true
      )
      WHERE "runtimeType" = 'openclaw'
        AND "adapterKind" = 'bridge_ws'
        AND "configMetadata"->>'timeoutMs' ~ '^[0-9]+$'
        AND ("configMetadata"->>'timeoutMs')::integer = 1200000
    `);
  }
}
