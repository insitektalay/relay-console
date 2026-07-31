import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { CapacityService } from './capacity.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { UserEntity } from '../../entities/user.entity'

@ApiTags('capacity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('capacity')
export class CapacityController {
  constructor(private readonly capacityService: CapacityService) {}

  @Get()
  @ApiOperation({ summary: 'Get workspace capacity' })
  getCapacity(@Query('workspaceId') workspaceId: string, @CurrentUser() user: UserEntity) {
    return this.capacityService.getCapacity(workspaceId, user.id)
  }

  @Get('team/:teamId')
  @ApiOperation({ summary: 'Get team capacity' })
  getTeamCapacity(@Param('teamId') teamId: string, @CurrentUser() user: UserEntity) {
    return this.capacityService.getTeamCapacity(teamId, user.id)
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get rebalancing suggestions' })
  getSuggestions(@Query('workspaceId') workspaceId: string, @CurrentUser() user: UserEntity) {
    return this.capacityService.rebalanceSuggestions(workspaceId, user.id)
  }
}
