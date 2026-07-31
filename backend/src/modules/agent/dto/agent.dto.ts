import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  IsInt,
  IsIn,
  IsObject,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class RuntimeBindingInputDto {
  @IsString()
  @MaxLength(64)
  runtimeType: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  adapterKind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  routingMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  repoKey?: string | null;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsObject()
  capabilities?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  configMetadata?: Record<string, unknown>;
}

export class CreateAgentDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  workspaceId: string;

  @ApiProperty()
  @IsString()
  role: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupLabel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  capabilities?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workingHoursMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelPrimary?: string | null;

  @ApiPropertyOptional({ enum: ["standard", "html_native"] })
  @IsOptional()
  @IsIn(["standard", "html_native"])
  responsePresentation?: "standard" | "html_native";

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  budgetLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RuntimeBindingInputDto)
  runtimeBinding?: RuntimeBindingInputDto | null;

  @ApiPropertyOptional({
    deprecated: true,
    description: "Compatibility input. Prefer runtimeBinding.",
  })
  @IsOptional()
  claudeBinding?: {
    repoKey: string;
    routingMode?: string;
    model?: string | null;
    isEnabled?: boolean;
  };

  @ApiPropertyOptional()
  @IsOptional()
  schedule?: any;
}

export class UpdateAgentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupLabel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelPrimary?: string | null;

  @ApiPropertyOptional({ enum: ["standard", "html_native"] })
  @IsOptional()
  @IsIn(["standard", "html_native"])
  responsePresentation?: "standard" | "html_native";

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  capabilities?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  budgetLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RuntimeBindingInputDto)
  runtimeBinding?: RuntimeBindingInputDto | null;

  @ApiPropertyOptional({
    deprecated: true,
    description: "Compatibility input. Prefer runtimeBinding.",
  })
  @IsOptional()
  claudeBinding?: {
    repoKey: string;
    routingMode?: string;
    model?: string | null;
    isEnabled?: boolean;
  } | null;
}

export class SetAgentStatusDto {
  @ApiProperty()
  @IsString()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  durationMinutes?: number;
}

export class UpdateScheduleDto {
  @ApiProperty()
  @IsString()
  mode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  shifts?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class AgentFiltersDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class AgentWorkspaceFileDto {
  @ApiProperty()
  @IsString()
  filename: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;
}

export class CreateProvisionedAgentDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  workspaceId: string;

  @ApiProperty()
  @IsString()
  role: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupLabel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelPrimary?: string;

  @ApiPropertyOptional({ enum: ["standard", "html_native"] })
  @IsOptional()
  @IsIn(["standard", "html_native"])
  responsePresentation?: "standard" | "html_native";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  connectionId?: string | null;

  @ApiPropertyOptional({
    description:
      "Client-generated key used to prevent duplicate native agent creation",
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiProperty({ type: () => [AgentWorkspaceFileDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentWorkspaceFileDto)
  files: AgentWorkspaceFileDto[];
}
