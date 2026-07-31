import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { UserEntity } from '../../entities/user.entity'
import { WorkspaceMembershipService } from '../workspace-membership/workspace-membership.service'
import {
  CreatePaperclipConnectionDto,
  PutThreadPaperclipLinkDto,
  UpdatePaperclipConnectionDto,
} from './dto/paperclip.dto'
import { PaperclipConnectionService } from './paperclip-connection.service'
import { PaperclipThreadLinkService } from './paperclip-thread-link.service'

@ApiTags('paperclip')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller()
export class PaperclipController {
  constructor(
    private readonly workspaceMembershipService: WorkspaceMembershipService,
    private readonly paperclipConnectionService: PaperclipConnectionService,
    private readonly paperclipThreadLinkService: PaperclipThreadLinkService,
  ) {}

  @Get('workspaces/:workspaceId/paperclip/connections')
  @ApiOperation({ summary: 'List Paperclip connections for a workspace' })
  async listConnections(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    )
    return this.paperclipConnectionService.listConnections(workspaceId)
  }

  @Post('workspaces/:workspaceId/paperclip/connections')
  @ApiOperation({ summary: 'Create a Paperclip connection for a workspace' })
  async createConnection(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: CreatePaperclipConnectionDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    )
    return this.paperclipConnectionService.createConnection(workspaceId, dto, user.id)
  }

  @Patch('workspaces/:workspaceId/paperclip/connections/:connectionId')
  @ApiOperation({ summary: 'Update a Paperclip connection for a workspace' })
  async updateConnection(
    @Param('workspaceId') workspaceId: string,
    @Param('connectionId') connectionId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdatePaperclipConnectionDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    )
    return this.paperclipConnectionService.updateConnection(
      workspaceId,
      connectionId,
      dto,
      user.id,
    )
  }

  @Post('workspaces/:workspaceId/paperclip/connections/:connectionId/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test a saved Paperclip connection' })
  async testConnection(
    @Param('workspaceId') workspaceId: string,
    @Param('connectionId') connectionId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    )
    return this.paperclipConnectionService.testConnection(workspaceId, connectionId)
  }

  @Get('threads/:id/paperclip-link')
  @ApiOperation({ summary: 'Fetch the linked Paperclip object summary for a thread' })
  async getThreadPaperclipLink(
    @Param('id') threadId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.paperclipThreadLinkService.getThreadLinkView(threadId, user.id)
  }

  @Put('threads/:id/paperclip-link')
  @ApiOperation({ summary: 'Create or replace a Paperclip link for a thread' })
  async putThreadPaperclipLink(
    @Param('id') threadId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: PutThreadPaperclipLinkDto,
  ) {
    return this.paperclipThreadLinkService.putThreadLink(threadId, dto, user.id)
  }

  @Delete('threads/:id/paperclip-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove the Paperclip link from a thread' })
  async deleteThreadPaperclipLink(
    @Param('id') threadId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.paperclipThreadLinkService.unlinkThread(threadId, user.id)
  }
}
