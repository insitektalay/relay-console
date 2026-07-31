import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm'

@Entity('run_events')
@Index(['runId', 'timestamp'])
export class RunEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  runId: string

  @Column()
  type: string

  @Column({ type: 'text' })
  content: string

  @Column({ type: 'timestamptz' })
  timestamp: Date

  @Column({ type: 'jsonb', default: '{}' })
  metadata: object
}
