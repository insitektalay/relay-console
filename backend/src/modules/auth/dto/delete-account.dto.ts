import { ApiProperty } from '@nestjs/swagger'
import { Equals, IsString, MaxLength, MinLength } from 'class-validator'
import { IsBcryptCompatiblePassword } from '../password-policy'

export class DeleteAccountDto {
  @ApiProperty({
    maxLength: 72,
    description: 'At most 72 bytes when encoded as UTF-8.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  @IsBcryptCompatiblePassword()
  currentPassword: string

  @ApiProperty({ example: 'DELETE' })
  @IsString()
  @Equals('DELETE')
  confirmation: string
}
