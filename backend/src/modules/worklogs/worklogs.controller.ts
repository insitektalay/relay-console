import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { WorkLogsService } from './worklogs.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { UserEntity } from '../../entities/user.entity'
import {
  CreateWorkLogDto,
  WorkLogPaginationDto,
  WorkLogQueryDto,
} from './dto/worklogs.dto'

@ApiTags('work-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@UsePipes(new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
}))
@Controller('work-logs')
export class WorkLogsController {
  constructor(private readonly workLogsService: WorkLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List work logs with filters' })
  findAll(@Query() query: WorkLogQueryDto, @CurrentUser() user: UserEntity) {
    return this.workLogsService.findAll(query, user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Create a work log entry' })
  create(@Body() body: CreateWorkLogDto, @CurrentUser() user: UserEntity) {
    return this.workLogsService.create(body, user.id)
  }

  @Get('agent/:agentId')
  @ApiOperation({ summary: 'Get work logs for agent' })
  getAgentLogs(
    @Param('agentId') agentId: string,
    @Query() query: WorkLogPaginationDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.workLogsService.getAgentLogs(agentId, user.id, query.page, query.pageSize)
  }

  @Get('task/:taskId')
  @ApiOperation({ summary: 'Get work logs for task' })
  getTaskLogs(@Param('taskId') taskId: string, @CurrentUser() user: UserEntity) {
    return this.workLogsService.getTaskLogs(taskId, user.id)
  }
}
