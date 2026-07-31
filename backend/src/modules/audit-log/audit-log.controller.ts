import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { UserEntity } from '../../entities/user.entity'
import { WorkspaceMembershipService } from '../workspace-membership/workspace-membership.service'
import { AuditLogService } from './audit-log.service'

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('audit-logs')
export class AuditLogController {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs for a workspace' })
  async list(
    @CurrentUser() user: UserEntity,
    @Query('workspaceId') workspaceId: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 50,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    )
    return this.auditLogService.listWorkspaceAuditLogs(workspaceId, page, pageSize)
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get workspace security metrics from audit logs' })
  async metrics(
    @CurrentUser() user: UserEntity,
    @Query('workspaceId') workspaceId: string,
    @Query('hours') hours: number = 24,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    )
    return this.auditLogService.getWorkspaceSecurityMetrics(workspaceId, hours)
  }
}
