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
import { WorkspaceEntity } from './workspace.entity'
import { DepartmentEntity } from './department.entity'

@Entity('companies')
export class CompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column()
  workspaceId: string

  @Column({ nullable: true })
  avatarUrl: string

  @Column({ nullable: true })
  description: string

  @Column({ nullable: true })
  industry: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => WorkspaceEntity, (w) => w.companies)
  @JoinColumn({ name: 'workspaceId' })
  workspace: WorkspaceEntity

  @OneToMany(() => DepartmentEntity, (d) => d.company)
  departments: DepartmentEntity[]
}
