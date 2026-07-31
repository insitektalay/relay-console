import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { EncryptionService } from '../security/encryption.service'
import { PaperclipConnectionEntity } from '../../entities/paperclip-connection.entity'
import { CreatePaperclipConnectionDto, UpdatePaperclipConnectionDto } from './dto/paperclip.dto'
import { PaperclipApiClientService, PaperclipApiError } from './paperclip-api-client.service'
import { PaperclipConnectionView } from './paperclip.types'

@Injectable()
export class PaperclipConnectionService {
  constructor(
    @InjectRepository(PaperclipConnectionEntity)
    private readonly connectionRepo: Repository<PaperclipConnectionEntity>,
    private readonly encryptionService: EncryptionService,
    private readonly paperclipApiClient: PaperclipApiClientService,
  ) {}

  async listConnections(workspaceId: string): Promise<PaperclipConnectionView[]> {
    const connections = await this.connectionRepo.find({
      where: { workspaceId },
      order: { updatedAt: 'DESC' },
    })
    return connections.map((connection) => this.toView(connection))
  }

  async createConnection(
    workspaceId: string,
    dto: CreatePaperclipConnectionDto,
    userId: string,
  ): Promise<PaperclipConnectionView> {
    const displayName = dto.displayName.trim()
    const companyId = dto.companyId.trim()
    const bearerToken = dto.bearerToken.trim()
    const baseUrl = this.paperclipApiClient.normalizeBaseUrl(dto.baseUrl)

    if (!bearerToken) {
      throw new BadRequestException('Paperclip bearer token is required.')
    }

    const validation = await this.validateForWrite({
      baseUrl,
      companyId,
      bearerToken,
    })
    await this.ensureUnique(workspaceId, baseUrl, validation.companyId)
    const encrypted = this.encryptionService.encryptString(bearerToken)
    const saved = await this.connectionRepo.save(
      this.connectionRepo.create({
        workspaceId,
        displayName,
        baseUrl,
        companyId: validation.companyId,
        companyName: validation.companyName,
        authType: 'bearer_token',
        bearerTokenCiphertext: encrypted.ciphertext,
        bearerTokenIv: encrypted.iv,
        bearerTokenAuthTag: encrypted.authTag,
        bearerTokenKeyVersion: encrypted.keyVersion,
        status: 'ready',
        lastValidatedAt: new Date(),
        lastSuccessAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        createdByUserId: userId,
        updatedByUserId: userId,
      }),
    )

    return this.toView(saved)
  }

  async updateConnection(
    workspaceId: string,
    connectionId: string,
    dto: UpdatePaperclipConnectionDto,
    userId: string,
  ): Promise<PaperclipConnectionView> {
    if (
      dto.displayName === undefined &&
      dto.baseUrl === undefined &&
      dto.companyId === undefined &&
      dto.bearerToken === undefined
    ) {
      throw new BadRequestException('At least one field must be provided.')
    }

    const existing = await this.getConnectionWithSecret(connectionId)
    if (existing.workspaceId !== workspaceId) {
      throw new NotFoundException(`Paperclip connection ${connectionId} not found`)
    }

    const nextDisplayName = dto.displayName?.trim() || existing.displayName
    const nextBaseUrl = dto.baseUrl
      ? this.paperclipApiClient.normalizeBaseUrl(dto.baseUrl)
      : existing.baseUrl
    const nextCompanyId = dto.companyId?.trim() || existing.companyId
    const nextBearerToken = dto.bearerToken?.trim() || this.decryptBearerToken(existing)
    const requiresValidation =
      dto.baseUrl !== undefined ||
      dto.companyId !== undefined ||
      dto.bearerToken !== undefined

    let resolvedCompanyId = nextCompanyId
    let companyName = existing.companyName
    if (requiresValidation) {
      const validation = await this.validateForWrite({
        baseUrl: nextBaseUrl,
        companyId: nextCompanyId,
        bearerToken: nextBearerToken,
      })
      resolvedCompanyId = validation.companyId
      companyName = validation.companyName
      if (
        nextBaseUrl !== existing.baseUrl ||
        resolvedCompanyId !== existing.companyId
      ) {
        await this.ensureUnique(
          workspaceId,
          nextBaseUrl,
          resolvedCompanyId,
          existing.id,
        )
      }
    }

    existing.displayName = nextDisplayName
    existing.baseUrl = nextBaseUrl
    existing.companyId = resolvedCompanyId
    existing.companyName = companyName
    existing.updatedByUserId = userId
    if (dto.bearerToken !== undefined) {
      const encrypted = this.encryptionService.encryptString(nextBearerToken)
      existing.bearerTokenCiphertext = encrypted.ciphertext
      existing.bearerTokenIv = encrypted.iv
      existing.bearerTokenAuthTag = encrypted.authTag
      existing.bearerTokenKeyVersion = encrypted.keyVersion
    }
    if (requiresValidation) {
      existing.status = 'ready'
      existing.lastValidatedAt = new Date()
      existing.lastSuccessAt = new Date()
      existing.lastErrorCode = null
      existing.lastErrorMessage = null
    }

    const saved = await this.connectionRepo.save(existing)
    return this.toView(saved)
  }

