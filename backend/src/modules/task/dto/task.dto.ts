import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

const TASK_STATUS_VALUES = [
  'queued',
  'dispatched',
  'running',
  'blocked',
  'completed',
  'failed',
  'cancelled',
] as const

export class TaskQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workspaceId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(TASK_STATUS_VALUES)
  status?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetType?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  threadId?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20
}

export class CreateTaskBodyDto {
  @ApiProperty()
  @IsString()
  title: string

  @ApiProperty()
  @IsString()
  workspaceId: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(TASK_STATUS_VALUES)
  status?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedAgentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string

  @ApiProperty({ enum: ['direct', 'team', 'department', 'agent_to_agent'] })
  @IsString()
  @IsIn(['direct', 'team', 'department', 'agent_to_agent'])
  targetType: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  threadId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetAgentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetAgentTwoId?: string

  @ApiProperty()
  @IsString()
  messageBody: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  createdByAgentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueAt?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledFor?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string

  @ApiPropertyOptional({
    enum: [
      'none',
      'every_15_minutes',
      'every_30_minutes',
      'every_45_minutes',
      'hourly',
      'daily',
      'weekdays',
      'weekly',
      'monthly',
    ],
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'none',
    'every_15_minutes',
    'every_30_minutes',
    'every_45_minutes',
    'hourly',
    'daily',
    'weekdays',
    'weekly',
    'monthly',
  ])
  recurrenceRule?: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  tags?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  estimatedMinutes?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  budgetUsed?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean

}

export class UpdateTaskBodyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedAgentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string

  @ApiPropertyOptional({ enum: ['direct', 'team', 'department', 'agent_to_agent'] })
  @IsOptional()
  @IsString()
  @IsIn(['direct', 'team', 'department', 'agent_to_agent'])
  targetType?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  threadId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetAgentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetAgentTwoId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  messageBody?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueAt?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledFor?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string

  @ApiPropertyOptional({
    enum: [
      'none',
      'every_15_minutes',
      'every_30_minutes',
      'every_45_minutes',
      'hourly',
      'daily',
      'weekdays',
      'weekly',
      'monthly',
    ],
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'none',
    'every_15_minutes',
    'every_30_minutes',
    'every_45_minutes',
    'hourly',
    'daily',
    'weekdays',
    'weekly',
    'monthly',
  ])
  recurrenceRule?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean
}

export class UpdateTaskStatusBodyDto {
  @ApiProperty({
    enum: TASK_STATUS_VALUES,
  })
  @IsString()
  @IsIn(TASK_STATUS_VALUES)
  status: string
}
