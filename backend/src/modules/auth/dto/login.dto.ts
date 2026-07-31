import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBcryptCompatiblePassword } from '../password-policy'

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({
    example: 'correct-horse-battery-staple',
    maxLength: 72,
    description: 'At most 72 bytes when encoded as UTF-8.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  @IsBcryptCompatiblePassword()
  password: string

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
