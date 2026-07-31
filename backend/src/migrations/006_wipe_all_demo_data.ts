import { MigrationInterface, QueryRunner } from "typeorm";
import {
  HISTORICAL_DESTRUCTIVE_MIGRATION_TABLES,
  assertHistoricalDestructiveMigrationSafe,
} from "../infrastructure/database/destructive-migration-guard";

export class WipeAllDemoData1774176000000 implements MigrationInterface {
  name = "WipeAllDemoData1774176000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertHistoricalDestructiveMigrationSafe(
      queryRunner,
      this.name,
      HISTORICAL_DESTRUCTIVE_MIGRATION_TABLES,
    );

    // Delete fake/demo agents, threads, tasks and all dependent data.
    // Deleting agents CASCADE removes all related data automatically.
    await queryRunner.query(`DELETE FROM agents`);
    await queryRunner.query(`DELETE FROM threads`);
    await queryRunner.query(`DELETE FROM tasks`);
    await queryRunner.query(`DELETE FROM approvals`);
    await queryRunner.query(`DELETE FROM incidents`);
    await queryRunner.query(`DELETE FROM alerts`);
    await queryRunner.query(`DELETE FROM teams`);
    await queryRunner.query(`DELETE FROM departments`);
    await queryRunner.query(`DELETE FROM companies`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback
  }
}
