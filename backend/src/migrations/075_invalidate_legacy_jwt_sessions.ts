import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Establishes the JWT issuer/audience policy as an intentional authentication
 * epoch. Tokens issued before this migration are rejected cryptographically,
 * and their server-side sessions are revoked so rollback or partial deployment
 * cannot silently revive them.
 *
 * Bridge rotating device credentials and hashed account-action tokens are not
 * JWTs and are deliberately unaffected.
 */
export class InvalidateLegacyJwtSessions1785270000075
  implements MigrationInterface
{
  name = "InvalidateLegacyJwtSessions1785270000075";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "web_sessions"
      SET "revokedAt" = NOW()
      WHERE "revokedAt" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "mobile_sessions"
      SET "revokedAt" = NOW()
      WHERE "revokedAt" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "users"
      SET "refreshToken" = NULL
      WHERE "refreshToken" IS NOT NULL
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Forward-only: invalidated authentication state must never be resurrected.
  }
}
