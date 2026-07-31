import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { ThreadEntity } from "./thread.entity";

@Entity("thread_wrap_up_reports")
@Index(["threadSessionId"], { unique: true })
@Index(["threadId", "createdAt"])
@Index(["workspaceId", "createdAt"])
export class ThreadWrapUpReportEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  threadId: string;

  @Column("uuid")
  threadSessionId: string;

  @Column({ type: "int", default: 1 })
  threadSessionSequenceNumber: number;

  @Column()
  workspaceId: string;

  @Column({ nullable: true })
  teamId: string | null;

  @Column()
  title: string;

  @Column()
  fileName: string;

  @Column({ default: "runtime_structured_job" })
  provider: string;

  @Column()
  model: string;

  @Column({ default: "generating" })
  status: string;

  @Column({ type: "text", nullable: true })
  errorMessage: string | null;

  @Column({ type: "timestamptz", nullable: true })
  completedAt: Date | null;

  @Column({ type: "text" })
  markdown: string;

  @Column({ type: "jsonb", default: "{}" })
  structuredData: Record<string, unknown>;

  @Column({ type: "int", default: 0 })
  messageCount: number;

  @Column("uuid", { nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => ThreadEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "threadId" })
  thread: ThreadEntity;
}
