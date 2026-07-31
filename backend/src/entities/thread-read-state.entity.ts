import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { ThreadEntity } from './thread.entity'

@Entity('thread_read_states')
@Index(['threadId', 'userId'], { unique: true })
export class ThreadReadStateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  threadId: string

  @Column()
  userId: string

  @Column({ nullable: true })
  lastReadMessageId: string

  @Column({ default: 0 })
  unreadCount: number

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => ThreadEntity, (t) => t.readStates)
  @JoinColumn({ name: 'threadId' })
  thread: ThreadEntity
}
