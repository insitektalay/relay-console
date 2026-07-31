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

@Entity('thread_sessions')
@Index(['threadId', 'sequenceNumber'], { unique: true })
@Index(['threadId', 'status'])
export class ThreadSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('uuid')
  threadId: string

  @Column({ type: 'int' })
  sequenceNumber: number

  @Column({ default: 'active' })
  status: string

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null

  @Column({ default: 'running' })
  relayRunState: 'running' | 'paused'

  @Column({ nullable: true })
  relayPauseReason: 'manual' | 'reply_limit' | null

  @Column({ type: 'int', default: 50 })
  relayReplyLimit: number

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  relayCatchUpCursors: Record<
    string,
    { messageId: string; createdAt: string }
  >

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => ThreadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'threadId' })
  thread: ThreadEntity
}
