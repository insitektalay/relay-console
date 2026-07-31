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
import { ThreadEntity } from './thread.entity'
import { UserEntity } from './user.entity'
import { PaperclipConnectionEntity } from './paperclip-connection.entity'

export const PAPERCLIP_OBJECT_TYPES = ['issue', 'approval'] as const

export type PaperclipObjectType = (typeof PAPERCLIP_OBJECT_TYPES)[number]

@Entity('paperclip_thread_links')
@Index(['threadId'], { unique: true })
@Index(['workspaceId', 'connectionId'])
@Index(['connectionId', 'objectType'])
export class PaperclipThreadLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('uuid')
  workspaceId: string

  @Column('uuid')
  threadId: string

  @Column('uuid')
  connectionId: string

  @Column({ type: 'varchar', length: 32 })
  objectType: PaperclipObjectType

  @Column({ length: 128 })
  paperclipObjectId: string

  @Column({ length: 128, nullable: true })
  paperclipObjectRef: string | null

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

  @ManyToOne(() => ThreadEntity)
  @JoinColumn({ name: 'threadId' })
  thread: ThreadEntity

  @ManyToOne(() => PaperclipConnectionEntity)
  @JoinColumn({ name: 'connectionId' })
  connection: PaperclipConnectionEntity

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: UserEntity

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'updatedByUserId' })
  updatedByUser: UserEntity
}
