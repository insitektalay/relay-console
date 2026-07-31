import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  RELAY_ATTACHMENT_ALLOWED_CONTENT_TYPES,
  RELAY_ATTACHMENT_MAX_BYTES,
} from "../attachment-upload-policy";

export class RegisterClientInstallationDto {
  @IsString() deploymentKey: string;
  @IsOptional() @IsString() workspaceId?: string;
  @IsString() installationPublicId: string;
  @IsIn(["relay_console_swift", "ios", "web"]) clientKind: string;
  @IsString() clientVersion: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsObject() capabilities?: Record<string, unknown>;
}

export class CreateSyncLinkDto {
  @IsString() deploymentKey: string;
  @IsString() installationId: string;
  @IsString() workspaceId: string;
  @IsString() localWorkspaceId: string;
  @IsIn(["none", "metadata_only", "all_supported"]) attachmentPolicy: string;
  @IsBoolean() offlineRetention: boolean;
}

export class CreateImportDto {
  @IsString() syncLinkId: string;
  @IsString() manifestKey: string;
  @IsString() schemaVersion: string;
  @IsObject() counts: Record<string, number>;
  @IsArray() exclusions: unknown[];
  @IsBoolean() cloudStorageConsent: boolean;
  @IsString() backupCheckpoint: string;
}

export class SyncRecordDto {
  @IsString() objectType: string;
  @IsString() objectId: string;
  @IsOptional() @IsIn(["upsert", "delete"]) operation?: "upsert" | "delete";
  @IsOptional() baseServerVersion?: string | number | null;
  @IsObject() payload: Record<string, unknown>;
  @IsOptional() @IsArray() dependencies?: string[];
  @IsOptional() @IsBoolean() historical?: boolean;
}

export class ImportBatchDto {
  @IsString() batchKey: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncRecordDto)
  records: SyncRecordDto[];
  @IsOptional() @IsBoolean() finalBatch?: boolean;
}

export class MutationDto extends SyncRecordDto {
  @IsString() clientMutationId: string;
}

export class MutationBatchDto {
  @IsString() installationId: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MutationDto)
  mutations: MutationDto[];
}

export class AttachmentUploadDto {
  @IsUUID() workspaceId: string;
  @IsUUID() installationId: string;
  @IsString() @MinLength(1) @MaxLength(160) sourceAttachmentId: string;
  @IsString() @MinLength(1) @MaxLength(255) fileName: string;
  @IsIn(RELAY_ATTACHMENT_ALLOWED_CONTENT_TYPES) contentType: string;
  @IsInt() @Min(1) @Max(RELAY_ATTACHMENT_MAX_BYTES) byteSize: number;
  @Matches(/^[a-fA-F0-9]{64}$/) sha256: string;
  @IsObject() provenance: Record<string, unknown>;
}

export class ChangeFeedQueryDto {
  @IsOptional() @IsString() after?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}
