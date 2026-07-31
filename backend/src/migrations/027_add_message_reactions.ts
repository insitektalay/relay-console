import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMessageReactions1775300000000 implements MigrationInterface {
  name = 'AddMessageReactions1775300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE message_reactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "messageId" UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
        "agentId" UUID REFERENCES agents(id) ON DELETE SET NULL,
        "reactorId" VARCHAR(128) NOT NULL,
        "reactorType" VARCHAR(16) NOT NULL,
        "reactorName" VARCHAR(200) NOT NULL,
        emoji VARCHAR(32) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("messageId", "reactorId", emoji)
      )
    `)

    await queryRunner.query(`
      CREATE INDEX idx_message_reactions_message
      ON message_reactions ("messageId")
    `)

    await queryRunner.query(`
      CREATE INDEX idx_message_reactions_reactor
      ON message_reactions ("reactorId")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_message_reactions_reactor`,
    )
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_message_reactions_message`,
    )
    await queryRunner.query(`DROP TABLE IF EXISTS message_reactions`)
  }
}
