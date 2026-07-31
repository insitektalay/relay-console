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
import { WorkspaceEntity } from './workspace.entity'
import { UserEntity } from './user.entity'

export const PAPERCLIP_AUTH_TYPE_BEARER_TOKEN = 'bearer_token'

export const PAPERCLIP_CONNECTION_STATUSES = [
  'unverified',
  'ready',
  'unauthorized',
  'unreachable',
  'error',
] as const

export type PaperclipConnectionStatus =
  (typeof PAPERCLIP_CONNECTION_STATUSES)[number]

@Entity('paperclip_connections')
@Index(['workspaceId'])
@Index(['workspaceId', 'status'])
@Index(['workspaceId', 'baseUrl', 'companyId'], { unique: true })
export class PaperclipConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('uuid')
  workspaceId: string

  @Column({ length: 200 })
  displayName: string

  @Column({ length: 500 })
  baseUrl: string

  @Column({ length: 128 })
  companyId: string

  @Column({ length: 200, nullable: true })
  companyName: string | null

  @Column({ type: 'varchar', length: 32, default: PAPERCLIP_AUTH_TYPE_BEARER_TOKEN })
  authType: string

  @Column({ type: 'text', select: false })
  bearerTokenCiphertext: string

  @Column({ length: 128, select: false })
  bearerTokenIv: string

  @Column({ length: 128, select: false })
  bearerTokenAuthTag: string

  @Column({ length: 32, select: false })
  bearerTokenKeyVersion: string

  @Column({ type: 'varchar', length: 32, default: 'unverified' })
  status: PaperclipConnectionStatus

  @Column({ type: 'timestamptz', nullable: true })
  lastValidatedAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  lastSuccessAt: Date | null

  @Column({ length: 64, nullable: true })
  lastErrorCode: string | null

  @Column({ type: 'text', nullable: true })
  lastErrorMessage: string | null

  @Column('uuid')
  createdByUserId: string

  @Column('uuid')
  updatedByUserId: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => WorkspaceEntity)
  @JoinColumn({ name: 'workspaceId' })
  workspace: WorkspaceEntity

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: UserEntity

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'updatedByUserId' })
  updatedByUser: UserEntity
}
