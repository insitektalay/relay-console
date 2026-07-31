import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  PermissionPolicyEntity,
  PermissionRule,
  PermissionScope,
} from '../../entities/permission-policy.entity'
import { ResourceAccessService } from '../resource-access/resource-access.service'
import { AuditLogService } from '../audit-log/audit-log.service'
import {
  CreatePermissionPolicyDto,
  PermissionRuleDto,
} from './dto/permissions.dto'

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(PermissionPolicyEntity)
    private readonly policyRepo: Repository<PermissionPolicyEntity>,
    private readonly resourceAccessService: ResourceAccessService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(workspaceId: string, userId: string): Promise<PermissionPolicyEntity[]> {
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId)
    return this.policyRepo.find({ where: { workspaceId }, order: { createdAt: 'ASC' } })
  }

  async findForScope(workspaceId: string, scope: PermissionScope, scopeId: string) {
    return this.policyRepo.findOne({ where: { workspaceId, scope, scopeId } })
  }

  async findOne(id: string): Promise<PermissionPolicyEntity> {
    const policy = await this.policyRepo.findOne({ where: { id } })
    if (!policy) throw new NotFoundException(`Permission policy ${id} not found`)
    return policy
  }

  async create(dto: CreatePermissionPolicyDto, userId: string): Promise<PermissionPolicyEntity> {
    await this.resourceAccessService.ensureWorkspaceAdminAccess(dto.workspaceId, userId)
    const scopeId = await this.validateScope(
      dto.workspaceId,
      dto.scope,
      dto.scopeId,
      userId,
    )
    const permissions = this.validatePermissionRules(dto.permissions)
    const policy = this.policyRepo.create({
      id: randomUUID(),
      name: dto.name,
      workspaceId: dto.workspaceId,
      scope: dto.scope,
      scopeId,
      permissions,
    })
    await this.policyRepo.insert(policy)
    const saved = await this.policyRepo.findOneByOrFail({
      id: policy.id,
      workspaceId: dto.workspaceId,
    })
    await this.auditLogService.record({
      actorType: 'user',
      actorId: userId,
      workspaceId: saved.workspaceId,
      eventType: 'permissions.policy.created',
      resourceType: 'permission_policy',
      resourceId: saved.id,
      metadata: this.policyAuditMetadata(saved),
    })
    return saved
  }

  async update(
    id: string,
    permissions: PermissionRuleDto[],
    userId: string,
  ): Promise<PermissionPolicyEntity> {
    const policy = await this.resourceAccessService.ensurePermissionPolicyAdminAccess(id, userId)
    const validatedPermissions = this.validatePermissionRules(permissions)
    const previousPermissionCount = Array.isArray(policy.permissions)
      ? policy.permissions.length
      : 0
    await this.policyRepo.update(
      { id: policy.id, workspaceId: policy.workspaceId },
      { permissions: validatedPermissions },
    )
    const updated = await this.policyRepo.findOneByOrFail({
      id: policy.id,
      workspaceId: policy.workspaceId,
    })
    await this.auditLogService.record({
      actorType: 'user',
      actorId: userId,
      workspaceId: policy.workspaceId,
      eventType: 'permissions.policy.updated',
      resourceType: 'permission_policy',
      resourceId: id,
      metadata: {
        ...this.policyAuditMetadata(updated),
        previousPermissionCount,
      },
    })
    return updated
  }

  async delete(id: string, userId: string): Promise<void> {
    const policy = await this.resourceAccessService.ensurePermissionPolicyAdminAccess(id, userId)
    await this.policyRepo.delete({
      id: policy.id,
      workspaceId: policy.workspaceId,
    })
    await this.auditLogService.record({
      actorType: 'user',
      actorId: userId,
      workspaceId: policy.workspaceId,
      eventType: 'permissions.policy.deleted',
      resourceType: 'permission_policy',
      resourceId: id,
      metadata: this.policyAuditMetadata(policy),
    })
  }

  async initializeDefaultPolicies(workspaceId: string): Promise<void> {
    const defaults = [
      {
        name: 'Admin',
        workspaceId,
        scope: PermissionScope.WORKSPACE,
        permissions: [{ action: '*', effect: 'allow' as const }],
      },
      {
        name: 'Viewer',
        workspaceId,
        scope: PermissionScope.WORKSPACE,
        permissions: [
          { action: 'read:agents', effect: 'allow' as const },
          { action: 'read:tasks', effect: 'allow' as const },
          { action: 'read:reports', effect: 'allow' as const },
        ],
      },
    ]
    for (const def of defaults) {
      const existing = await this.policyRepo.findOne({ where: { workspaceId, name: def.name } })
      if (!existing) {
        await this.policyRepo.save(this.policyRepo.create(def))
      }
    }
  }

  async hasPermission(workspaceId: string, scope: PermissionScope, scopeId: string, permission: string): Promise<boolean> {
    const policy = await this.findForScope(workspaceId, scope, scopeId)
    if (!policy) return false
    const matching = policy.permissions.filter(
      (rule) => rule.action === '*' || rule.action === permission,
    )
    if (matching.some((rule) => rule.effect === 'deny')) return false
    return matching.some((rule) => rule.effect === 'allow')
  }

  private policyAuditMetadata(policy: Partial<PermissionPolicyEntity>) {
    return {
      name: policy.name ?? null,
      scope: policy.scope ?? null,
      scopeId: policy.scopeId ?? null,
      permissionCount: Array.isArray(policy.permissions)
        ? policy.permissions.length
        : 0,
    }
  }

  private validatePermissionRules(
    rules: PermissionRuleDto[],
  ): PermissionRule[] {
    if (!Array.isArray(rules) || rules.length > 200) {
      throw new BadRequestException('permissions must contain at most 200 rules')
    }

    const actions = new Set<string>()
    return rules.map((rule) => {
      if (
        !rule ||
        typeof rule.action !== 'string' ||
        !/^(\*|[a-z][a-z0-9_.:-]{0,127})$/.test(rule.action) ||
        (rule.effect !== 'allow' && rule.effect !== 'deny')
      ) {
        throw new BadRequestException('Invalid permission rule')
      }
      if (actions.has(rule.action)) {
        throw new BadRequestException(
          `Duplicate permission action: ${rule.action}`,
        )
      }
      actions.add(rule.action)
      return { action: rule.action, effect: rule.effect }
    })
  }

  private async validateScope(
    workspaceId: string,
    scope: PermissionScope,
    suppliedScopeId: string | undefined,
    userId: string,
  ): Promise<string> {
    if (scope === PermissionScope.WORKSPACE) {
      if (suppliedScopeId && suppliedScopeId !== workspaceId) {
        throw new BadRequestException(
          'Workspace policy scopeId must match workspaceId',
        )
      }
      return workspaceId
    }

    if (!suppliedScopeId) {
      throw new BadRequestException('scopeId is required for this scope')
    }

    let scopedWorkspaceId: string
    switch (scope) {
      case PermissionScope.COMPANY: {
        const company =
          await this.resourceAccessService.ensureCompanyAccess(
            suppliedScopeId,
            userId,
          )
        scopedWorkspaceId = company.workspaceId
        break
      }
      case PermissionScope.DEPARTMENT:
        scopedWorkspaceId =
          await this.resourceAccessService.getDepartmentWorkspaceId(
            suppliedScopeId,
          )
        await this.resourceAccessService.ensureWorkspaceAccess(
          scopedWorkspaceId,
          userId,
        )
        break
      case PermissionScope.TEAM:
        scopedWorkspaceId =
          await this.resourceAccessService.getTeamWorkspaceId(suppliedScopeId)
        await this.resourceAccessService.ensureWorkspaceAccess(
          scopedWorkspaceId,
          userId,
        )
        break
      case PermissionScope.AGENT: {
        const agent = await this.resourceAccessService.ensureAgentAccess(
          suppliedScopeId,
          userId,
        )
        scopedWorkspaceId = agent.workspaceId
        break
      }
      default:
        throw new BadRequestException('Invalid permission scope')
    }

    if (scopedWorkspaceId !== workspaceId) {
      throw new BadRequestException(
        'Permission scope does not belong to this workspace',
      )
    }
    return suppliedScopeId
  }
}
