import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { UserEntity } from './user.entity'

export type AccountActionTokenPurpose = 'email_verification' | 'password_reset'

@Entity('account_action_tokens')
@Index(['tokenHash'], { unique: true })
@Index(['userId', 'purpose', 'usedAt'])
export class AccountActionTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('uuid')
  userId: string

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity

  @Column()
  purpose: AccountActionTokenPurpose

  @Column({ length: 64 })
  tokenHash: string

  @Column({ type: 'timestamptz' })
  expiresAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null

  @CreateDateColumn()
  createdAt: Date
}
