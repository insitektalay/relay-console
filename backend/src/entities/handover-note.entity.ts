import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

@Entity('handover_notes')
@Index(['fromAgentId'])
@Index(['toAgentId'])
@Index(['toTeamId'])
export class HandoverNoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  fromAgentId: string

  @Column({ nullable: true })
  toAgentId: string

  @Column({ nullable: true })
  toTeamId: string

  @Column({ type: 'text' })
  content: string

  @Column({ type: 'jsonb', default: '[]' })
  taskIds: string[]

  @CreateDateColumn()
  createdAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt: Date
}
