import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { UserEntity } from './user.entity'
import { CompanyEntity } from './company.entity'
import { AgentEntity } from './agent.entity'
import { ThreadEntity } from './thread.entity'
import { OpenClawConnectionEntity } from './openclaw-connection.entity'
import { WorkspaceMemberEntity } from './workspace-member.entity'
import { BridgeDeviceEntity } from './bridge-device.entity'
import { BridgeEnrollmentEntity } from './bridge-enrollment.entity'

@Entity('workspaces')
export class WorkspaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column({ type: 'enum', enum: ['personal', 'business'], default: 'business' })
  type: string

  @Column({ nullable: true })
  avatarUrl: string

  @Column({ nullable: true })
  description: string

  @Column({ nullable: true })
  ownerId: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => UserEntity, (u) => u.workspaces)
  @JoinColumn({ name: 'ownerId' })
  owner: UserEntity

  @OneToMany(() => CompanyEntity, (c) => c.workspace)
  companies: CompanyEntity[]

  @OneToMany(() => AgentEntity, (a) => a.workspace)
  agents: AgentEntity[]

  @OneToMany(() => ThreadEntity, (t) => t.workspace)
  threads: ThreadEntity[]

  @OneToMany(() => OpenClawConnectionEntity, (c) => c.workspace)
  connections: OpenClawConnectionEntity[]

  @OneToMany(() => WorkspaceMemberEntity, (member) => member.workspace)
  members: WorkspaceMemberEntity[]

  @OneToMany(() => BridgeDeviceEntity, (device) => device.workspace)
  bridgeDevices: BridgeDeviceEntity[]

  @OneToMany(() => BridgeEnrollmentEntity, (enrollment) => enrollment.workspace)
  bridgeEnrollments: BridgeEnrollmentEntity[]
}
