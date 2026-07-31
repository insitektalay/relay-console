import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm'
import { WorkspaceEntity } from './workspace.entity'
import { MessageEntity } from './message.entity'
import { ThreadReadStateEntity } from './thread-read-state.entity'
import { ThreadAgentMembershipEntity } from './thread-agent-membership.entity'
import { ThreadSessionEntity } from './thread-session.entity'

@Entity('threads')
@Index(['workspaceId'])
@Index(['type'])
@Index(['updatedAt'])
export class ThreadEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  title: string

  @Column()
  type: string

  @Column()
  workspaceId: string

  @Column({ nullable: true })
  avatarUrl: string

  @Column({ type: 'jsonb', default: '[]' })
  participantIds: string[]

  @Column({ type: 'jsonb', default: '[]' })
  agentIds: string[]

  @Column({ default: false })
  isPinned: boolean

  @Column({ default: false })
  isMuted: boolean

  @Column({ default: 'active' })
  status: string

  @Column({ nullable: true })
  teamId: string

  @Column({ nullable: true })
  departmentId: string

  @Column({ type: 'jsonb', nullable: true })
  lastMessage: object

  @Column({ nullable: true, type: 'int' })
  maxAgentTurns: number | null

  @Column('uuid', { nullable: true })
  activeSessionId: string | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => WorkspaceEntity, (w) => w.threads)
  @JoinColumn({ name: 'workspaceId' })
  workspace: WorkspaceEntity

  @OneToMany(() => MessageEntity, (m) => m.thread)
  messages: MessageEntity[]

  @OneToMany(() => ThreadReadStateEntity, (r) => r.thread)
  readStates: ThreadReadStateEntity[]

  @OneToMany(() => ThreadAgentMembershipEntity, (membership) => membership.thread)
  agentMemberships: ThreadAgentMembershipEntity[]

  @OneToMany(() => ThreadSessionEntity, (session) => session.thread)
  sessions: ThreadSessionEntity[]
}
