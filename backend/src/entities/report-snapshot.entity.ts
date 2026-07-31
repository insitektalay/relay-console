import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

@Entity('report_snapshots')
@Index(['workspaceId', 'type', 'periodStart'])
export class ReportSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  title: string

  @Column()
  type: string

  @Column()
  workspaceId: string

  @Column()
  period: string

  @Column({ type: 'timestamptz' })
  periodStart: Date

  @Column({ type: 'timestamptz' })
  periodEnd: Date

  @Column({ type: 'jsonb', default: '{}' })
  data: object

  @CreateDateColumn()
  createdAt: Date
}
