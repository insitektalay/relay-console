import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import { WorkspaceEntity } from './workspace.entity'
import { WorkspaceMemberEntity } from './workspace-member.entity'
import { BridgeDeviceEntity } from './bridge-device.entity'
import { BridgeEnrollmentEntity } from './bridge-enrollment.entity'

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  email: string

  @Column()
  name: string

  @Column({ select: false })
  passwordHash: string

  @Column({ nullable: true })
  avatarUrl: string

  @Column({ nullable: true, select: false })
  refreshToken: string

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  betaAccessEndsAt: Date | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(() => WorkspaceEntity, (w) => w.owner)
  workspaces: WorkspaceEntity[]

  @OneToMany(() => WorkspaceMemberEntity, (membership) => membership.user)
  workspaceMemberships: WorkspaceMemberEntity[]

  @OneToMany(() => BridgeDeviceEntity, (device) => device.createdByUser)
  createdBridgeDevices: BridgeDeviceEntity[]

  @OneToMany(() => BridgeEnrollmentEntity, (enrollment) => enrollment.createdByUser)
  createdBridgeEnrollments: BridgeEnrollmentEntity[]
}
