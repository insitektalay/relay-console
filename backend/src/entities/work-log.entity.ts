import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm'

@Entity('work_logs')
@Index(['agentId', 'timestamp'])
@Index(['taskId'])
export class WorkLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  agentId: string

  @Column({ nullable: true })
  taskId: string

  @Column({ nullable: true })
  runId: string

  @Column()
  action: string

  @Column({ type: 'text' })
  details: string

  @Column({ type: 'timestamptz' })
  timestamp: Date

  @Column({ nullable: true })
  durationMinutes: number

  @Column({ type: 'jsonb', default: '{}' })
  metadata: object
}
