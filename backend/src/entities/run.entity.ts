import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

@Entity('runs')
@Index(['taskId'])
@Index(['agentId'])
export class RunEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  taskId: string

  @Column()
  agentId: string

  @Column({ default: 'running' })
  status: string

  @Column({ type: 'timestamptz' })
  startedAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date

  @Column({ type: 'text', nullable: true })
  errorMessage: string

  @Column({ default: 0 })
  eventsCount: number

  @Column({ default: 0 })
  tokensUsed: number

  @Column({ type: 'float', default: 0 })
  cost: number

  @CreateDateColumn()
  createdAt: Date
}
