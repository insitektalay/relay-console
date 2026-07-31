import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { COMPILER_MODES } from "../agent-documentation.constants";
import {
  MARKETPLACE_INSTALL_ROLES,
  type MarketplaceInstallRole,
} from "../../marketplace/marketplace-install-role";

export class CreateLinkedApplicationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @IsString()
  repoPath!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  repoKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;
}

export class UpdateLinkedApplicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  repoPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  repoKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;
}

export class ForkBlueprintDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;
}

export class UpdateBlueprintDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  changelog?: string;
}

export class GenerateDocumentationProposalDto {
  @ApiProperty()
  @IsUUID()
  linkedApplicationId!: string;

  @ApiProperty({ enum: COMPILER_MODES })
  @IsIn(COMPILER_MODES)
  mode!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  blueprintIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  packId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ApplyProposalDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID("4", { each: true })
  fileIds!: string[];
}

export class SyncLibraryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetFolder?: string;
}

export class CreateAgentInstallDto {
  @ApiProperty()
  @IsUUID()
  packId!: string;

  @ApiProperty()
  @IsUUID()
  agentId!: string;

  @ApiProperty({ enum: MARKETPLACE_INSTALL_ROLES })
  @IsIn(MARKETPLACE_INSTALL_ROLES)
  role!: MarketplaceInstallRole;
}

export class ExportStateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  packId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  snapshotKind?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  state?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  exportToLibrary?: boolean;
}
