import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Finds seeded agents (no [Bridge] in description) that are duplicates of
 * bridge-synced agents (description contains [Bridge]), matched by a normalised
 * name key (lowercase, "my " prefix stripped, whitespace collapsed).
 *
 * For each duplicate pair:
 *   1. Rewrites thread agentIds to point at the bridge agent (which has an avatarUrl).
 *   2. Deletes the stale seeded agent.
 *
 * Also tightens bridge.service.ts name lookup to ILIKE so this can't happen again
 * (that's a code change, not SQL — see the companion fix in bridge.service.ts).
 */
export class RemoveSeededAgentDuplicates1774482000000 implements MigrationInterface {
  name = 'RemoveSeededAgentDuplicates1774482000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Find all pairs: seeded (no [Bridge]) matched to a bridge agent by normalised name.
    // Normalisation mirrors the JS identityKey: lowercase, strip leading "my ", collapse spaces.
    const duplicates: { seeded_id: string; bridge_id: string }[] =
      await queryRunner.query(`
        WITH seeded AS (
          SELECT id, "workspaceId",
            LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(name, E'^my\\\\s+', '', 'i'), E'\\\\s+', ' ', 'g'))) AS norm
          FROM agents
          WHERE description NOT LIKE '%[Bridge]%'
        ),
        bridged AS (
          SELECT id, "workspaceId",
            LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(name, E'^my\\\\s+', '', 'i'), E'\\\\s+', ' ', 'g'))) AS norm
          FROM agents
          WHERE description LIKE '%[Bridge]%'
        )
        SELECT s.id AS seeded_id, b.id AS bridge_id
        FROM seeded s
        JOIN bridged b ON s.norm = b.norm AND s."workspaceId" = b."workspaceId"
      `)

    for (const { seeded_id, bridge_id } of duplicates) {
      // Rewrite thread agentIds: replace seeded agent ID with bridge agent ID.
      await queryRunner.query(
        `
        UPDATE threads
        SET "agentIds" = (
          SELECT jsonb_agg(
            CASE WHEN elem = to_jsonb($1::text) THEN to_jsonb($2::text) ELSE elem END
          )
          FROM jsonb_array_elements("agentIds") AS elem
        )
        WHERE "agentIds" @> to_jsonb($1::text)
        `,
        [seeded_id, bridge_id],
      )

      // Remove the stale seeded agent.
      await queryRunner.query(`DELETE FROM agents WHERE id = $1`, [seeded_id])
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Reversing this would require knowing the original seeded agent IDs and
    // re-inserting them, which is not practical. The seed migration (009) can
    // be re-run on a fresh database instead.
  }
}