  async testConnection(
    workspaceId: string,
    connectionId: string,
  ): Promise<{
    ok: boolean
    connection: PaperclipConnectionView
    errorCode?: string | null
    errorMessage?: string | null
  }> {
    const connection = await this.getConnectionWithSecret(connectionId)
    if (connection.workspaceId !== workspaceId) {
      throw new NotFoundException(`Paperclip connection ${connectionId} not found`)
    }

    try {
      const validation = await this.paperclipApiClient.validateConnection({
        baseUrl: connection.baseUrl,
        companyId: connection.companyId,
        bearerToken: this.decryptBearerToken(connection),
      })
      connection.companyName = validation.companyName
      this.markConnectionReady(connection)
      const saved = await this.connectionRepo.save(connection)
      return {
        ok: true,
        connection: this.toView(saved),
      }
    } catch (error) {
      this.applyConnectionError(connection, error)
      const saved = await this.connectionRepo.save(connection)
      return {
        ok: false,
        connection: this.toView(saved),
        errorCode: saved.lastErrorCode,
        errorMessage: saved.lastErrorMessage,
      }
    }
  }

  async getConnectionForWorkspace(
    workspaceId: string,
    connectionId: string,
  ): Promise<PaperclipConnectionEntity> {
    const connection = await this.connectionRepo.findOne({
      where: { id: connectionId, workspaceId },
    })
    if (!connection) {
      throw new NotFoundException(`Paperclip connection ${connectionId} not found`)
    }
    return connection
  }

  async getConnectionWithSecret(connectionId: string): Promise<PaperclipConnectionEntity> {
    const connection = await this.connectionRepo
      .createQueryBuilder('connection')
      .addSelect('connection.bearerTokenCiphertext')
      .addSelect('connection.bearerTokenIv')
      .addSelect('connection.bearerTokenAuthTag')
      .addSelect('connection.bearerTokenKeyVersion')
      .where('connection.id = :connectionId', { connectionId })
      .getOne()

    if (!connection) {
      throw new NotFoundException(`Paperclip connection ${connectionId} not found`)
    }

    return connection
  }

  decryptBearerToken(connection: PaperclipConnectionEntity): string {
    return this.encryptionService.decryptString({
      ciphertext: connection.bearerTokenCiphertext,
      iv: connection.bearerTokenIv,
      authTag: connection.bearerTokenAuthTag,
      keyVersion: connection.bearerTokenKeyVersion,
    })
  }

  async markConnectionFailure(
    connectionId: string,
    error: unknown,
    updatedByUserId?: string,
  ): Promise<PaperclipConnectionEntity> {
    const connection = await this.getConnectionWithSecret(connectionId)
    if (updatedByUserId) {
      connection.updatedByUserId = updatedByUserId
    }
    this.applyConnectionError(connection, error)
    return this.connectionRepo.save(connection)
  }

  toView(connection: PaperclipConnectionEntity): PaperclipConnectionView {
    return {
      id: connection.id,
      workspaceId: connection.workspaceId,
      displayName: connection.displayName,
      baseUrl: connection.baseUrl,
      companyId: connection.companyId,
      companyName: connection.companyName ?? null,
      authType: 'bearer_token',
      status: connection.status,
      lastValidatedAt: connection.lastValidatedAt?.toISOString() ?? null,
      lastSuccessAt: connection.lastSuccessAt?.toISOString() ?? null,
      lastErrorCode: connection.lastErrorCode ?? null,
      lastErrorMessage: connection.lastErrorMessage ?? null,
      createdByUserId: connection.createdByUserId,
      updatedByUserId: connection.updatedByUserId,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    }
  }

  private async validateForWrite(input: {
    baseUrl: string
    companyId: string
    bearerToken: string
  }) {
    try {
      return await this.paperclipApiClient.validateConnection(input)
    } catch (error) {
      if (error instanceof PaperclipApiError) {
        if (
          error.code === 'invalid_base_url' ||
          error.code === 'unauthorized' ||
          error.code === 'not_found'
        ) {
          throw new BadRequestException(error.message)
        }
        if (
          error.code === 'timeout' ||
          error.code === 'unavailable' ||
          error.code === 'upstream_error'
        ) {
          throw new ServiceUnavailableException(error.message)
        }
        throw new ConflictException(error.message)
      }
      throw error
    }
  }

  private async ensureUnique(
    workspaceId: string,
    baseUrl: string,
    companyId: string,
    excludeConnectionId?: string,
  ) {
    const existing = await this.connectionRepo.findOne({
      where: { workspaceId, baseUrl, companyId },
    })
    if (existing && existing.id !== excludeConnectionId) {
      throw new ConflictException(
        'A Paperclip connection for this workspace, base URL, and company already exists.',
      )
    }
  }

  private markConnectionReady(connection: PaperclipConnectionEntity) {
    connection.status = 'ready'
    connection.lastValidatedAt = new Date()
    connection.lastSuccessAt = new Date()
    connection.lastErrorCode = null
    connection.lastErrorMessage = null
  }

  private applyConnectionError(
    connection: PaperclipConnectionEntity,
    error: unknown,
  ) {
    connection.lastValidatedAt = new Date()
    if (error instanceof PaperclipApiError) {
      if (error.code === 'unauthorized') {
        connection.status = 'unauthorized'
      } else if (error.code === 'timeout' || error.code === 'unavailable') {
        connection.status = 'unreachable'
      } else {
        connection.status = 'error'
      }
      connection.lastErrorCode = error.code
      connection.lastErrorMessage = this.sanitizeErrorMessage(error.message)
      return
    }

    connection.status = 'error'
    connection.lastErrorCode = 'unknown_error'
    connection.lastErrorMessage = 'Paperclip validation failed.'
  }

  private sanitizeErrorMessage(message: string) {
    return message.replace(/bearer\s+[A-Za-z0-9._-]+/gi, 'bearer [redacted]')
  }
}
