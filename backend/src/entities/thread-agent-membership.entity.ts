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
import { AgentEntity } from './agent.entity'

@Entity('thread_agent_memberships')
@Index(['threadId'])
@Index(['agentId'])
@Index(['threadId', 'agentId'], { unique: true })
export class ThreadAgentMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column("uuid")
  threadId: string

  @Column("uuid")
  agentId: string

  @Column("uuid", { nullable: true })
  addedByUserId: string | null

  @Column("uuid", { nullable: true })
  addedByAgentId: string | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => ThreadEntity, (thread) => thread.agentMemberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'threadId' })
  thread: ThreadEntity

  @ManyToOne(() => AgentEntity, (agent) => agent.threadMemberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent: AgentEntity
}
