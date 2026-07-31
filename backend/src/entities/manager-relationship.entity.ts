import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

@Entity('manager_relationships')
@Index(['managerId', 'reportId'], { unique: true })
@Index(['managerId'])
@Index(['reportId'])
export class ManagerRelationshipEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  managerId: string

  @Column()
  reportId: string

  @CreateDateColumn()
  createdAt: Date
}
