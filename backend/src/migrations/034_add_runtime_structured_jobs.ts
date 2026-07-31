import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRuntimeStructuredJobs1775700000000
  implements MigrationInterface
{
  name = "AddRuntimeStructuredJobs1775700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "runtime_structured_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "jobType" character varying NOT NULL,
        "runtimeType" character varying NOT NULL,
        "agentId" uuid NOT NULL,
        "externalAgentId" character varying NOT NULL,
        "runtimeBindingId" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'queued',
        "schemaName" character varying,
        "model" character varying,
        "correlationId" character varying,
        "inputMetadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "output" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "errorCode" character varying,
        "errorMessage" text,
        "retryable" boolean NOT NULL DEFAULT false,
        "startedAt" TIMESTAMP WITH TIME ZONE,
        "completedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_runtime_structured_jobs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_runtime_structured_jobs_workspace_created"
      ON "runtime_structured_jobs" ("workspaceId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_runtime_structured_jobs_status_updated"
      ON "runtime_structured_jobs" ("status", "updatedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_runtime_structured_jobs_type_created"
      ON "runtime_structured_jobs" ("jobType", "createdAt")
    `);
    await queryRunner.query(`
      ALTER TABLE "runtime_structured_jobs"
      ADD CONSTRAINT "FK_runtime_structured_jobs_workspace"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "runtime_structured_jobs"
      ADD CONSTRAINT "FK_runtime_structured_jobs_agent"
      FOREIGN KEY ("agentId") REFERENCES "agents"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "runtime_structured_jobs"
      ADD CONSTRAINT "FK_runtime_structured_jobs_binding"
      FOREIGN KEY ("runtimeBindingId") REFERENCES "runtime_bindings"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ALTER COLUMN "provider" SET DEFAULT 'runtime_structured_job'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ALTER COLUMN "provider" SET DEFAULT 'claude_code_cli'
    `);
    await queryRunner.query(`
      ALTER TABLE "runtime_structured_jobs"
      DROP CONSTRAINT "FK_runtime_structured_jobs_binding"
    `);
    await queryRunner.query(`
      ALTER TABLE "runtime_structured_jobs"
      DROP CONSTRAINT "FK_runtime_structured_jobs_agent"
    `);
    await queryRunner.query(`
      ALTER TABLE "runtime_structured_jobs"
      DROP CONSTRAINT "FK_runtime_structured_jobs_workspace"
    `);
    await queryRunner.query(`DROP INDEX "IDX_runtime_structured_jobs_type_created"`);
    await queryRunner.query(`DROP INDEX "IDX_runtime_structured_jobs_status_updated"`);
    await queryRunner.query(`DROP INDEX "IDX_runtime_structured_jobs_workspace_created"`);
    await queryRunner.query(`DROP TABLE "runtime_structured_jobs"`);
  }
}
