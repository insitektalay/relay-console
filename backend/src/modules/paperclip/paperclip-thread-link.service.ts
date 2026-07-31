import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ThreadEntity } from '../../entities/thread.entity'
import { PaperclipThreadLinkEntity } from '../../entities/paperclip-thread-link.entity'
import { PutThreadPaperclipLinkDto } from './dto/paperclip.dto'
import { WorkspaceMembershipService } from '../workspace-membership/workspace-membership.service'
import { PaperclipConnectionService } from './paperclip-connection.service'
import { PaperclipApiClientService, PaperclipApiError } from './paperclip-api-client.service'
import {
  ThreadPaperclipLinkView,
  PaperclipLinkedObjectSummary,
} from './paperclip.types'

@Injectable()
export class PaperclipThreadLinkService {
  constructor(
    @InjectRepository(PaperclipThreadLinkEntity)
    private readonly linkRepo: Repository<PaperclipThreadLinkEntity>,
    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
    private readonly paperclipConnectionService: PaperclipConnectionService,
    private readonly paperclipApiClient: PaperclipApiClientService,
  ) {}

  async getThreadLinkView(
    threadId: string,
    userId: string,
  ): Promise<ThreadPaperclipLinkView> {
    const thread = await this.getThread(threadId)
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      thread.workspaceId,
      userId,
    )

    const link = await this.linkRepo.findOne({ where: { threadId } })
    if (!link) {
      return {
        link: null,
        connection: null,
        objectSummary: null,
        fetchState: 'unlinked',
        errorCode: null,
        errorMessage: null,
        fetchedAt: null,
      }
    }

    const connection = await this.paperclipConnectionService.getConnectionWithSecret(
      link.connectionId,
    )

