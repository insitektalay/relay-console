import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'
import { IsBcryptCompatiblePassword } from '../password-policy'

export class CompletePasswordResetDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  token: string

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

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  token: string
}
