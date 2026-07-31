import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('beta_invites')
@Index(['codeHash'], { unique: true })
@Index(['email'])
export class BetaInviteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 128 })
  codeHash: string

  @Column({ nullable: true, length: 254 })
  email: string | null

  @Column({ type: 'integer', default: 1 })
  maxUses: number

  @Column({ type: 'integer', default: 0 })
  useCount: number

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  lastUsedByUserId: string | null

  @Column({ nullable: true, length: 254 })
  lastUsedEmail: string | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
