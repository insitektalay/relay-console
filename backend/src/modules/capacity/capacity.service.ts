import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AgentEntity } from '../../entities/agent.entity'
import { TaskEntity } from '../../entities/task.entity'
import { BudgetUsageEntity } from '../../entities/budget-usage.entity'
import { ResourceAccessService } from '../resource-access/resource-access.service'

export interface AgentLoad {
  agent: AgentEntity
  runningTasks: number
  loadPercent: number
  category: 'overloaded' | 'optimal' | 'underutilized' | 'offline'
}

@Injectable()
export class CapacityService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,

    @InjectRepository(BudgetUsageEntity)
    private readonly budgetRepo: Repository<BudgetUsageEntity>,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async getCapacity(workspaceId: string, userId: string) {
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId)
    const agents = await this.agentRepo.find({ where: { workspaceId } })
    return this.computeAgentLoads(agents)
  }

  async getTeamCapacity(teamId: string, userId: string) {
    await this.resourceAccessService.ensureTeamAccess(teamId, userId)
    const agents = await this.agentRepo.find({ where: { teamId } })
    return this.computeAgentLoads(agents)
  }

  private async computeAgentLoads(agents: AgentEntity[]) {
    const loads: AgentLoad[] = await Promise.all(
      agents.map(async (agent) => {
        const runningTasks = await this.taskRepo.count({
          where: { assignedAgentId: agent.id, status: 'running' },
        })

        const capacity = agent['capacity'] ?? 5
        const loadPercent = capacity > 0 ? Math.round((runningTasks / capacity) * 100) : 0

        let category: AgentLoad['category']
        if (agent.status === 'off_duty' || agent.status === 'offline') {
          category = 'offline'
        } else if (loadPercent > 80) {
          category = 'overloaded'
        } else if (loadPercent >= 20) {
          category = 'optimal'
        } else {
          category = 'underutilized'
        }

        return { agent, runningTasks, loadPercent, category }
      }),
    )

    const overloaded = loads.filter((l) => l.category === 'overloaded')
    const optimal = loads.filter((l) => l.category === 'optimal')
    const underutilized = loads.filter((l) => l.category === 'underutilized')
    const offline = loads.filter((l) => l.category === 'offline')

    return { loads, overloaded, optimal, underutilized, offline, summary: {
      total: agents.length,
      overloadedCount: overloaded.length,
      optimalCount: optimal.length,
      underutilizedCount: underutilized.length,
      offlineCount: offline.length,
    }}
  }

  async rebalanceSuggestions(workspaceId: string, userId: string) {
    const { loads } = await this.getCapacity(workspaceId, userId)
    const overloaded = loads.filter((l) => l.category === 'overloaded')
    const underutilized = loads.filter((l) => l.category === 'underutilized')

    const suggestions = overloaded.map((over) => ({
      fromAgent: over.agent,
      toAgents: underutilized.map((u) => u.agent),
      recommendation: `Move ${over.runningTasks - Math.floor(over.loadPercent * 0.5 / 100)} tasks from ${over.agent.name}`,
    }))

    return suggestions
  }

  async getBudgetUsage(workspaceId: string, filters: any) {
    const { period, agentId, teamId, departmentId } = filters
    const where: any = { workspaceId }
    if (period) where.period = period
    if (agentId) where.agentId = agentId
    if (teamId) where.teamId = teamId
    if (departmentId) where.departmentId = departmentId

    const [items, total] = await this.budgetRepo.findAndCount({
      where,
      order: { periodStart: 'DESC' },
    })
    return { data: items, meta: { total } }
  }

  async recordBudgetUsage(data: Partial<BudgetUsageEntity>): Promise<BudgetUsageEntity> {
    const usage = this.budgetRepo.create(data)
    return this.budgetRepo.save(usage)
  }
}
