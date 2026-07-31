import { ApiProperty } from '@nestjs/swagger'

export class AuthTokensResponseDto {
  @ApiProperty()
  accessToken: string

  @ApiProperty()
  refreshToken: string

  @ApiProperty()
  expiresIn: number
}

export class SessionUserDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  email: string

  @ApiProperty()
  name: string

  @ApiProperty({ required: false, nullable: true })
  avatarUrl?: string | null

  @ApiProperty({ required: false, nullable: true })
  emailVerifiedAt?: Date | null

  @ApiProperty()
  createdAt: Date

  @ApiProperty()
  updatedAt: Date
}

export class WebSessionResponseDto {
  @ApiProperty({ type: SessionUserDto })
  user: SessionUserDto

  @ApiProperty()
  csrfToken: string
}

export class CsrfResponseDto {
  @ApiProperty()
  csrfToken: string
}

export class WsTicketRequestDto {
  @ApiProperty()
  workspaceId: string
}

export class WsTicketResponseDto {
  @ApiProperty()
  ticket: string

  @ApiProperty()
  expiresIn: number
}

export class LogoutResponseDto {
  @ApiProperty()
  success: boolean
}
