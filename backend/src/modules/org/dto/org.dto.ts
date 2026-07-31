import { IsString, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  name: string

  @ApiProperty()
  @IsString()
  workspaceId: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string
}

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string
}

export class CreateManagerRelationshipDto {
  @ApiProperty()
  @IsString()
  managerId: string

  @ApiProperty()
  @IsString()
  reportId: string
}
