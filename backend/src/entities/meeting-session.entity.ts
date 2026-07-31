import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

export enum MeetingStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

export enum MeetingParticipantType {
  USER = 'user',
  AGENT = 'agent',
  TEAM = 'team',
  DEPARTMENT = 'department',
  EXTERNAL = 'external',
}

export enum MeetingParticipantRole {
  HOST = 'host',
  PARTICIPANT = 'participant',
  OBSERVER = 'observer',
  FACILITATOR = 'facilitator',
  NOTE_TAKER = 'note_taker',
}

export interface MeetingParticipantSnapshot {
  participantId: string
  participantType: MeetingParticipantType
  displayNameAtTime: string
  meetingRole: MeetingParticipantRole
}

@Entity('meeting_sessions')
@Index(['workspaceId'])
@Index(['threadId'])
@Index(['status'])
export class MeetingSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  workspaceId: string

  @Column()
  threadId: string

  @Column()
  title: string

  @Column({ type: 'enum', enum: MeetingStatus, default: MeetingStatus.DRAFT })
  status: MeetingStatus

  @Column({ type: 'timestamptz', nullable: true })
  scheduledStartAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null

  @Column({ type: 'text', nullable: true })
  briefMarkdown: string | null

  @Column({ type: 'int', default: 1 })
  briefVersion: number

  @Column({ type: 'jsonb', default: '[]' })
  participantsSnapshot: MeetingParticipantSnapshot[]

  @Column({ nullable: true })
  appliedRulePackSnapshotId: string | null

  @Column()
  createdByUserId: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
