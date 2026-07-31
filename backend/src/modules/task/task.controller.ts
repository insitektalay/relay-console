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
import { TaskService } from './task.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { PaginationDto } from '../../common/dto/pagination.dto'
import { AuthenticatedUser } from '../auth/auth.types'
import {
  CreateTaskBodyDto,
  TaskQueryDto,
  UpdateTaskStatusBodyDto,
  UpdateTaskBodyDto,
} from './dto/task.dto'

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller()
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
  ) {}

  @Get('tasks')
  @ApiOperation({ summary: 'List tasks with filters' })
  findAll(@Query() query: TaskQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.findAll(query, user.id)
  }

  @Post('tasks')
  @ApiOperation({ summary: 'Create a task' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateTaskBodyDto) {
    return (async () => {
      return this.taskService.create(
        {
          ...body,
          dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
          scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
          requiresApproval: body.requiresApproval,
        },
        user.id,
      )
    })()
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get task detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.findOne(id, user.id)
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Update task message, target, or schedule' })
  update(@Param('id') id: string, @Body() body: UpdateTaskBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.update(id, {
      ...body,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
    }, user.id)
  }

  @Patch('tasks/:id/status')
  @ApiOperation({ summary: 'Update task status' })
  updateStatus(@Param('id') id: string, @Body() body: UpdateTaskStatusBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.updateStatus(id, body.status, user.id)
  }

  @Post('tasks/:id/dispatch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dispatch a task immediately' })
  dispatchNow(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.dispatchNow(id, user.id)
  }

  @Post('tasks/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a task' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.cancel(id, user.id)
  }

  @Get('tasks/:id/runs')
  @ApiOperation({ summary: 'Get runs for task' })
  getRuns(@Param('id') id: string, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.getRuns(id, user.id, pagination.page, pagination.pageSize)
  }

  @Get('runs/:runId')
  @ApiOperation({ summary: 'Get run detail' })
  getRun(@Param('runId') runId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.getRun(runId, user.id)
  }

  @Get('runs/:runId/events')
  @ApiOperation({ summary: 'Get run events' })
  getRunEvents(@Param('runId') runId: string, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.getRunEvents(runId, user.id, pagination.page, pagination.pageSize)
  }
}
