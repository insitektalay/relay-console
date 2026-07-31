import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

@Entity('reviews')
@Index(['agentId', 'periodStart'])
export class ReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  agentId: string

  @Column()
  reviewerId: string

  @Column()
  period: string

  @Column({ type: 'timestamptz' })
  periodStart: Date

  @Column({ type: 'timestamptz' })
  periodEnd: Date

  @Column({ type: 'smallint' })
  overallRating: number

  @Column({ type: 'text' })
  summary: string

  @Column({ type: 'jsonb', default: '[]' })
  strengths: string[]

  @Column({ type: 'jsonb', default: '[]' })
  improvements: string[]

  @CreateDateColumn()
  createdAt: Date
}
