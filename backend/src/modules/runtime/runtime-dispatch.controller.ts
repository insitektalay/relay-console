import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { UserEntity } from '../../entities/user.entity'
import { WorkspaceMembershipService } from '../workspace-membership/workspace-membership.service'
import { RuntimeDispatchCoordinator } from './runtime-dispatch-coordinator.service'
import { RuntimeDispatchService } from './runtime-dispatch.service'

@ApiTags('dispatches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('dispatches')
export class RuntimeDispatchController {
  constructor(
    private readonly coordinator: RuntimeDispatchCoordinator,
    private readonly runtimeDispatchService: RuntimeDispatchService,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
  ) {}

  @Get('threads/:threadId')
  @ApiOperation({ summary: 'List active and recently failed dispatches for a thread' })
  async findByThread(@Param('threadId') threadId: string, @CurrentUser() user: UserEntity) {
    const dispatches = await this.runtimeDispatchService.findReplayableByThread({ threadId })
    if (dispatches[0]) {
      await this.workspaceMembershipService.ensureWorkspaceAccess(
        dispatches[0].workspaceId,
        user.id,
      )
    }
    return dispatches
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a running or queued dispatch' })
  @ApiResponse({ status: 200, description: 'Cancel request processed' })
  @ApiResponse({ status: 404, description: 'Dispatch not found' })
  async cancel(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    const dispatch = await this.runtimeDispatchService.findById(id)
    if (!dispatch) {
      throw new NotFoundException(`Dispatch ${id} not found`)
    }
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      dispatch.workspaceId,
      user.id,
    )
    return this.coordinator.cancelDispatch(id)
  }
}
