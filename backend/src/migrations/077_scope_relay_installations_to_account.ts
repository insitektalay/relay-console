import { MigrationInterface, QueryRunner } from "typeorm";

export class ScopeRelayInstallationsToAccount1785270600077
  implements MigrationInterface
{
  name = "ScopeRelayInstallationsToAccount1785270600077";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE constraint_name text;
      BEGIN
        SELECT con.conname
        INTO constraint_name
        FROM pg_constraint con
        WHERE con.conrelid = 'relay_client_installations'::regclass
          AND con.contype = 'u'
          AND pg_get_constraintdef(con.oid) =
            'UNIQUE ("deploymentId", "installationPublicId")'
        LIMIT 1;

        IF constraint_name IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE relay_client_installations DROP CONSTRAINT %I',
            constraint_name
          );
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      ALTER TABLE relay_client_installations
      ADD CONSTRAINT uq_relay_client_installations_account_identity
      UNIQUE ("deploymentId", "userId", "installationPublicId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE relay_client_installations
      DROP CONSTRAINT IF EXISTS uq_relay_client_installations_account_identity
    `);
    await queryRunner.query(`
      ALTER TABLE relay_client_installations
      ADD CONSTRAINT uq_relay_client_installations_deployment_identity
      UNIQUE ("deploymentId", "installationPublicId")
    `);
  }
}
