import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ThreadService } from './thread.service'
import { ThreadWrapUpService } from './thread-wrap-up.service'
import { RuntimeDispatchService } from '../runtime/runtime-dispatch.service'
import { CreateThreadDto, UpdateThreadDto } from './dto/thread.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { SearchThreadsQueryDto, ThreadAnalyticsQueryDto } from './dto/thread-query.dto'
import { UserEntity } from '../../entities/user.entity'

@ApiTags('threads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('threads')
export class ThreadController {
  constructor(
    private readonly threadService: ThreadService,
    private readonly threadWrapUpService: ThreadWrapUpService,
    private readonly runtimeDispatchService: RuntimeDispatchService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List threads with filters' })
  findAll(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: SearchThreadsQueryDto,
  ) {
    return this.threadService.findAll(workspaceId, user.id, query)
  }

  @Get('search')
  @ApiOperation({ summary: 'Search threads by title' })
  search(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Query('q') q: string,
    @Query() pagination: SearchThreadsQueryDto,
  ) {
    return this.threadService.searchThreads(
      workspaceId,
      user.id,
      q,
      pagination.page,
      pagination.pageSize,
    )
  }

  @Post()
  @ApiOperation({ summary: 'Create a thread' })
  create(@CurrentUser() user: UserEntity, @Body() dto: CreateThreadDto) {
    return this.threadService.create(dto, user.id)
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get analytics for a thread' })
  analytics(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Query() query: ThreadAnalyticsQueryDto,
  ) {
    return this.threadService.getAnalytics(id, user.id, query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get thread detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.threadService.findOne(id, user.id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update thread' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateThreadDto,
  ) {
    return this.threadService.update(id, dto, user.id)
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive thread' })
  archive(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.threadService.archive(id, user.id)
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all messages as read' })
  markRead(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.threadService.markAllRead(id, user.id)
  }

  @Get(':id/participants')
  @ApiOperation({ summary: 'Get thread participants' })
  getParticipants(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.threadService.getParticipants(id, user.id)
  }

  @Get(':id/runtime-context-usage')
  @ApiOperation({ summary: 'Get latest runtime context usage for a thread' })
  async getRuntimeContextUsage(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.threadService.findOne(id, user.id)
    return this.runtimeDispatchService.findLatestContextUsageByThread(id)
  }

  @Get(':id/wrap-up-report')
  @ApiOperation({ summary: 'Get a chat wrap-up report' })
  getWrapUpReport(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.threadWrapUpService.getWrapUpReport(id, user.id)
  }

  @Post(':id/wrap-up')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a chat wrap-up report and reset the active conversation' })
  wrapUp(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.threadWrapUpService.wrapUpThread(id, user.id)
  }
}
