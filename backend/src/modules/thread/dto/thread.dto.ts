import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateThreadDto {
  @ApiProperty()
  @IsString()
  title: string

  @ApiProperty()
  @IsString()
  workspaceId: string

  @ApiProperty()
  @IsString()
  type: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  participantIds?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  agentIds?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string
}

// Standalone DTO for the workspace-scoped route (POST /workspaces/:wsId/threads).
// workspaceId is NOT in the body — it comes from the URL param — so this class
// intentionally does NOT extend CreateThreadDto to avoid inheriting its required
// @IsString() workspaceId validator.
export class CreateWorkspaceThreadDto {
  @ApiProperty()
  @IsString()
  title: string

  @ApiProperty()
  @IsString()
  type: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workspaceId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  participantIds?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  agentIds?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string

  // Legacy iOS snake_case aliases
  @ApiPropertyOptional({ deprecated: true, description: 'Legacy iOS alias for participantIds' })
  @IsOptional()
  @IsArray()
  participant_ids?: string[]

  @ApiPropertyOptional({ deprecated: true, description: 'Legacy iOS alias for agentIds' })
  @IsOptional()
  @IsArray()
  agent_ids?: string[]

  @ApiPropertyOptional({ deprecated: true, description: 'Legacy iOS alias for teamId' })
  @IsOptional()
  @IsString()
  team_id?: string

  @ApiPropertyOptional({ deprecated: true, description: 'Legacy iOS alias for departmentId' })
  @IsOptional()
  @IsString()
  department_id?: string
}

export class UpdateThreadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMuted?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  agentIds?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string
}
