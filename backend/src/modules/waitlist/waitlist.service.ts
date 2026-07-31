import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WaitlistEntryEntity } from '../../entities/waitlist-entry.entity'
import { WaitlistSignupDto } from './dto/waitlist-signup.dto'

export interface WaitlistSignupContext {
  origin?: string | null
  userAgent?: string | null
  ipAddress?: string | null
}

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(WaitlistEntryEntity)
    private readonly waitlistEntries: Repository<WaitlistEntryEntity>,
  ) {}

  async createOrRefreshSignup(dto: WaitlistSignupDto, context: WaitlistSignupContext) {
    const email = dto.email.trim().toLowerCase()
    const source = dto.source?.trim() || 'landing_page'

    const rows = await this.waitlistEntries.query(
      `
        INSERT INTO waitlist_entries (
          email,
          source,
          origin,
          "userAgent",
          "ipAddress",
          "submissionCount",
          "lastSubmittedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, 1, now(), now(), now())
        ON CONFLICT (email) DO UPDATE SET
          source = EXCLUDED.source,
          origin = EXCLUDED.origin,
          "userAgent" = EXCLUDED."userAgent",
          "ipAddress" = EXCLUDED."ipAddress",
          "submissionCount" = waitlist_entries."submissionCount" + 1,
          "lastSubmittedAt" = now(),
          "updatedAt" = now()
        RETURNING id, email
      `,
      [email, source, context.origin || null, context.userAgent || null, context.ipAddress || null],
    )

    return {
      id: rows[0]?.id,
      email,
    }
  }
}
