import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { IncidentEntity } from '../../entities/incident.entity'
import { AlertEntity } from '../../entities/alert.entity'
import { paginate } from '../../common/dto/pagination.dto'
import { ResourceAccessService } from '../resource-access/resource-access.service'
import {
  CreateIncidentDto,
  IncidentQueryDto,
  UpdateIncidentDto,
} from './dto/incident.dto'

@Injectable()
export class IncidentService {
  constructor(
    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,

    @InjectRepository(AlertEntity)
    private readonly alertRepo: Repository<AlertEntity>,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async findAll(filters: IncidentQueryDto, userId: string) {
    const { workspaceId, status, severity, agentId, page = 1, pageSize = 20 } = filters
    if (!workspaceId) {
      throw new BadRequestException('workspaceId is required')
    }
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId)
    const where: any = {}
    where.workspaceId = workspaceId
    if (status) where.status = status
    if (severity) where.severity = severity
    if (agentId) where.agentId = agentId

    const [items, total] = await this.incidentRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return paginate(items, total, page, pageSize)
  }

  async findOne(id: string, userId: string): Promise<IncidentEntity> {
    const incident = await this.resourceAccessService.ensureIncidentAccess(id, userId)
    return incident
  }

  async create(data: CreateIncidentDto, userId: string): Promise<IncidentEntity> {
    await this.resourceAccessService.ensureWorkspaceAccess(data.workspaceId, userId)
    await this.assertRelationshipsInWorkspace(data, data.workspaceId, userId)

    const incident = this.incidentRepo.create({
      id: randomUUID(),
      title: data.title,
      description: data.description,
      status: 'open',
      severity: data.severity,
      workspaceId: data.workspaceId,
      agentId: data.agentId ?? null,
      teamId: data.teamId ?? null,
      taskId: data.taskId ?? null,
      runId: data.runId ?? null,
      tags: data.tags ?? null,
      affectedSystems: data.affectedSystems ?? null,
    })
    await this.incidentRepo.insert(incident)
    const saved = await this.incidentRepo.findOneByOrFail({
      id: incident.id,
      workspaceId: data.workspaceId,
    })

    // Create alert
    const alert = this.alertRepo.create({
      workspaceId: saved.workspaceId,
      title: `New Incident: ${saved.title}`,
      message: saved.description,
      type: 'incident',
      severity: saved.severity,
      agentId: saved.agentId,
    })
    await this.alertRepo.save(alert)

    return saved
  }

  async updateStatus(id: string, userId: string, status: string, notes?: string): Promise<IncidentEntity> {
    const incident = await this.findOne(id, userId)
    incident.status = status
    if (status === 'resolved') {
      incident.resolvedAt = new Date()
      if (notes) incident.resolutionNotes = notes
    }
    return this.incidentRepo.save(incident)
  }

  async resolve(id: string, userId: string, resolutionNotes?: string): Promise<IncidentEntity> {
    return this.updateStatus(id, userId, 'resolved', resolutionNotes)
  }

  async update(id: string, data: UpdateIncidentDto, userId: string): Promise<IncidentEntity> {
    const incident = await this.findOne(id, userId)
    await this.assertRelationshipsInWorkspace(data, incident.workspaceId, userId)

    const patch: Partial<IncidentEntity> = {}
    if (data.title !== undefined) patch.title = data.title
    if (data.description !== undefined) patch.description = data.description
    if (data.severity !== undefined) patch.severity = data.severity
    if (data.agentId !== undefined) patch.agentId = data.agentId
    if (data.teamId !== undefined) patch.teamId = data.teamId
    if (data.taskId !== undefined) patch.taskId = data.taskId
    if (data.runId !== undefined) patch.runId = data.runId
    if (data.tags !== undefined) patch.tags = data.tags
    if (data.affectedSystems !== undefined) {
      patch.affectedSystems = data.affectedSystems
    }

    if (Object.keys(patch).length > 0) {
      await this.incidentRepo.update(
        { id: incident.id, workspaceId: incident.workspaceId },
        patch,
      )
    }
    return this.findOne(id, userId)
  }

  async getOpenCount(workspaceId: string): Promise<number> {
    return this.incidentRepo.count({ where: { workspaceId, status: 'open' } })
  }

  private async assertRelationshipsInWorkspace(
    data: Pick<
      CreateIncidentDto,
      'agentId' | 'teamId' | 'taskId' | 'runId'
    >,
    workspaceId: string,
    userId: string,
  ) {
    if (data.agentId) {
      const agent = await this.resourceAccessService.ensureAgentAccess(
        data.agentId,
        userId,
      )
      this.assertSameWorkspace('Agent', agent.workspaceId, workspaceId)
    }

    if (data.teamId) {
      const teamWorkspaceId =
        await this.resourceAccessService.getTeamWorkspaceId(data.teamId)
      await this.resourceAccessService.ensureWorkspaceAccess(
        teamWorkspaceId,
        userId,
      )
      this.assertSameWorkspace('Team', teamWorkspaceId, workspaceId)
    }

    if (data.taskId) {
      const task = await this.resourceAccessService.ensureTaskAccess(
        data.taskId,
        userId,
      )
      this.assertSameWorkspace('Task', task.workspaceId, workspaceId)
    }

    if (data.runId) {
      const { run, task } = await this.resourceAccessService.ensureRunAccess(
        data.runId,
        userId,
      )
      this.assertSameWorkspace('Run', task.workspaceId, workspaceId)
      if (data.taskId && run.taskId !== data.taskId) {
        throw new BadRequestException('Run does not belong to the supplied task')
      }
    }
  }

  private assertSameWorkspace(
    resource: string,
    actualWorkspaceId: string,
    expectedWorkspaceId: string,
  ) {
    if (actualWorkspaceId !== expectedWorkspaceId) {
      throw new BadRequestException(
        `${resource} does not belong to this workspace`,
      )
    }
  }
}
