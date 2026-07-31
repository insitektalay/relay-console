import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

export enum CoachingNoteType {
  CORRECTION = 'correction',
  IMPROVEMENT = 'improvement',
  PRAISE = 'praise',
  INSTRUCTION = 'instruction',
  WARNING = 'warning',
}

@Entity('coaching_notes')
@Index(['agentId'])
@Index(['authorId'])
export class CoachingNoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  agentId: string

  @Column()
  authorId: string

  @Column({ type: 'text' })
  content: string

  @Column({
    type: 'enum',
    enum: CoachingNoteType,
    default: CoachingNoteType.IMPROVEMENT,
  })
  type: CoachingNoteType

  @Column({ nullable: true })
  relatedTaskId: string

  @CreateDateColumn()
  createdAt: Date
}
