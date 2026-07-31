import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity('audit_logs')
@Index(['workspaceId', 'createdAt'])
@Index(['eventType', 'createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 64 })
  actorType: string

  @Column({ nullable: true, length: 128 })
  actorId: string | null

  @Column({ nullable: true })
  workspaceId: string | null

  @Column({ length: 160 })
  eventType: string

  @Column({ nullable: true, length: 128 })
  resourceType: string | null

  @Column({ nullable: true, length: 256 })
  resourceId: string | null

  /**
   * Compatibility column name. New rows contain only a non-reversible
   * `network:v1:<HMAC>` token, never a raw address.
   */
  @Column({ nullable: true, length: 64 })
  ipAddress: string | null

  @Column({ nullable: true, length: 160 })
  userAgent: string | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null

  @CreateDateColumn()
  createdAt: Date
}