    try {
      const summary = await this.fetchLiveSummary(link, connection)
      return {
        link: this.toLinkView(link),
        connection: this.paperclipConnectionService.toView(connection),
        objectSummary: summary,
        fetchState: 'ok',
        errorCode: null,
        errorMessage: null,
        fetchedAt: new Date().toISOString(),
      }
    } catch (error) {
      if (error instanceof PaperclipApiError) {
        const updatedConnection =
          error.code === 'not_found'
            ? connection
            : await this.paperclipConnectionService.markConnectionFailure(
                connection.id,
                error,
                link.updatedByUserId,
              )

        return {
          link: this.toLinkView(link),
          connection: this.paperclipConnectionService.toView(updatedConnection),
          objectSummary: null,
          fetchState:
            error.code === 'unauthorized'
              ? 'unauthorized'
              : error.code === 'not_found'
                ? 'object_not_found'
                : error.code === 'timeout' || error.code === 'unavailable'
                  ? 'unavailable'
                  : 'error',
          errorCode: error.code,
          errorMessage: error.message,
          fetchedAt: new Date().toISOString(),
        }
      }

      throw error
    }
  }

  async putThreadLink(
    threadId: string,
    dto: PutThreadPaperclipLinkDto,
    userId: string,
  ): Promise<ThreadPaperclipLinkView> {
    const thread = await this.getThread(threadId)
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      thread.workspaceId,
      userId,
    )

    const connection =
      await this.paperclipConnectionService.getConnectionWithSecret(
        dto.connectionId,
      )
    if (connection.workspaceId !== thread.workspaceId) {
      throw new ConflictException(
        'Paperclip connection must belong to the same workspace as the thread.',
      )
    }

    const summary = await this.fetchSummaryForWrite(
      connection,
      dto.objectType,
      dto.objectRef,
    )
    if (summary.companyId && summary.companyId !== connection.companyId) {
      throw new ConflictException(
        'The selected Paperclip object does not belong to the configured company.',
      )
    }

    const existing = await this.linkRepo.findOne({ where: { threadId } })
    if (
      existing &&
      existing.connectionId === connection.id &&
      existing.objectType === dto.objectType &&
      existing.paperclipObjectId === summary.id
    ) {
      return this.getThreadLinkView(threadId, userId)
    }

    const entity = existing
      ? Object.assign(existing, {
          workspaceId: thread.workspaceId,
          connectionId: connection.id,
          objectType: dto.objectType,
          paperclipObjectId: summary.id,
          paperclipObjectRef: dto.objectRef.trim(),
          updatedByUserId: userId,
        })
      : this.linkRepo.create({
          workspaceId: thread.workspaceId,
          threadId,
          connectionId: connection.id,
          objectType: dto.objectType,
          paperclipObjectId: summary.id,
          paperclipObjectRef: dto.objectRef.trim(),
          createdByUserId: userId,
          updatedByUserId: userId,
        })

    await this.linkRepo.save(entity)
    return this.getThreadLinkView(threadId, userId)
  }

  async unlinkThread(threadId: string, userId: string) {
    const thread = await this.getThread(threadId)
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      thread.workspaceId,
      userId,
    )
    await this.linkRepo.delete({ threadId })
    return { success: true }
  }

  private async getThread(threadId: string) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } })
    if (!thread) {
      throw new NotFoundException('Thread not found')
    }
    return thread
  }

  private async fetchLiveSummary(
    link: PaperclipThreadLinkEntity,
    connection: Awaited<
      ReturnType<PaperclipConnectionService['getConnectionWithSecret']>
    >,
  ): Promise<PaperclipLinkedObjectSummary> {
    return this.fetchSummaryRaw(
      connection,
      link.objectType,
      link.paperclipObjectId,
    )
  }

  private async fetchSummaryRaw(
    connection: Awaited<
      ReturnType<PaperclipConnectionService['getConnectionWithSecret']>
    >,
    objectType: 'issue' | 'approval',
    objectRef: string,
  ) {
    const bearerToken =
      this.paperclipConnectionService.decryptBearerToken(connection)
    if (objectType === 'issue') {
      return this.paperclipApiClient.fetchIssue(
        connection,
        bearerToken,
        objectRef.trim(),
      )
    }
    return this.paperclipApiClient.fetchApproval(
      connection,
      bearerToken,
      objectRef.trim(),
    )
  }

  private async fetchSummaryForWrite(
    connection: Awaited<
      ReturnType<PaperclipConnectionService['getConnectionWithSecret']>
    >,
    objectType: 'issue' | 'approval',
    objectRef: string,
  ) {
    try {
      return await this.fetchSummaryRaw(
        connection,
        objectType,
        objectRef.trim(),
      )
    } catch (error) {
      if (error instanceof PaperclipApiError) {
        if (error.code === 'not_found') {
          throw new NotFoundException('The requested Paperclip object was not found.')
        }
        if (error.code === 'unauthorized') {
          await this.paperclipConnectionService.markConnectionFailure(
            connection.id,
            error,
          )
          throw new ConflictException('Paperclip rejected the saved credentials.')
        }
        if (error.code === 'timeout' || error.code === 'unavailable') {
          await this.paperclipConnectionService.markConnectionFailure(
            connection.id,
            error,
          )
          throw new ServiceUnavailableException('Paperclip is unavailable right now.')
        }
        if (error.code === 'upstream_error') {
          throw new ServiceUnavailableException('Paperclip is unavailable right now.')
        }
        throw new ConflictException(error.message)
      }
      throw error
    }
  }

  private toLinkView(link: PaperclipThreadLinkEntity) {
    return {
      id: link.id,
      workspaceId: link.workspaceId,
      threadId: link.threadId,
      connectionId: link.connectionId,
      objectType: link.objectType,
      paperclipObjectId: link.paperclipObjectId,
      paperclipObjectRef: link.paperclipObjectRef ?? null,
      createdByUserId: link.createdByUserId,
      updatedByUserId: link.updatedByUserId,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    }
  }
}
