import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { SchedulingService } from './schedule.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { UserEntity } from '../../entities/user.entity'

@ApiTags('schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('schedules')
export class ScheduleController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get()
  @ApiOperation({ summary: 'List all schedules for workspace' })
  findAll(@Query('workspaceId') workspaceId: string, @CurrentUser() user: UserEntity) {
    return this.schedulingService.findAll(workspaceId, user.id)
  }

  @Get('agent/:agentId')
  @ApiOperation({ summary: 'Get agent schedule with shifts' })
  getAgentSchedule(@Param('agentId') agentId: string, @CurrentUser() user: UserEntity) {
    return this.schedulingService.findScheduleByAgent(agentId, user.id)
  }

  @Put('agent/:agentId')
  @ApiOperation({ summary: 'Create or update agent schedule' })
  updateAgentSchedule(@Param('agentId') agentId: string, @Body() body: any, @CurrentUser() user: UserEntity) {
    return this.schedulingService.createOrUpdate(agentId, body.mode, body.shifts, body.timezone, user.id)
  }

  @Get('agent/:agentId/availability')
  @ApiOperation({ summary: 'Get agent availability state' })
  getAvailability(@Param('agentId') agentId: string, @CurrentUser() user: UserEntity) {
    return this.schedulingService.getAvailabilityState(agentId, user.id)
  }
}
