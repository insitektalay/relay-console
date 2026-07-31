import { MigrationInterface, QueryRunner } from "typeorm";
import {
  HISTORICAL_DESTRUCTIVE_MIGRATION_TABLES,
  assertHistoricalDestructiveMigrationSafe,
} from "../infrastructure/database/destructive-migration-guard";

export class WipeSeedData1774174000000 implements MigrationInterface {
  name = "WipeSeedData1774174000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertHistoricalDestructiveMigrationSafe(
      queryRunner,
      this.name,
      HISTORICAL_DESTRUCTIVE_MIGRATION_TABLES,
    );

    // TRUNCATE ... CASCADE handles all FK dependencies automatically.
    // This wipes every fake/seed record while keeping users and workspaces.
    await queryRunner.query(`
      TRUNCATE TABLE
        bridge_events,
        report_snapshots,
        budget_usage,
        coaching_notes,
        reviews,
        performance_metrics,
        handover_notes,
        availability_states,
        shift_rules,
        schedules,
        work_logs,
        alerts,
        run_events,
        runs,
        tasks,
        approvals,
        incidents,
        thread_read_states,
        messages,
        threads,
        team_memory_items,
        manager_relationships,
        agents,
        teams,
        departments,
        companies
      CASCADE
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback — re-run seed manually if needed
  }
}
