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

@Entity('mobile_sessions')
@Index(['userId', 'revokedAt'])
export class MobileSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  userId: string

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity

  @Column({ select: false })
  refreshTokenHash: string

  @Column({ nullable: true })
  deviceName: string | null

  @Column({ nullable: true })
  platform: string | null

  @Column({ nullable: true })
  pushToken: string | null

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
