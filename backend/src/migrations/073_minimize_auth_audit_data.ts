import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Forward-only privacy boundary. The discarded anonymous identifiers, network
 * addresses, and auth error details must never be recreated by rollback.
 */
export class MinimizeAuthAuditData1785187000073
  implements MigrationInterface
{
  name = "MinimizeAuthAuditData1785187000073";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "audit_logs"
      SET
        "actorType" = LEFT(
          BTRIM(regexp_replace("actorType", '[[:cntrl:]]+', ' ', 'g')),
          64
        ),
        "actorId" = CASE
          WHEN "actorType" = 'anonymous' THEN NULL
          WHEN "actorId" IS NULL THEN NULL
          ELSE LEFT(
            BTRIM(regexp_replace("actorId", '[[:cntrl:]]+', ' ', 'g')),
            128
          )
        END,
        "eventType" = LEFT(
          BTRIM(regexp_replace("eventType", '[[:cntrl:]]+', ' ', 'g')),
          160
        ),
        "resourceType" = CASE
          WHEN "resourceType" IS NULL THEN NULL
          ELSE LEFT(
            BTRIM(regexp_replace("resourceType", '[[:cntrl:]]+', ' ', 'g')),
            128
          )
        END,
        "resourceId" = CASE
          WHEN "resourceId" IS NULL THEN NULL
          ELSE LEFT(
            BTRIM(regexp_replace("resourceId", '[[:cntrl:]]+', ' ', 'g')),
            256
          )
        END,
        "ipAddress" = NULL,
        "userAgent" = CASE
          WHEN "userAgent" IS NULL THEN NULL
          ELSE NULLIF(
            LEFT(
              BTRIM(regexp_replace("userAgent", '[[:cntrl:]]+', ' ', 'g')),
              160
            ),
            ''
          )
        END,
        metadata = CASE
          WHEN "eventType" LIKE 'auth.%' THEN NULLIF(
            COALESCE(metadata, '{}'::jsonb)
              - ARRAY[
                  'apiKey',
                  'authorization',
                  'cookie',
                  'email',
                  'password',
                  'reason',
                  'secret',
                  'token',
                  'accessToken',
                  'refreshToken'
                ]::text[],
            '{}'::jsonb
          )
          ELSE metadata
        END
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ALTER COLUMN "actorType" TYPE varchar(64),
        ALTER COLUMN "actorId" TYPE varchar(128),
        ALTER COLUMN "eventType" TYPE varchar(160),
        ALTER COLUMN "resourceType" TYPE varchar(128),
        ALTER COLUMN "resourceId" TYPE varchar(256),
        ALTER COLUMN "ipAddress" TYPE varchar(64),
        ALTER COLUMN "userAgent" TYPE varchar(160)
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "audit_logs"."ipAddress" IS
        'Non-reversible network:v1 HMAC token only; raw IP addresses are prohibited'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      COMMENT ON COLUMN "audit_logs"."ipAddress" IS NULL;
      ALTER TABLE "audit_logs"
        ALTER COLUMN "actorType" TYPE varchar,
        ALTER COLUMN "actorId" TYPE varchar,
        ALTER COLUMN "eventType" TYPE varchar,
        ALTER COLUMN "resourceType" TYPE varchar,
        ALTER COLUMN "resourceId" TYPE varchar,
        ALTER COLUMN "ipAddress" TYPE varchar,
        ALTER COLUMN "userAgent" TYPE varchar
    `);
  }
}
