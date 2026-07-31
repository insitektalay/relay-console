import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

export enum ScheduledMessageTargetMode {
  THREAD = 'thread',
  PARTICIPANT = 'participant',
  MEETING = 'meeting',
}

export enum ScheduledMessageStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('scheduled_thread_messages')
@Index(['workspaceId'])
@Index(['status', 'runAt'])
@Index(['taskId'])
export class ScheduledThreadMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  workspaceId: string

  @Column({ nullable: true })
  threadId: string | null

  @Column({ nullable: true })
  meetingId: string | null

  @Column({ nullable: true })
  taskId: string | null

  @Column({
    type: 'enum',
    enum: ScheduledMessageTargetMode,
    default: ScheduledMessageTargetMode.THREAD,
  })
  targetMode: ScheduledMessageTargetMode

  @Column({ nullable: true })
  targetParticipantId: string | null

  @Column()
  authorUserId: string

  @Column({ type: 'text' })
  contentMarkdown: string

  @Column({ type: 'timestamptz' })
  runAt: Date

  @Column()
  timezone: string

  @Column({ nullable: true })
  recurrenceRule: string | null

  @Column({
    type: 'enum',
    enum: ScheduledMessageStatus,
    default: ScheduledMessageStatus.PENDING,
  })
  status: ScheduledMessageStatus

  @Column({ nullable: true })
  injectedMessageId: string | null

  @Column({ default: 0 })
  retryCount: number

  @Column({ type: 'text', nullable: true })
  lastError: string | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
