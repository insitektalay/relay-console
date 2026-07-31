import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateThreadAgentMemberships1774500000000 implements MigrationInterface {
  name = 'CreateThreadAgentMemberships1774500000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "thread_agent_memberships" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "threadId" uuid NOT NULL,
        "agentId" uuid NOT NULL,
        "addedByUserId" uuid,
        "addedByAgentId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_thread_agent_memberships_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_thread_agent_memberships_thread_agent" UNIQUE ("threadId", "agentId"),
        CONSTRAINT "FK_thread_agent_memberships_thread" FOREIGN KEY ("threadId") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_thread_agent_memberships_agent" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_thread_agent_memberships_threadId"
      ON "thread_agent_memberships" ("threadId")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_thread_agent_memberships_agentId"
      ON "thread_agent_memberships" ("agentId")
    `)

    await queryRunner.query(`
      INSERT INTO "thread_agent_memberships" ("threadId", "agentId", "addedByUserId", "addedByAgentId")
      SELECT t.id, elem.value::uuid, NULL, NULL
      FROM "threads" t
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(t."agentIds", '[]'::jsonb)) AS elem(value)
      ON CONFLICT ("threadId", "agentId") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "thread_agent_memberships" ("threadId", "agentId", "addedByUserId", "addedByAgentId")
      SELECT t.id, a.id, NULL, NULL
      FROM "threads" t
      INNER JOIN "agents" a
        ON a."teamId" = t."teamId"
      WHERE t.type = 'team'
        AND t."teamId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "thread_agent_memberships" tam
          WHERE tam."threadId" = t.id
        )
      ON CONFLICT ("threadId", "agentId") DO NOTHING
    `)

    await queryRunner.query(`
      UPDATE "threads" t
      SET "agentIds" = COALESCE((
        SELECT jsonb_agg(tam."agentId" ORDER BY tam."createdAt", tam.id)
        FROM "thread_agent_memberships" tam
        WHERE tam."threadId" = t.id
      ), '[]'::jsonb)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_thread_agent_memberships_agentId"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_thread_agent_memberships_threadId"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "thread_agent_memberships"`)
  }
}
