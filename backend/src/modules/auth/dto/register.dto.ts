import { IsEmail, IsIn, IsString, MinLength, MaxLength, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBcryptCompatiblePassword } from '../password-policy'

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string

  @ApiProperty({
    example: 'correct-horse-battery-staple',
    minLength: 8,
    maxLength: 72,
    description: 'At most 72 bytes when encoded as UTF-8.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @IsBcryptCompatiblePassword()
  password: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string

  @ApiPropertyOptional({
    description: 'Invite code required while ClawChat web is in private beta.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  inviteCode?: string

  @ApiPropertyOptional({ example: 'iPhone' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceName?: string

  @ApiPropertyOptional({ enum: ['iOS', 'iPadOS', 'macOS'] })
  @IsOptional()
  @IsIn(['iOS', 'iPadOS', 'macOS'])
  platform?: string
}
