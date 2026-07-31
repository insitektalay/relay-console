import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

@Entity('tasks')
@Index(['workspaceId', 'status'])
@Index(['assignedAgentId'])
@Index(['teamId'])
@Index(['threadId'])
@Index(['targetType'])
@Index(['nextRunAt'])
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  title: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ default: 'queued' })
  status: string

  @Column({ default: 'normal' })
  priority: string

  @Column({ nullable: true })
  assignedAgentId: string

  @Column({ nullable: true })
  teamId: string

  @Column({ nullable: true })
  departmentId: string

  @Column({ default: 'direct' })
  targetType: string

  @Column({ nullable: true })
  threadId: string

  @Column({ nullable: true })
  targetAgentId: string

  @Column({ nullable: true })
  targetAgentTwoId: string

  @Column()
  workspaceId: string

  @Column({ nullable: true })
  createdByUserId: string

  @Column({ nullable: true })
  createdByAgentId: string

  @Column({ type: 'timestamptz', nullable: true })
  dueAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  scheduledFor: Date

  @Column({ type: 'timestamptz', nullable: true })
  nextRunAt: Date

  @Column({ default: 'UTC' })
  timezone: string

  @Column({ nullable: true })
  recurrenceRule: string

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date

  @Column({ type: 'simple-array', nullable: true })
  tags: string[]

  @Column({ type: 'float', default: 0 })
  budgetUsed: number

  @Column({ nullable: true })
  estimatedMinutes: number

  @Column({ nullable: true })
  actualMinutes: number

  @Column({ default: 0 })
  runCount: number

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date

  @Column({ type: 'text', nullable: true })
  messageBody: string

  @Column({ nullable: true })
  scheduledMessageId: string

  @Column({ nullable: true })
  dispatchedMessageId: string

  @Column({ type: 'timestamptz', nullable: true })
  lastDispatchedAt: Date

  @Column({ type: 'text', nullable: true })
  lastError: string

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date

  @Column({ default: false })
  requiresApproval: boolean

  @Column({ nullable: true })
  approvalId: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
