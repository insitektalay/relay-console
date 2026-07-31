import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { IsHttpsExternalArtifactUrl } from "../artifact-url-policy";

const ARTIFACT_KINDS = [
  "document",
  "image",
  "video",
  "audio",
  "data",
  "folder",
  "unknown",
] as const;

const SOURCE_PLATFORMS = ["macos", "windows", "linux", "unknown"] as const;
const PRESENTATION_STATES = [
  "available",
  "unavailable",
  "moved",
  "expired",
  "deleted",
  "permission_denied",
] as const;

export class WorkspaceArtifactSyncItemDto {
  @IsString()
  @MaxLength(200)
  id: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsIn(ARTIFACT_KINDS)
  kind: (typeof ARTIFACT_KINDS)[number];

  @IsString()
  @MaxLength(80)
  sourceKind: string;

  @IsString()
  @MaxLength(1200)
  relativePath: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  fileExtension?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  byteCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  updatedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  agentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  taskId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  agentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  cronJobId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cronJobName?: string;

  @IsBoolean()
  isReadableText: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  harnessId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  harnessType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  harnessLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  contentHash?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  @IsHttpsExternalArtifactUrl()
  externalUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalProvider?: string;

  @IsOptional()
  @IsIn(PRESENTATION_STATES)
  presentationState?: (typeof PRESENTATION_STATES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  presentationReason?: string;
}

export class WorkspaceArtifactSyncDto {
  @IsOptional()
  @IsUUID()
  sourceInstallationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  machineId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  machineLabel?: string;

  @IsOptional()
  @IsIn(SOURCE_PLATFORMS)
  platform?: (typeof SOURCE_PLATFORMS)[number];

  @IsArray()
  @ArrayMaxSize(5_000)
  @ValidateNested({ each: true })
  @Type(() => WorkspaceArtifactSyncItemDto)
  artifacts: WorkspaceArtifactSyncItemDto[];
}
