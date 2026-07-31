import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { ScheduleEntity } from './schedule.entity'

@Entity('shift_rules')
@Index(['scheduleId'])
export class ShiftRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  scheduleId: string

  @Column({ type: 'smallint' })
  dayOfWeek: number

  @Column({ type: 'time' })
  startTime: string

  @Column({ type: 'time' })
  endTime: string

  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => ScheduleEntity, (s) => s.shiftRules)
  @JoinColumn({ name: 'scheduleId' })
  schedule: ScheduleEntity
}
