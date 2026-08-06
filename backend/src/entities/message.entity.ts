import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { ThreadEntity } from './thread.entity'

export enum MessageProvenance {
  USER = 'user',
  AGENT = 'agent',
  MEETING_BRIEF = 'meeting_brief',
  SCHEDULED_INJECTION = 'scheduled_injection',
  MEETING_SYSTEM = 'meeting_system',
}

@Entity('messages')
@Index(['threadId', 'createdAt'])
@Index(['runtimeDispatchId', 'runtimeToolCallId'], {
  unique: true,
  where: '"runtimeDispatchId" IS NOT NULL AND "runtimeToolCallId" IS NOT NULL',
})
export class MessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  threadId: string

  @Column('uuid')
  threadSessionId: string

  @Column()
  senderId: string

  @Column()
  senderName: string

  @Column({ nullable: true })
  senderAvatarUrl: string

  @Column({ type: 'text' })
  content: string

  @Column({ default: 'text' })
  type: string

  @Column({ default: 'markdown' })
  contentFormat: string

  @Column({
    type: 'enum',
    enum: MessageProvenance,
    default: MessageProvenance.USER,
  })
  provenance: MessageProvenance

  @Column({ type: 'jsonb', nullable: true })
  embeddedCard: object

  @Column({ type: 'jsonb', default: '[]' })
  attachments: object[]

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null

  @Column('uuid', { nullable: true })
  runtimeDispatchId: string | null

  @Column({ type: 'varchar', length: 160, nullable: true })
  runtimeToolCallId: string | null

  @Column({ default: false })
  isFromUser: boolean

  @Column({ default: false })
  isEdited: boolean

  @Column({ nullable: true })
  replyToId: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => ThreadEntity, (t) => t.messages)
  @JoinColumn({ name: 'threadId' })
  thread: ThreadEntity
}
