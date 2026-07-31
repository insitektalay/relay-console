import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class WorkspaceLibraryListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  folder?: string;
}

export class WorkspaceLibraryReadQueryDto extends WorkspaceLibraryListQueryDto {
  @ApiProperty()
  @IsString()
  filename: string;
}

export class WorkspaceAgentWorkspaceListQueryDto extends WorkspaceLibraryListQueryDto {
  @ApiProperty()
  @IsString()
  agentId: string;
}

export class WorkspaceAgentWorkspaceReadQueryDto extends WorkspaceAgentWorkspaceListQueryDto {
  @ApiProperty()
  @IsString()
  filename: string;
}

export class WorkspaceLibraryFileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  filename: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: ["utf8", "base64"] })
  @IsOptional()
  @IsIn(["utf8", "base64"])
  contentEncoding?: "utf8" | "base64";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contentType?: string;
}

export class WorkspaceLibraryWriteDto {
  @ApiProperty()
  @IsString()
  folder: string;

  @ApiProperty({ type: [WorkspaceLibraryFileDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => WorkspaceLibraryFileDto)
  files: WorkspaceLibraryFileDto[];
}

export class WorkspaceLibraryCreateFolderDto {
  @ApiProperty()
  @IsString()
  folder: string;
}

export class WorkspaceLibraryDeleteDto extends WorkspaceLibraryReadQueryDto {}

export class WorkspaceLibraryDeleteFolderDto {
  @ApiProperty()
  @IsString()
  folder: string;
}

export class WorkspaceAgentWorkspaceCreateFolderDto extends WorkspaceLibraryCreateFolderDto {
  @ApiProperty()
  @IsString()
  agentId: string;
}

export class WorkspaceAgentWorkspaceWriteDto extends WorkspaceLibraryWriteDto {
  @ApiProperty()
  @IsString()
  agentId: string;
}

export class WorkspaceAgentWorkspaceDeleteDto extends WorkspaceLibraryDeleteDto {
  @ApiProperty()
  @IsString()
  agentId: string;
}

export class WorkspaceAgentWorkspaceDeleteFolderDto extends WorkspaceLibraryDeleteFolderDto {
  @ApiProperty()
  @IsString()
  agentId: string;
}

export class WorkspaceHermesWorkspaceListQueryDto {
  @ApiProperty()
  @IsString()
  agentId: string;

  @ApiProperty({ enum: ["agent", "shared", "sessions", "project"] })
  @IsIn(["agent", "shared", "sessions", "project"])
  folder: "agent" | "shared" | "sessions" | "project";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  path?: string;
}

export class WorkspaceHermesWorkspaceReadQueryDto extends WorkspaceHermesWorkspaceListQueryDto {
  @ApiProperty()
  @IsString()
  filename: string;
}

export class WorkspaceHermesWorkspaceFileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  filename: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: ["utf8", "base64"] })
  @IsOptional()
  @IsIn(["utf8", "base64"])
  encoding?: "utf8" | "base64";
}

export class WorkspaceHermesWorkspaceWriteDto extends WorkspaceHermesWorkspaceListQueryDto {
  @ApiProperty({ type: [WorkspaceHermesWorkspaceFileDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => WorkspaceHermesWorkspaceFileDto)
  files: WorkspaceHermesWorkspaceFileDto[];
}

export class WorkspaceHermesWorkspaceCreateFolderDto extends WorkspaceHermesWorkspaceListQueryDto {
  @ApiProperty()
  @IsString()
  filename: string;
}

export class WorkspaceHermesWorkspaceDeleteDto extends WorkspaceHermesWorkspaceReadQueryDto {}
