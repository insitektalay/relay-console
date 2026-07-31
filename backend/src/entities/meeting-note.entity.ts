import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

export enum MeetingNoteGenerationStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('meeting_notes')
@Index(['workspaceId'])
@Index(['threadId'])
@Index(['meetingId'])
export class MeetingNoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  meetingId: string

  @Column()
  workspaceId: string

  @Column()
  threadId: string

  @Column({ type: 'jsonb' })
  structuredJson: Record<string, unknown>

  @Column({ type: 'text' })
  renderedMarkdown: string

  @Column({
    type: 'enum',
    enum: MeetingNoteGenerationStatus,
    default: MeetingNoteGenerationStatus.PENDING,
  })
  generationStatus: MeetingNoteGenerationStatus

  @Column({ type: 'int', default: 1 })
  version: number

  @Column()
  generatedBy: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
