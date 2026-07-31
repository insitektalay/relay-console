import { MigrationInterface, QueryRunner } from "typeorm";

const BLOCKED_REASON =
  "External artifact link blocked because it does not use an approved HTTPS URL.";

/**
 * Forward-only data minimization. Removed unsafe URLs must never be recreated
 * by rollback.
 */
export class QuarantineUnsafeArtifactUrls1785187000074
  implements MigrationInterface
{
  name = "QuarantineUnsafeArtifactUrls1785187000074";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ["relay_sync_objects", "relay_workspace_changes"]) {
      await queryRunner.query(`
        UPDATE "${table}"
        SET "payload" =
          jsonb_set(
            jsonb_set(
              "payload" - 'externalUrl',
              '{presentationState}',
              '"unavailable"'::jsonb,
              true
            ),
            '{presentationReason}',
            to_jsonb('${BLOCKED_REASON}'::text),
            true
          )
        WHERE "objectType" = 'artifact'
          AND jsonb_typeof("payload" -> 'externalUrl') = 'string'
          AND (
            ("payload" ->> 'externalUrl') !~* '^https://'
            OR ("payload" ->> 'externalUrl') ~ '[[:cntrl:]]'
            OR strpos(("payload" ->> 'externalUrl'), E'\\\\') > 0
            OR ("payload" ->> 'externalUrl') ~* '^https://[^/?#]*@'
          )
      `);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally forward-only: discarded unsafe URLs must not be restored.
  }
}
