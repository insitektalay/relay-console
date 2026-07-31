import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AlertEntity } from '../../entities/alert.entity'
import { paginate } from '../../common/dto/pagination.dto'
import { ResourceAccessService } from '../resource-access/resource-access.service'

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(AlertEntity)
    private readonly alertRepo: Repository<AlertEntity>,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async findAll(
    filters: { workspaceId?: string; unreadOnly?: boolean; page?: number; pageSize?: number },
    userId: string,
  ) {
    const { workspaceId, unreadOnly, page = 1, pageSize = 20 } = filters
    if (!workspaceId) {
      throw new NotFoundException('workspaceId is required')
    }
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId)
    const qb = this.alertRepo.createQueryBuilder('a')

    qb.andWhere('a."workspaceId" = :workspaceId', { workspaceId })
    if (unreadOnly === true || String(unreadOnly) === 'true') {
      qb.andWhere('a."isRead" = false')
    }

    qb.orderBy('a."createdAt"', 'DESC').skip((page - 1) * pageSize).take(pageSize)
    const [items, total] = await qb.getManyAndCount()
    return paginate(items, total, page, pageSize)
  }

  async markRead(id: string, userId: string): Promise<AlertEntity> {
    const alert = await this.resourceAccessService.ensureAlertAccess(id, userId)
    alert.isRead = true
    return this.alertRepo.save(alert)
  }

  async markAllRead(workspaceId: string, userId?: string): Promise<{ count: number }> {
    if (!userId) {
      throw new NotFoundException('User context is required')
    }
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId)
    const result = await this.alertRepo
      .createQueryBuilder()
      .update(AlertEntity)
      .set({ isRead: true })
      .where('"workspaceId" = :workspaceId', { workspaceId })
      .andWhere('"isRead" = false')
      .execute()
    return { count: result.affected ?? 0 }
  }

  async create(dto: Partial<AlertEntity>): Promise<AlertEntity> {
    const alert = this.alertRepo.create({ ...dto, isRead: false })
    return this.alertRepo.save(alert)
  }

  async createAlert(
    workspaceId: string,
    type: string,
    title: string,
    message: string,
    agentId?: string,
    taskId?: string,
  ): Promise<AlertEntity> {
    return this.create({ workspaceId, type, title, message, agentId, taskId, severity: 'medium' })
  }

  async getUnreadCount(workspaceId: string, userId: string): Promise<number> {
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId)
    return this.alertRepo.count({ where: { workspaceId, isRead: false } })
  }
}
