import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import {
  WorkspaceEntity,
  WorkspaceMemberEntity,
  WorkspaceMemberRole,
} from '../../entities'

const ADMIN_ROLES = new Set<WorkspaceMemberRole>([
  WorkspaceMemberRole.OWNER,
  WorkspaceMemberRole.ADMIN,
])

export interface WorkspaceAccess {
  workspace: WorkspaceEntity
  role: WorkspaceMemberRole
}

@Injectable()
export class WorkspaceMembershipService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
  ) {}

  async listUserWorkspaces(userId: string): Promise<WorkspaceEntity[]> {
    const memberships = await this.workspaceMemberRepository.find({
      where: { userId },
      select: ['workspaceId', 'role'],
    })

    const workspaceIds = Array.from(
      new Set(memberships.map((membership) => membership.workspaceId)),
    )
    const membershipRoles = new Map(
      memberships.map((membership) => [membership.workspaceId, membership.role]),
    )
    const owned = await this.workspaceRepository.find({
      where: { ownerId: userId },
      order: { updatedAt: 'DESC' },
    })
    await Promise.all(
      owned
        .filter((workspace) => membershipRoles.get(workspace.id) !== WorkspaceMemberRole.OWNER)
        .map((workspace) => this.ensureOwnerMembership(workspace.id, userId)),
    )

    const ownedIds = owned.map((workspace) => workspace.id)
    const extraIds = workspaceIds.filter((workspaceId) => !ownedIds.includes(workspaceId))

    const extra =
      extraIds.length > 0
        ? await this.workspaceRepository.find({
            where: { id: In(extraIds) },
            order: { updatedAt: 'DESC' },
          })
        : []

    return [...owned, ...extra].sort(
      (left, right) => this.updatedAtTime(right) - this.updatedAtTime(left),
    )
  }

  async ensureWorkspaceAccess(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceAccess> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    })
    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`)
    }

    if (workspace.ownerId === userId) {
      await this.ensureOwnerMembership(workspace.id, userId)
      return {
        workspace,
        role: WorkspaceMemberRole.OWNER,
      }
    }

    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
    })
    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace')
    }

    return {
      workspace,
      role: membership.role,
    }
  }

  async ensureWorkspaceAdminAccess(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceAccess> {
    const access = await this.ensureWorkspaceAccess(workspaceId, userId)
    if (!ADMIN_ROLES.has(access.role)) {
      throw new ForbiddenException(
        'You must be a workspace owner or admin to perform this action',
      )
    }
    return access
  }

  async ensureOwnerMembership(workspaceId: string, userId: string) {
    const existing = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
      select: ['id', 'role'],
    })
    if (existing?.role === WorkspaceMemberRole.OWNER) {
      return existing
    }

    const membership = existing
      ? Object.assign(existing, { role: WorkspaceMemberRole.OWNER })
      : this.workspaceMemberRepository.create({
          workspaceId,
          userId,
          role: WorkspaceMemberRole.OWNER,
        })

    return this.workspaceMemberRepository.save(membership)
  }

  private updatedAtTime(workspace: WorkspaceEntity): number {
    return workspace.updatedAt?.getTime() ?? 0
  }
}
