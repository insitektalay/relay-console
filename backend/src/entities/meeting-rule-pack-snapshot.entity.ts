import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'
import { MeetingHardRestriction } from './meeting-rule-pack.entity'

@Entity('meeting_rule_pack_snapshots')
@Index(['sourceRulePackId'])
export class MeetingRulePackSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ nullable: true })
  sourceRulePackId: string | null

  @Column({ default: 1 })
  schemaVersion: number

  @Column()
  workspaceId: string

  @Column()
  name: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'text', default: '' })
  advisoryRulesMarkdown: string

  @Column({ type: 'jsonb', default: '[]' })
  hardRestrictions: MeetingHardRestriction[]

  @CreateDateColumn()
  createdAt: Date
}
