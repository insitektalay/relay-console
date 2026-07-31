import {
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

@Entity('web_sessions')
@Index(['userId', 'revokedAt'])
export class WebSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  userId: string

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity

  @Column({ select: false })
  refreshTokenHash: string

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null

  @Column({ nullable: true })
  ipAddress: string | null

  @Column({ nullable: true })
  userAgent: string | null

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
