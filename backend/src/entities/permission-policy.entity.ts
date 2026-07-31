import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

export enum PermissionScope {
  WORKSPACE = 'workspace',
  COMPANY = 'company',
  DEPARTMENT = 'department',
  TEAM = 'team',
  AGENT = 'agent',
}

export interface PermissionRule {
  action: string
  effect: 'allow' | 'deny'
}

@Entity('permission_policies')
@Index(['workspaceId'])
@Index(['scope', 'scopeId'])
export class PermissionPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column()
  workspaceId: string

  @Column({ type: 'enum', enum: PermissionScope, default: PermissionScope.WORKSPACE })
  scope: PermissionScope

  @Column({ nullable: true })
  scopeId: string

  @Column({ type: 'jsonb', default: '[]' })
  permissions: PermissionRule[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
