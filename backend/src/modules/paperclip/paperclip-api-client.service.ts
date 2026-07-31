import { Injectable } from '@nestjs/common'
import { PaperclipConnectionEntity } from '../../entities/paperclip-connection.entity'
import {
  PaperclipApprovalSummary,
  PaperclipIssueSummary,
} from './paperclip.types'

const PAPERCLIP_TIMEOUT_MS = 5000

export class PaperclipApiError extends Error {
  constructor(
    readonly code:
      | 'invalid_base_url'
      | 'unauthorized'
      | 'not_found'
      | 'unavailable'
      | 'timeout'
      | 'company_mismatch'
      | 'upstream_error',
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

@Injectable()
export class PaperclipApiClientService {
  normalizeBaseUrl(input: string): string {
    const trimmed = input.trim()
    let parsed: URL
    try {
      parsed = new URL(trimmed)
    } catch {
      throw new PaperclipApiError(
        'invalid_base_url',
        'Paperclip base URL must be a valid absolute URL.',
      )
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new PaperclipApiError(
        'invalid_base_url',
        'Paperclip base URL must start with http:// or https://.',
      )
    }

    let pathname = parsed.pathname.replace(/\/+$/, '')
    if (pathname.endsWith('/api')) {
      pathname = pathname.slice(0, -4)
    }
    parsed.pathname = pathname || '/'
    parsed.search = ''
    parsed.hash = ''

    const normalized = parsed.toString().replace(/\/$/, '')
    return normalized
  }

  async validateConnection(input: {
    baseUrl: string
    companyId: string
    bearerToken: string
  }): Promise<{ companyId: string; companyName: string | null }> {
    const baseUrl = this.normalizeBaseUrl(input.baseUrl)
    const response = await this.requestJson<{
      id?: string
      name?: string
    }>({
      baseUrl,
      bearerToken: input.bearerToken,
      path: `/companies/${encodeURIComponent(input.companyId)}`,
    })

    return {
      companyId: String(response.id ?? input.companyId),
      companyName: response.name?.trim() || null,
    }
  }

  async fetchIssue(
    connection: PaperclipConnectionEntity,
    bearerToken: string,
    objectRef: string,
  ): Promise<PaperclipIssueSummary> {
    const issue = await this.requestJson<any>({
      baseUrl: connection.baseUrl,
      bearerToken,
      path: `/issues/${encodeURIComponent(objectRef)}`,
    })

    return {
      kind: 'issue',
      id: String(issue.id),
      identifier: issue.identifier ? String(issue.identifier) : null,
      title: String(issue.title ?? '').trim(),
      status: String(issue.status ?? '').trim(),
      priority: issue.priority ? String(issue.priority) : null,
      assigneeAgentId: issue.assigneeAgentId
        ? String(issue.assigneeAgentId)
        : null,
      projectName: issue.project?.name ? String(issue.project.name) : null,
      updatedAt: this.toIsoString(issue.updatedAt),
      deepLinkUrl: `${connection.baseUrl}/issues/${encodeURIComponent(String(issue.id))}`,
      companyId: issue.companyId ? String(issue.companyId) : null,
    }
  }

  async fetchApproval(
    connection: PaperclipConnectionEntity,
    bearerToken: string,
    approvalId: string,
  ): Promise<PaperclipApprovalSummary> {
    const approval = await this.requestJson<any>({
      baseUrl: connection.baseUrl,
      bearerToken,
      path: `/approvals/${encodeURIComponent(approvalId)}`,
    })

    const relatedIssues = await this.requestJson<any[]>({
      baseUrl: connection.baseUrl,
      bearerToken,
      path: `/approvals/${encodeURIComponent(approvalId)}/issues`,
    })

    const approvalType = String(approval.type ?? '').trim()
    return {
      kind: 'approval',
      id: String(approval.id),
      title: this.formatApprovalTitle(approvalType),
      approvalType,
      status: String(approval.status ?? '').trim(),
      requestedByAgentId: approval.requestedByAgentId
        ? String(approval.requestedByAgentId)
        : null,
      decisionNote: approval.decisionNote ? String(approval.decisionNote) : null,
      linkedIssueCount: Array.isArray(relatedIssues) ? relatedIssues.length : 0,
      decidedAt: approval.decidedAt ? this.toIsoString(approval.decidedAt) : null,
      updatedAt: this.toIsoString(approval.updatedAt),
      deepLinkUrl: `${connection.baseUrl}/approvals/${encodeURIComponent(String(approval.id))}`,
      companyId: approval.companyId ? String(approval.companyId) : null,
    }
  }

  private async requestJson<T>(input: {
    baseUrl: string
    bearerToken: string
    path: string
  }): Promise<T> {
    const normalizedBaseUrl = this.normalizeBaseUrl(input.baseUrl)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PAPERCLIP_TIMEOUT_MS)

    try {
      const response = await fetch(`${normalizedBaseUrl}/api${input.path}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${input.bearerToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      })

      if (response.status === 401 || response.status === 403) {
        throw new PaperclipApiError(
          'unauthorized',
          'Paperclip rejected the supplied credentials.',
          response.status,
        )
      }
      if (response.status === 404) {
        throw new PaperclipApiError(
          'not_found',
          'The requested Paperclip resource was not found.',
          404,
        )
      }
      if (!response.ok) {
        throw new PaperclipApiError(
          'upstream_error',
          `Paperclip request failed with status ${response.status}.`,
          response.status,
        )
      }

      return (await response.json()) as T
    } catch (error) {
      if (error instanceof PaperclipApiError) {
        throw error
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new PaperclipApiError(
          'timeout',
          'Paperclip did not respond before the timeout elapsed.',
        )
      }
      throw new PaperclipApiError(
        'unavailable',
        'Paperclip is unavailable right now.',
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  private toIsoString(value: string | Date | null | undefined) {
    if (!value) {
      return new Date().toISOString()
    }

    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
  }

  private formatApprovalTitle(type: string) {
    if (!type) {
      return 'Approval'
    }
    return `${type
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')} Approval`
  }
}
