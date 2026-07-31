import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm'
import { DepartmentEntity } from './department.entity'
import { AgentEntity } from './agent.entity'

@Entity('teams')
export class TeamEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column()
  departmentId: string

  @Column({ nullable: true })
  leadAgentId: string

  @Column({ nullable: true })
  description: string

  @Column({ default: '#30D158' })
  color: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => DepartmentEntity, (d) => d.teams)
  @JoinColumn({ name: 'departmentId' })
  department: DepartmentEntity

  @OneToMany(() => AgentEntity, (a) => a.team)
  agents: AgentEntity[]
}
