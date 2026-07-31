import { IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { IsBcryptCompatiblePassword } from '../password-policy'

export class ChangePasswordDto {
  @ApiProperty({
    maxLength: 72,
    description: 'At most 72 bytes when encoded as UTF-8.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  @IsBcryptCompatiblePassword()
  currentPassword: string

  @ApiProperty({
    minLength: 8,
    maxLength: 72,
    description: 'At most 72 bytes when encoded as UTF-8.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @IsBcryptCompatiblePassword()
  newPassword: string
}
