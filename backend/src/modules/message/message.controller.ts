import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { IsString, IsNotEmpty } from 'class-validator'
import { MessageService } from './message.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import {
  CreateMessageBodyDto,
  LatestMessageQueryDto,
  MessageQueryDto,
  SearchMessagesQueryDto,
  UpdateTeamRelayDto,
} from './dto/message.dto'
import { UserEntity } from '../../entities/user.entity'

class AddReactionDto {
  @IsString()
  @IsNotEmpty()
  emoji: string
}
@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller()
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get('workspaces/:wsId/messages/search')
  @ApiOperation({ summary: 'Search message content in a workspace' })
  search(
    @Param('wsId') workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: SearchMessagesQueryDto,
  ) {
    return this.messageService.searchMessages(
      workspaceId,
      user.id,
      query.q,
      query.page,
      query.pageSize,
    )
  }

  @Get('threads/:threadId/messages')
  @ApiOperation({ summary: 'Get messages in a thread' })
  findAll(
    @Param('threadId') threadId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: MessageQueryDto,
  ) {
    return this.messageService.findAll(threadId, query, user.id)
  }

  @Get('threads/:threadId/messages/latest')
  @ApiOperation({ summary: 'Get latest messages in a thread without heavy pagination metadata' })
  findLatest(
    @Param('threadId') threadId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: LatestMessageQueryDto,
  ) {
    return this.messageService.findLatest(threadId, query, user.id)
  }

  @Post('threads/:threadId/messages')
  @ApiOperation({ summary: 'Send a message to a thread' })
  create(
    @Param('threadId') threadId: string,
    @CurrentUser() user: UserEntity,
    @Body() body: CreateMessageBodyDto,
  ) {
    return this.messageService.create(
      threadId,
      {
        content: body.content,
        type: body.type,
        replyToId: body.replyToId,
        attachments: body.attachments,
        senderId: user.id,
        senderName: user.name,
        senderAvatarUrl: user.avatarUrl,
        isFromUser: true,
        metadata: {
          runtimeApprovalMode: body.runtimeApprovalMode ?? "ask_for_approval",
          runtimeDispatchConfirmed: body.runtimeDispatchConfirmed === true,
        },
      },
      user.id,
      { routeToAgentsAsync: true },
    )
  }

  @Get('threads/:threadId/team-relay')
  @ApiOperation({ summary: 'Get the active team relay cycle controls' })
  getTeamRelay(
    @Param('threadId') threadId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.messageService.getTeamRelay(threadId, user.id)
  }

  @Post('threads/:threadId/team-relay/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause agent-to-agent follow-up routing for the active team cycle' })
  pauseTeamRelay(
    @Param('threadId') threadId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.messageService.pauseTeamRelay(threadId, user.id)
  }

  @Post('threads/:threadId/team-relay/continue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Continue the active team relay cycle and route its pending baton' })
  continueTeamRelay(
    @Param('threadId') threadId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.messageService.continueTeamRelay(threadId, user.id)
  }

  @Patch('threads/:threadId/team-relay')
  @ApiOperation({ summary: 'Set the active team relay reply limit' })
  updateTeamRelay(
    @Param('threadId') threadId: string,
    @CurrentUser() user: UserEntity,
    @Body() body: UpdateTeamRelayDto,
  ) {
    return this.messageService.setTeamRelayReplyLimit(
      threadId,
      user.id,
      body.replyLimit,
    )
  }

  @Get('messages/:messageId/reactions')
  @ApiOperation({ summary: 'Get all reactions for a message' })
  getReactions(@Param('messageId') messageId: string, @CurrentUser() user: UserEntity) {
    return this.messageService.getReactions(messageId, user.id)
  }

  @Post('messages/:messageId/reactions')
  @ApiOperation({ summary: 'Add a reaction to a message' })
  addReaction(
    @Param('messageId') messageId: string,
    @CurrentUser() user: UserEntity,
    @Body() body: AddReactionDto,
  ) {
    return this.messageService.addReaction(messageId, body.emoji, { user })
  }

  @Delete('messages/:messageId/reactions/:emoji')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a reaction from a message' })
  removeReaction(
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @CurrentUser() user: UserEntity,
  ) {
    const reactorId = `user:${user.id}`
    return this.messageService.removeReaction(messageId, emoji, reactorId, user.id)
  }
}
