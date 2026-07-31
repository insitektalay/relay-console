import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsIn,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class SearchMessagesQueryDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q: string;

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

export class MessageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional({
    description:
      "Optional wrapped thread session to read instead of the active session",
  })
  @IsOptional()
  @IsUUID()
  threadSessionId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 50;
}

export class LatestMessageQueryDto {
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;

  @ApiPropertyOptional({
    description: "Optional message id or ISO timestamp cursor for older messages",
  })
  @IsOptional()
  @IsString()
  before?: string;
}

export class CreateMessageBodyDto {
  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ default: "text" })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  replyToId?: string;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  attachments?: Record<string, unknown>[];

  @ApiPropertyOptional({ enum: ["ask_for_approval", "approve_for_me", "full_access"] })
  @IsOptional()
  @IsIn(["ask_for_approval", "approve_for_me", "full_access"])
  runtimeApprovalMode?: "ask_for_approval" | "approve_for_me" | "full_access";

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  runtimeDispatchConfirmed?: boolean;
}

export class UpdateTeamRelayDto {
  @ApiProperty({ minimum: 1, maximum: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  replyLimit: number;
}

export class BeginOpenClawAttachmentUploadDto {
  @ApiProperty()
  @IsString()
  threadId: string;

  @ApiProperty()
  @IsString()
  filename: string;

  @ApiProperty()
  @IsString()
  mimeType: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  sizeBytes: number;

  @ApiProperty()
  @IsString()
  kind: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  totalChunks: number;
}

export class UploadOpenClawAttachmentChunkDto {
  @ApiProperty()
  @IsString()
  threadId: string;

  @ApiProperty()
  @IsString()
  attachmentId: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  chunkIndex: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  totalChunks: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  offsetBytes: number;

  @ApiProperty()
  @IsString()
  chunkBase64: string;
}

export class CompleteOpenClawAttachmentUploadDto {
  @ApiProperty()
  @IsString()
  threadId: string;

  @ApiProperty()
  @IsString()
  attachmentId: string;
}

export class UpdateMessageBodyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;
}
