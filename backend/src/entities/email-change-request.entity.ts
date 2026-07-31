import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { UserEntity } from './user.entity'

@Entity('email_change_requests')
@Index('UQ_email_change_active_user', ['userId'], {
  unique: true,
  where: '"completedAt" IS NULL AND "cancelledAt" IS NULL',
})
@Index('UQ_email_change_active_new_email', ['newEmail'], {
  unique: true,
  where: '"completedAt" IS NULL AND "cancelledAt" IS NULL',
})
@Index(['tokenHash'], { unique: true })
@Index(['expiresAt'])
@Check(
  'CHK_email_change_normalized_distinct',
  `"currentEmail" = lower("currentEmail") AND "newEmail" = lower("newEmail") AND "currentEmail" <> "newEmail"`,
)
export class EmailChangeRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('uuid')
  userId: string

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity

  @Column({ length: 254 })
  currentEmail: string

  @Column({ length: 254 })
  newEmail: string

  @Column({ length: 64 })
  tokenHash: string

  @Column({ type: 'timestamptz' })
  expiresAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
