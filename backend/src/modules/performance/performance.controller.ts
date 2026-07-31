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
import { PerformanceService } from './performance.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import {
  AgentPerformanceQueryDto,
  CreateCoachingNoteDto,
  CreateReviewDto,
  PerformancePaginationDto,
  PerformancePeriodQueryDto,
} from './dto/performance.dto'

@ApiTags('performance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@UsePipes(new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
}))
@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('agents/:agentId')
  @ApiOperation({ summary: 'Get agent performance metrics' })
  getAgentMetrics(
    @Param('agentId') agentId: string,
    @CurrentUser() user: any,
    @Query() query: AgentPerformanceQueryDto,
  ) {
    return this.performanceService.getAgentMetrics(
      agentId,
      user.id,
      query.period ?? 'daily',
      query.start,
      query.end,
    )
  }

  @Get('teams/:teamId')
  @ApiOperation({ summary: 'Get team performance metrics' })
  getTeamMetrics(
    @Param('teamId') teamId: string,
    @Query() query: PerformancePeriodQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.performanceService.getTeamMetrics(teamId, user.id, query.period ?? 'daily')
  }

  @Get('departments/:departmentId')
  @ApiOperation({ summary: 'Get department performance metrics' })
  getDepartmentMetrics(
    @Param('departmentId') departmentId: string,
    @Query() query: PerformancePeriodQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.performanceService.getDepartmentMetrics(
      departmentId,
      user.id,
      query.period ?? 'daily',
    )
  }

  @Get('agents/:agentId/reviews')
  @ApiOperation({ summary: 'Get agent reviews' })
  getReviews(@Param('agentId') agentId: string, @Query() pagination: PerformancePaginationDto, @CurrentUser() user: any) {
    return this.performanceService.getReviews(agentId, user.id, pagination.page, pagination.pageSize)
  }

  @Post('agents/:agentId/reviews')
  @ApiOperation({ summary: 'Create agent review' })
  createReview(@Param('agentId') agentId: string, @CurrentUser() user: any, @Body() body: CreateReviewDto) {
    return this.performanceService.createReview(agentId, body, user.id)
  }

  @Get('agents/:agentId/coaching')
  @ApiOperation({ summary: 'Get coaching notes' })
  getCoachingNotes(@Param('agentId') agentId: string, @Query() pagination: PerformancePaginationDto, @CurrentUser() user: any) {
    return this.performanceService.getCoachingNotes(agentId, user.id, pagination.page, pagination.pageSize)
  }

  @Post('agents/:agentId/coaching')
  @ApiOperation({ summary: 'Add coaching note' })
  addCoachingNote(
    @Param('agentId') agentId: string,
    @CurrentUser() user: any,
    @Body() body: CreateCoachingNoteDto,
  ) {
    return this.performanceService.addCoachingNote(agentId, body, user.id)
  }
}
