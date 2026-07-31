import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

@Entity('performance_metrics')
@Index(['agentId', 'period', 'periodStart'])
export class PerformanceMetricEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  agentId: string

  @Column()
  period: string

  @Column({ type: 'timestamptz' })
  periodStart: Date

  @Column({ type: 'timestamptz' })
  periodEnd: Date

  @Column({ default: 0 })
  tasksCompleted: number

  @Column({ default: 0 })
  tasksFailed: number

  @Column({ default: 0 })
  tasksRetried: number

  @Column({ type: 'float', default: 0 })
  successRate: number

  @Column({ type: 'float', default: 0 })
  avgCompletionMinutes: number

  @Column({ default: 0 })
  totalMinutesWorked: number

  @Column({ default: 0 })
  tokensUsed: number

  @Column({ type: 'float', default: 0 })
  cost: number

  @Column({ type: 'float', nullable: true })
  qualityScore: number

  @Column({ default: 0 })
  incidentCount: number

  @Column({ default: 0 })
  approvalCount: number

  @CreateDateColumn()
  createdAt: Date
}
