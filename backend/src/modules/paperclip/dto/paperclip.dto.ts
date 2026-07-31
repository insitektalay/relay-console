import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class CreatePaperclipConnectionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  displayName: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  baseUrl: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  companyId: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bearerToken: string
}

export class UpdatePaperclipConnectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  displayName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  baseUrl?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  companyId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bearerToken?: string
}

export class PutThreadPaperclipLinkDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  connectionId: string

  @ApiProperty({ enum: ['issue', 'approval'] })
  @IsString()
  @IsIn(['issue', 'approval'])
  objectType: 'issue' | 'approval'

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  objectRef: string
}
