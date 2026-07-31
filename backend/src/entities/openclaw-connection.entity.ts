import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { WorkspaceEntity } from './workspace.entity'

@Entity('openclaw_connections')
@Index(['workspaceId'])
export class OpenClawConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  workspaceId: string

  @Column()
  instanceUrl: string

  @Column({ nullable: true, select: false })
  apiKeyCiphertext: string | null

  @Column({ nullable: true, select: false })
  apiKeyIv: string | null

  @Column({ nullable: true, select: false })
  apiKeyAuthTag: string | null

  @Column({ nullable: true, select: false })
  apiKeyKeyVersion: string | null

  @Column({ default: 'disconnected' })
  status: string

  @Column({ type: 'timestamptz', nullable: true })
  lastConnectedAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  lastEventAt: Date

  @Column({ default: 0 })
  agentsSynced: number

  @Column({ default: false })
  useMockMode: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => WorkspaceEntity, (w) => w.connections)
  @JoinColumn({ name: 'workspaceId' })
  workspace: WorkspaceEntity
}
