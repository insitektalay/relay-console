import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('waitlist_entries')
export class WaitlistEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true, length: 254 })
  email: string

  @Column({ nullable: true, length: 80 })
  source: string | null

  @Column({ type: 'text', nullable: true })
  origin: string | null

  @Column({ type: 'text', nullable: true })
  userAgent: string | null

  @Column({ nullable: true, length: 80 })
  ipAddress: string | null

  @Column({ type: 'integer', default: 1 })
  submissionCount: number

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastSubmittedAt: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
