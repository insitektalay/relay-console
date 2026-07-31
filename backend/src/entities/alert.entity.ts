import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

@Entity('alerts')
@Index(['workspaceId', 'isRead'])
export class AlertEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  title: string

  @Column({ type: 'text' })
  message: string

  @Column()
  type: string

  @Column({ default: 'medium' })
  severity: string

  @Column()
  workspaceId: string

  @Column({ nullable: true })
  agentId: string

  @Column({ nullable: true })
  taskId: string

  @Column({ default: false })
  isRead: boolean

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date

  @CreateDateColumn()
  createdAt: Date
}
