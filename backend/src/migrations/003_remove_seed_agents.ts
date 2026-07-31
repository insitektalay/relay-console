import { MigrationInterface, QueryRunner } from "typeorm";
import { assertHistoricalDestructiveMigrationSafe } from "../infrastructure/database/destructive-migration-guard";

export class RemoveSeedAgents1774172000000 implements MigrationInterface {
  name = "RemoveSeedAgents1774172000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertHistoricalDestructiveMigrationSafe(queryRunner, this.name, [
      "agents",
    ]);

    // Remove demo/seed agents — real agents will be synced from OpenClaw via bridge API
    await queryRunner.query(`
      DELETE FROM agents
      WHERE name IN ('Aria Finance','Bravo Ops','Charlie Support','Delta Data','Echo Infra','Foxtrot Legal',
                     'Atlas','Ember','Nexus','Titan','Forge','Cipher','Bolt','Nova','Scout','Iris','Sage','Echo')
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback — seed data can be re-run manually
  }
}
