import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ReportService } from './report.service'
import { ThreadWrapUpService } from '../thread/thread-wrap-up.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { UserEntity } from '../../entities/user.entity'

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('reports')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly threadWrapUpService: ThreadWrapUpService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List report snapshots' })
  findAll(@Query() query: any, @CurrentUser() user: UserEntity) {
    return this.reportService.findAll(query, user.id)
  }

  @Get('wrap-ups')
  @ApiOperation({ summary: 'List chat wrap-up reports' })
  findWrapUps(@Query() query: any, @CurrentUser() user: UserEntity) {
    return this.reportService.findWrapUps(query, user.id)
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate a report' })
  generate(
    @Body() body: { workspaceId: string; type: string; period: string; start: string; end: string },
    @CurrentUser() user: UserEntity,
  ) {
    return this.reportService.generate(body.workspaceId, user.id, body.type, body.period, body.start, body.end)
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get performance metrics' })
  getMetrics(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Query('period') period: string,
    @Query('agentId') agentId: string,
    @Query('teamId') teamId: string,
  ) {
    return this.reportService.getPerformanceMetrics(workspaceId, user.id, period, agentId, teamId)
  }

  @Get('wrap-ups/:id')
  @ApiOperation({ summary: 'Get chat wrap-up report' })
  findWrapUpOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserEntity) {
    return this.reportService.findWrapUpOne(id, user.id)
  }

  @Post('wrap-ups/:id/retry')
  @ApiOperation({ summary: 'Retry a failed chat wrap-up report' })
  retryWrapUp(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserEntity) {
    return this.threadWrapUpService.retryWrapUpReport(id, user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report snapshot' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserEntity) {
    return this.reportService.findOne(id, user.id)
  }
}
