import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { MessageEntity } from './message.entity'
import { UserEntity } from './user.entity'
import { AgentEntity } from './agent.entity'

@Entity('message_reactions')
@Unique(['messageId', 'reactorId', 'emoji'])
export class MessageReactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  messageId: string

  @ManyToOne(() => MessageEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: MessageEntity

  // Nullable FK — null when reactor is an agent
  @Column({ nullable: true })
  userId: string | null

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: UserEntity | null

  // Nullable FK — null when reactor is a user
  @Column({ nullable: true })
  agentId: string | null

  @ManyToOne(() => AgentEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'agentId' })
  agent: AgentEntity | null

  // Non-null composite identity: `user:<userId>` or `agent:<agentId>`
  // Avoids PostgreSQL NULL != NULL ambiguity in UNIQUE constraint
  @Column()
  @Index()
  reactorId: string

  // 'user' | 'agent'
  @Column()
  reactorType: string

  // Historical snapshot of reactor name at time of reaction; never updated
  @Column()
  reactorName: string

  @Column()
  emoji: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
