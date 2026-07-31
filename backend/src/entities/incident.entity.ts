import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

@Entity('incidents')
@Index(['workspaceId', 'status'])
@Index(['severity'])
export class IncidentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  title: string

  @Column({ type: 'text' })
  description: string

  @Column({ default: 'open' })
  status: string

  @Column({ default: 'medium' })
  severity: string

  @Column({ nullable: true })
  agentId: string

  @Column({ nullable: true })
  teamId: string

  @Column()
  workspaceId: string

  @Column({ nullable: true })
  taskId: string

  @Column({ nullable: true })
  runId: string

  @Column({ type: 'simple-array', nullable: true })
  tags: string[]

  @Column({ type: 'simple-array', nullable: true })
  affectedSystems: string[]

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
