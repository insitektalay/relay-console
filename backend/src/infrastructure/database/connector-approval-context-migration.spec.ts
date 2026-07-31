import type { QueryRunner } from "typeorm";
import { AddConnectorApprovalContextUniqueness1785173400066 } from "../../migrations/066_add_connector_approval_context_uniqueness";

describe("connector approval context migration", () => {
  it("deduplicates and uniquely indexes active connector approval contexts", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration =
      new AddConnectorApprovalContextUniqueness1785173400066();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("row_number() OVER");
    expect(sql).toContain(
      '"UQ_approvals_active_connector_execution_context"',
    );
    expect(sql).toContain(
      "status IN ('pending', 'approved', 'executing')",
    );
    expect(sql).toContain(
      "metadata #>> '{connectorExecution,contextSha256}'",
    );
  });

  it("drops the partial unique index on rollback", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration =
      new AddConnectorApprovalContextUniqueness1785173400066();

    await migration.down({ query } as unknown as QueryRunner);

    expect(query.mock.calls[0][0]).toContain(
      'DROP INDEX IF EXISTS\n        "UQ_approvals_active_connector_execution_context"',
    );
  });
});
