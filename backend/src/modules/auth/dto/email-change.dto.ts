import { ApiProperty } from '@nestjs/swagger'
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { IsBcryptCompatiblePassword } from '../password-policy'

export class RequestEmailChangeDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  newEmail: string

  @ApiProperty({
    maxLength: 72,
    description: 'At most 72 bytes when encoded as UTF-8.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  @IsBcryptCompatiblePassword()
  currentPassword: string
}

export class CompleteEmailChangeDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  token: string
}
