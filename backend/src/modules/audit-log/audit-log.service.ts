import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLogEntity } from '../../entities'
import {
  AUDIT_ACTOR_ID_MAX_LENGTH,
  AUDIT_ACTOR_TYPE_MAX_LENGTH,
  AUDIT_EVENT_TYPE_MAX_LENGTH,
  AUDIT_RESOURCE_ID_MAX_LENGTH,
  AUDIT_RESOURCE_TYPE_MAX_LENGTH,
  AUDIT_USER_AGENT_MAX_LENGTH,
  sanitizeAuditMetadata,
  sanitizeAuditText,
  tokenizeAuditIdentifier,
  tokenizeAuditNetwork,
} from './audit-privacy'

export interface AuditLogRequestContext {
  ipAddress?: string | null
  userAgent?: string | null
}

export interface AuditLogInput extends AuditLogRequestContext {
  actorType: string
  actorId?: string | null
  workspaceId?: string | null
  eventType: string
  resourceType?: string | null
  resourceId?: string | null
  metadata?: Record<string, unknown> | null
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name)
  private readonly ignoredEventTypes = new Set([
    'realtime.websocket.disconnected',
    'auth.web.login.success',
    'auth.login.success',
    'bridge.device.auth.success',
    'marketplace.approval_profile.selected',
    'marketplace.pack.previewed',
    'marketplace.runtime_format.selected',
    'marketplace.outlook.approval.skipped',
  ])

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
    private readonly config: ConfigService,
  ) {}

  async record(input: AuditLogInput) {
    if (this.ignoredEventTypes.has(input.eventType)) {
      return null
    }

    const actorType =
      sanitizeAuditText(input.actorType, AUDIT_ACTOR_TYPE_MAX_LENGTH) ??
      'unknown'
    const eventType =
      sanitizeAuditText(input.eventType, AUDIT_EVENT_TYPE_MAX_LENGTH) ??
      'audit.invalid'
    const secret =
      this.config.get<string>('AUDIT_IDENTIFIER_HASH_SECRET')?.trim() || null

    try {
      return await this.auditLogRepository.save(
        this.auditLogRepository.create({
          actorType,
          actorId:
            actorType === 'anonymous'
              ? tokenizeAuditIdentifier(secret, 'account', input.actorId)
              : sanitizeAuditText(input.actorId, AUDIT_ACTOR_ID_MAX_LENGTH),
          workspaceId: input.workspaceId ?? null,
          eventType,
          resourceType: sanitizeAuditText(
            input.resourceType,
            AUDIT_RESOURCE_TYPE_MAX_LENGTH,
          ),
          resourceId: sanitizeAuditText(
            input.resourceId,
            AUDIT_RESOURCE_ID_MAX_LENGTH,
          ),
          ipAddress: tokenizeAuditNetwork(secret, input.ipAddress),
          userAgent: sanitizeAuditText(
            input.userAgent,
            AUDIT_USER_AGENT_MAX_LENGTH,
          ),
          metadata: sanitizeAuditMetadata(input.metadata),
        }),
      )
    } catch {
      this.logger.warn({
        event: 'audit.write_failed',
        eventType,
      })
      return null
    }
  }

  async listWorkspaceAuditLogs(
    workspaceId: string,
    page: number = 1,
    pageSize: number = 50,
  ) {
    const [data, total] = await this.auditLogRepository.findAndCount({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return {
      data,
      total,
      page,
      pageSize,
      hasMore: total > page * pageSize,
    }
  }

  async getWorkspaceSecurityMetrics(workspaceId: string, hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    const rows = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.eventType', 'eventType')
      .addSelect('COUNT(*)::int', 'count')
      .where('audit."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('audit."createdAt" >= :since', { since })
      .groupBy('audit.eventType')
      .getRawMany<{ eventType: string; count: number }>()

    const counts = Object.fromEntries(
      rows.map((row) => [row.eventType, Number(row.count)]),
    )

    return {
      windowHours: hours,
      authFailures: counts['auth.login.failed'] ?? 0,
      bridgeEnrollmentFailures: counts['bridge.enrollment.failed'] ?? 0,
      websocketDisconnects: counts['realtime.websocket.disconnected'] ?? 0,
      crossWorkspaceAccessAttempts:
        counts['security.cross_workspace_access.denied'] ?? 0,
      auditEvents: rows.reduce((sum, row) => sum + Number(row.count), 0),
    }
  }
}
