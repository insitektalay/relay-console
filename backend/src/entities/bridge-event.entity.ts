import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

export enum BridgeEventStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

@Entity('bridge_events')
@Index(['connectionId', 'createdAt'])
@Index(['status'])
export class BridgeEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  connectionId: string

  @Column()
  type: string

  @Column({ type: 'jsonb', default: '{}' })
  payload: object

  @Column({
    type: 'enum',
    enum: BridgeEventStatus,
    default: BridgeEventStatus.PENDING,
  })
  status: BridgeEventStatus

  @CreateDateColumn()
  createdAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date

  @Column({ type: 'text', nullable: true })
  error: string
}
