import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const INCIDENT_STATUSES = [
  "open",
  "investigating",
  "mitigated",
  "resolved",
  "closed",
] as const;

export const INCIDENT_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

const OptionalRelationshipId = () => (target: object, propertyKey: string) => {
  IsOptional()(target, propertyKey);
  IsString()(target, propertyKey);
  MaxLength(255)(target, propertyKey);
};

const OptionalBoundedStringArray = () =>
  (target: object, propertyKey: string) => {
    IsOptional()(target, propertyKey);
    IsArray()(target, propertyKey);
    ArrayMaxSize(50)(target, propertyKey);
    IsString({ each: true })(target, propertyKey);
    MaxLength(100, { each: true })(target, propertyKey);
    Matches(/^[^,]*$/, {
      each: true,
      message: `${propertyKey} entries must not contain commas`,
    })(target, propertyKey);
  };

export class IncidentQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workspaceId: string;

  @ApiPropertyOptional({ enum: INCIDENT_STATUSES })
  @IsOptional()
  @IsString()
  @IsIn(INCIDENT_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: INCIDENT_SEVERITIES })
  @IsOptional()
  @IsString()
  @IsIn(INCIDENT_SEVERITIES)
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  agentId?: string;

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

export class CreateIncidentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  description: string;

  @ApiProperty({ enum: INCIDENT_SEVERITIES })
  @IsString()
  @IsIn(INCIDENT_SEVERITIES)
  severity: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workspaceId: string;

  @ApiPropertyOptional({ nullable: true })
  @OptionalRelationshipId()
  agentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalRelationshipId()
  teamId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalRelationshipId()
  taskId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalRelationshipId()
  runId?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @OptionalBoundedStringArray()
  tags?: string[] | null;

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @OptionalBoundedStringArray()
  affectedSystems?: string[] | null;
}

export class UpdateIncidentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  description?: string;

  @ApiPropertyOptional({ enum: INCIDENT_SEVERITIES })
  @IsOptional()
  @IsString()
  @IsIn(INCIDENT_SEVERITIES)
  severity?: string;

  @ApiPropertyOptional({ nullable: true })
  @OptionalRelationshipId()
  agentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalRelationshipId()
  teamId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalRelationshipId()
  taskId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalRelationshipId()
  runId?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: 50, nullable: true })
  @OptionalBoundedStringArray()
  tags?: string[] | null;

  @ApiPropertyOptional({ type: [String], maxItems: 50, nullable: true })
  @OptionalBoundedStringArray()
  affectedSystems?: string[] | null;
}

export class ResolveIncidentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string;
}
