import { IsString, IsOptional, IsEnum } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateWorkspaceDto {
  @ApiProperty()
  @IsString()
  name: string

  @ApiPropertyOptional({ enum: ['personal', 'business'] })
  @IsOptional()
  @IsEnum(['personal', 'business'])
  type?: string = 'business'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string
}

export class UpdateWorkspaceDto {
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
  avatarUrl?: string
}
