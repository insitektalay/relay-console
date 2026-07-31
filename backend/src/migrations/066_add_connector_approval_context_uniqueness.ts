import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConnectorApprovalContextUniqueness1785173400066
  implements MigrationInterface
{
  name = "AddConnectorApprovalContextUniqueness1785173400066";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY
              "workspaceId",
              metadata #>> '{connectorExecution,contextSha256}'
            ORDER BY "createdAt" ASC, id ASC
          ) AS duplicate_rank
        FROM approvals
        WHERE metadata #>> '{connectorExecution,purpose}' =
          'marketplace_connector_execution'
          AND metadata #>> '{connectorExecution,contextSha256}' IS NOT NULL
          AND status IN ('pending', 'approved', 'executing')
      )
      UPDATE approvals
      SET
        status = 'expired',
        metadata = approvals.metadata || jsonb_build_object(
          'duplicateContextRetiredAt',
          now()
        )
      FROM ranked
      WHERE approvals.id = ranked.id
        AND ranked.duplicate_rank > 1;

      CREATE UNIQUE INDEX IF NOT EXISTS
        "UQ_approvals_active_connector_execution_context"
      ON approvals (
        "workspaceId",
        (metadata #>> '{connectorExecution,contextSha256}')
      )
      WHERE metadata #>> '{connectorExecution,purpose}' =
        'marketplace_connector_execution'
        AND status IN ('pending', 'approved', 'executing');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "UQ_approvals_active_connector_execution_context";
    `);
  }
}
