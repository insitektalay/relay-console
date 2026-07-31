import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { Request } from 'express'
import { Public } from '../../common/decorators/public.decorator'
import { getTrustedClientIp } from '../security/client-ip'
import { WaitlistSignupDto } from './dto/waitlist-signup.dto'
import { WaitlistService } from './waitlist.service'

const WAITLIST_SIGNUP_RATE_LIMIT = { default: { limit: 10, ttl: 60_000 } }

@ApiTags('waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Public()
  @Throttle(WAITLIST_SIGNUP_RATE_LIMIT)
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save a public landing-page waitlist signup' })
  @ApiResponse({ status: 200, description: 'Waitlist signup saved' })
  async signup(@Body() dto: WaitlistSignupDto, @Req() req: Request) {
    const entry = await this.waitlistService.createOrRefreshSignup(dto, {
      origin: req.get('origin') ?? null,
      userAgent: req.get('user-agent') ?? null,
      ipAddress: getRequestIp(req),
    })

    return {
      message: 'Waitlist signup saved.',
      id: entry.id,
    }
  }
}

function getRequestIp(req: Request) {
  return getTrustedClientIp(req)
}
