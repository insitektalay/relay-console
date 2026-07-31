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
import { CompanyEntity } from './company.entity'
import { TeamEntity } from './team.entity'

@Entity('departments')
export class DepartmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column({ nullable: true })
  workspaceId: string

  @Column({ nullable: true })
  companyId: string

  @Column({ nullable: true })
  headAgentId: string

  @Column({ nullable: true })
  description: string

  @Column({ default: '#0A84FF' })
  color: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => CompanyEntity, (c) => c.departments)
  @JoinColumn({ name: 'companyId' })
  company: CompanyEntity

  @OneToMany(() => TeamEntity, (t) => t.department)
  teams: TeamEntity[]
}
