import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMeetingDomain1774380000000 implements MigrationInterface {
  name = 'AddMeetingDomain1774380000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE message_provenance_enum AS ENUM (
          'user',
          'agent',
          'meeting_brief',
          'scheduled_injection',
          'meeting_system'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)

    await queryRunner.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS provenance message_provenance_enum NOT NULL DEFAULT 'user'
    `)
    await queryRunner.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS metadata jsonb NULL
    `)
    await queryRunner.query(`
      UPDATE messages
      SET provenance = CASE
        WHEN "isFromUser" = true THEN 'user'::message_provenance_enum
        ELSE 'agent'::message_provenance_enum
      END
      WHERE provenance IS NULL OR provenance = 'user'
    `)

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE meeting_status_enum AS ENUM (
          'draft',
          'scheduled',
          'active',
          'ended',
          'cancelled'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS meeting_rule_pack_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "sourceRulePackId" UUID NULL,
        "schemaVersion" INTEGER NOT NULL DEFAULT 1,
        "workspaceId" UUID NOT NULL,
        name VARCHAR NOT NULL,
        description TEXT NULL,
        "advisoryRulesMarkdown" TEXT NOT NULL DEFAULT '',
        "hardRestrictions" JSONB NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS meeting_rule_packs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL,
        name VARCHAR NOT NULL,
        description TEXT NULL,
        "advisoryRulesMarkdown" TEXT NOT NULL DEFAULT '',
        "hardRestrictions" JSONB NOT NULL DEFAULT '[]',
        "isSystem" BOOLEAN NOT NULL DEFAULT false,
        "createdByUserId" UUID NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_meeting_rule_packs_workspace ON meeting_rule_packs ("workspaceId")`)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS meeting_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL,
        "threadId" UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        title VARCHAR NOT NULL,
        status meeting_status_enum NOT NULL DEFAULT 'draft',
        "scheduledStartAt" TIMESTAMPTZ NULL,
        "startedAt" TIMESTAMPTZ NULL,
        "endedAt" TIMESTAMPTZ NULL,
        "cancelledAt" TIMESTAMPTZ NULL,
        "briefMarkdown" TEXT NULL,
        "briefVersion" INTEGER NOT NULL DEFAULT 1,
        "participantsSnapshot" JSONB NOT NULL DEFAULT '[]',
        "appliedRulePackSnapshotId" UUID NULL REFERENCES meeting_rule_pack_snapshots(id) ON DELETE SET NULL,
        "createdByUserId" UUID NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_meeting_sessions_workspace ON meeting_sessions ("workspaceId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_meeting_sessions_thread ON meeting_sessions ("threadId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_meeting_sessions_status ON meeting_sessions (status)`)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS meeting_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "meetingId" UUID NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
        "workspaceId" UUID NOT NULL,
        "threadId" UUID NOT NULL,
        "structuredJson" JSONB NOT NULL,
        "renderedMarkdown" TEXT NOT NULL,
        "generationStatus" VARCHAR NOT NULL DEFAULT 'pending',
        version INTEGER NOT NULL DEFAULT 1,
        "generatedBy" VARCHAR NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_meeting_notes_workspace ON meeting_notes ("workspaceId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_meeting_notes_thread ON meeting_notes ("threadId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting ON meeting_notes ("meetingId")`)

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE scheduled_message_target_mode_enum AS ENUM ('thread', 'participant', 'meeting');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE scheduled_message_status_enum AS ENUM (
          'pending',
          'in_progress',
          'sent',
          'failed',
          'cancelled'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS scheduled_thread_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL,
        "threadId" UUID NULL REFERENCES threads(id) ON DELETE CASCADE,
        "meetingId" UUID NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
        "targetMode" scheduled_message_target_mode_enum NOT NULL DEFAULT 'thread',
        "targetParticipantId" UUID NULL,
        "authorUserId" UUID NOT NULL,
        "contentMarkdown" TEXT NOT NULL,
        "runAt" TIMESTAMPTZ NOT NULL,
        timezone VARCHAR NOT NULL,
        status scheduled_message_status_enum NOT NULL DEFAULT 'pending',
        "injectedMessageId" UUID NULL REFERENCES messages(id) ON DELETE SET NULL,
        "retryCount" INTEGER NOT NULL DEFAULT 0,
        "lastError" TEXT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_scheduled_thread_messages_workspace ON scheduled_thread_messages ("workspaceId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_scheduled_thread_messages_due ON scheduled_thread_messages (status, "runAt")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS scheduled_thread_messages`)
    await queryRunner.query(`DROP TABLE IF EXISTS meeting_notes`)
    await queryRunner.query(`DROP TABLE IF EXISTS meeting_sessions`)
    await queryRunner.query(`DROP TABLE IF EXISTS meeting_rule_packs`)
    await queryRunner.query(`DROP TABLE IF EXISTS meeting_rule_pack_snapshots`)

    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS metadata`)
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS provenance`)

    await queryRunner.query(`DROP TYPE IF EXISTS scheduled_message_status_enum`)
    await queryRunner.query(`DROP TYPE IF EXISTS scheduled_message_target_mode_enum`)
    await queryRunner.query(`DROP TYPE IF EXISTS meeting_status_enum`)
    await queryRunner.query(`DROP TYPE IF EXISTS message_provenance_enum`)
  }
}
