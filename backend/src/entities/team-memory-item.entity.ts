import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

export enum TeamMemoryItemType {
  RULE = 'rule',
  CONTEXT = 'context',
  DOCUMENT = 'document',
  SOP = 'SOP',
  NOTE = 'note',
}

@Entity('team_memory_items')
@Index(['teamId'])
@Index(['type'])
export class TeamMemoryItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  teamId: string

  @Column()
  title: string

  @Column({ type: 'text' })
  content: string

  @Column({
    type: 'enum',
    enum: TeamMemoryItemType,
    default: TeamMemoryItemType.NOTE,
  })
  type: TeamMemoryItemType

  @Column({ type: 'jsonb', default: '[]' })
  tags: string[]

  @Column({ nullable: true })
  createdById: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
