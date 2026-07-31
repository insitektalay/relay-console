import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { CoachingNoteType } from "../../../entities/coaching-note.entity";

export const PERFORMANCE_PERIODS = [
  "daily",
  "weekly",
  "monthly",
  "custom",
] as const;

export class PerformancePeriodQueryDto {
  @ApiPropertyOptional({ enum: PERFORMANCE_PERIODS, default: "daily" })
  @IsOptional()
  @IsString()
  @IsIn(PERFORMANCE_PERIODS)
  period?: string = "daily";
}

export class AgentPerformanceQueryDto extends PerformancePeriodQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  start?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  end?: string;
}

export class PerformancePaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

export class CreateReviewDto {
  @ApiProperty({ enum: PERFORMANCE_PERIODS })
  @IsString()
  @IsIn(PERFORMANCE_PERIODS)
  period: string;

  @ApiProperty()
  @IsDateString()
  periodStart: string;

  @ApiProperty()
  @IsDateString()
  periodEnd: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  summary: string;

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  strengths?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  improvements?: string[];
}

export class CreateCoachingNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  content: string;

  @ApiProperty({ enum: CoachingNoteType })
  @IsString()
  @IsIn(Object.values(CoachingNoteType))
  type: CoachingNoteType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  relatedTaskId?: string;
}
