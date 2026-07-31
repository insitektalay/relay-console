import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

export enum MeetingHardRestriction {
  NO_NEW_TASKS = 'no_new_tasks',
  NO_EXTERNAL_CALLS = 'no_external_calls',
  NO_FILE_MUTATIONS = 'no_file_mutations',
  NO_MESSAGE_NON_PARTICIPANTS = 'no_message_non_participants',
  APPROVAL_REQUIRED_FOR_TASK_CREATION = 'approval_required_for_task_creation',
  APPROVAL_REQUIRED_FOR_EXTERNAL_CALLS = 'approval_required_for_external_calls',
  READ_ONLY_THREAD = 'read_only_thread',
}

@Entity('meeting_rule_packs')
@Index(['workspaceId'])
export class MeetingRulePackEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

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

  @Column({ default: false })
  isSystem: boolean

  @Column()
  createdByUserId: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
