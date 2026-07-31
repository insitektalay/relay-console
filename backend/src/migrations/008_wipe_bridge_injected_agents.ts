import { MigrationInterface, QueryRunner } from "typeorm";
import {
  HISTORICAL_DESTRUCTIVE_MIGRATION_TABLES,
  assertHistoricalDestructiveMigrationSafe,
} from "../infrastructure/database/destructive-migration-guard";

export class WipeBridgeInjectedAgents1774178000000 implements MigrationInterface {
  name = "WipeBridgeInjectedAgents1774178000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertHistoricalDestructiveMigrationSafe(
      queryRunner,
      this.name,
      HISTORICAL_DESTRUCTIVE_MIGRATION_TABLES,
    );

    // Wipe agents that were re-injected by the bridge mock mode after migration 007.
    // DISABLE_MOCK_AGENTS=true is now set so the bridge cannot recreate them.
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
