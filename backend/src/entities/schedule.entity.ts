import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm'
import { ShiftRuleEntity } from './shift-rule.entity'

@Entity('schedules')
@Index(['agentId'])
@Index(['teamId'])
@Index(['departmentId'])
export class ScheduleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ nullable: true })
  agentId: string

  @Column({ nullable: true })
  teamId: string

  @Column({ nullable: true })
  departmentId: string

  @Column({ default: 'scheduled' })
  mode: string

  @Column({ default: 'UTC' })
  timezone: string

  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(() => ShiftRuleEntity, (r) => r.schedule)
  shiftRules: ShiftRuleEntity[]
}
