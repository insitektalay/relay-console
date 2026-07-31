import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

@Entity('availability_states')
@Index(['agentId'])
export class AvailabilityStateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  agentId: string

  @Column()
  status: string

  @Column({ nullable: true, type: 'text' })
  reason: string

  @Column({ type: 'timestamptz' })
  since: Date

  @Column({ type: 'timestamptz', nullable: true })
  until: Date

  @Column({ nullable: true })
  setByUserId: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
