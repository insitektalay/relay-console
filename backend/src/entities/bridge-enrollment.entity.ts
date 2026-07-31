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
import { WorkspaceEntity } from './workspace.entity'

export enum BridgeEnrollmentStatus {
  ACTIVE = 'active',
  USED = 'used',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

@Entity('bridge_enrollments')
@Index(['workspaceId'])
@Index(['status', 'expiresAt'])
export class BridgeEnrollmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  workspaceId: string

  @Column({ nullable: true })
  createdByUserId: string | null

  @Column({ select: false })
  codeHash: string

  @Column({ nullable: true })
  deviceLabel: string | null

  @Column({
    type: 'enum',
    enum: BridgeEnrollmentStatus,
    default: BridgeEnrollmentStatus.ACTIVE,
  })
  status: BridgeEnrollmentStatus

  @Column({ type: 'timestamptz' })
  expiresAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => WorkspaceEntity, (workspace) => workspace.bridgeEnrollments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace: WorkspaceEntity

  @ManyToOne(() => UserEntity, (user) => user.createdBridgeEnrollments, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: UserEntity | null
}
