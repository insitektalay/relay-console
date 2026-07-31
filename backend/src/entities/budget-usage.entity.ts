import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

@Entity('budget_usage')
@Index(['workspaceId', 'period', 'periodStart'])
@Index(['agentId'])
@Index(['teamId'])
@Index(['departmentId'])
export class BudgetUsageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ nullable: true })
  agentId: string

  @Column({ nullable: true })
  teamId: string

  @Column({ nullable: true })
  departmentId: string

  @Column()
  workspaceId: string

  @Column({ default: 0 })
  tokensUsed: number

  @Column({ type: 'float', default: 0 })
  cost: number

  @Column()
  period: string

  @Column({ type: 'timestamptz' })
  periodStart: Date

  @Column({ type: 'timestamptz' })
  periodEnd: Date

  @CreateDateColumn()
  createdAt: Date
}
