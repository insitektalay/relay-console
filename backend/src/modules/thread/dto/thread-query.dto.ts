import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class SearchThreadsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workspaceId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string

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

export class ThreadAnalyticsQueryDto {
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  activityGapMinutes?: number = 30

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentRepeatSessionId?: string
}

export class AgentWorkCalendarQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string

  @ApiPropertyOptional({ enum: ['business', 'family', 'personal'] })
  @IsOptional()
  @IsIn(['business', 'family', 'personal'])
  groupType?: string

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  activityGapMinutes?: number = 30

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timeZone?: string
}
