import { MigrationInterface, QueryRunner } from "typeorm";
import {
  HISTORICAL_DESTRUCTIVE_MIGRATION_TABLES,
  assertHistoricalDestructiveMigrationSafe,
} from "../infrastructure/database/destructive-migration-guard";

export class FinalWipeFakeAgents1774177000000 implements MigrationInterface {
  name = "FinalWipeFakeAgents1774177000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertHistoricalDestructiveMigrationSafe(
      queryRunner,
      this.name,
      HISTORICAL_DESTRUCTIVE_MIGRATION_TABLES,
    );

    // Nuclear wipe — clears every fake/demo record while keeping users and workspaces.
    // TRUNCATE CASCADE handles FK dependencies automatically.
    await queryRunner.query(`
      TRUNCATE TABLE
        manager_relationships,
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
        bridge_events,
        report_snapshots,
        agents,
        teams,
        departments,
        companies
      CASCADE
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback
  }
}
