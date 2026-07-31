import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { TeamService } from './team.service'
import {
  CreateTeamDto,
  CreateTeamMemoryItemDto,
  TeamAgentQueryDto,
  TeamListQueryDto,
  TeamMemoryQueryDto,
  UpdateTeamDto,
  UpdateTeamMemoryItemDto,
} from './dto/team.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { PaginationDto } from '../../common/dto/pagination.dto'
import { UserEntity } from '../../entities/user.entity'

@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@UsePipes(new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
}))
@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'List teams by workspace or department' })
  findAll(
    @Query() query: TeamListQueryDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.teamService.findAll(query, user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Create a team' })
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: UserEntity) {
    return this.teamService.create(dto, user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get team detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.teamService.findOne(id, user.id)
  }

  @Get(':id/dashboard')
  @ApiOperation({ summary: 'Get team dashboard data' })
  getDashboard(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.teamService.getDashboard(id, user.id)
  }

  @Get(':id/agents')
  @ApiOperation({ summary: 'Get agents in team' })
  getAgents(@Param('id') id: string, @Query() query: TeamAgentQueryDto, @CurrentUser() user: UserEntity) {
    return this.teamService.getAgents(id, user.id, query)
  }

  @Get(':id/handovers')
  @ApiOperation({ summary: 'Get handover notes for team' })
  getHandovers(@Param('id') id: string, @Query() pagination: PaginationDto, @CurrentUser() user: UserEntity) {
    return this.teamService.getHandovers(id, user.id, pagination.page, pagination.pageSize)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update team' })
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto, @CurrentUser() user: UserEntity) {
    return this.teamService.update(id, dto, user.id)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a team' })
  delete(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.teamService.delete(id, user.id)
  }

  // Team Memory endpoints
  @Get(':teamId/memory')
  @ApiOperation({ summary: 'List team memory items' })
  findMemory(@Param('teamId') teamId: string, @Query() query: TeamMemoryQueryDto, @CurrentUser() user: UserEntity) {
    return this.teamService.findMemory(teamId, user.id, query)
  }

  @Post(':teamId/memory')
  @ApiOperation({ summary: 'Create team memory item' })
  createMemory(
    @Param('teamId') teamId: string,
    @Body() dto: CreateTeamMemoryItemDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.teamService.createMemoryItem(teamId, dto, user.id)
  }

  @Get(':teamId/memory/:id')
  @ApiOperation({ summary: 'Get team memory item' })
  findMemoryItem(
    @Param('teamId') teamId: string,
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.teamService.findMemoryItem(teamId, id, user.id)
  }

  @Patch(':teamId/memory/:id')
  @ApiOperation({ summary: 'Update team memory item' })
  updateMemory(
    @Param('teamId') teamId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTeamMemoryItemDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.teamService.updateMemoryItem(teamId, id, dto, user.id)
  }

  @Delete(':teamId/memory/:id')
  @ApiOperation({ summary: 'Delete team memory item' })
  deleteMemory(
    @Param('teamId') teamId: string,
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.teamService.deleteMemoryItem(teamId, id, user.id)
  }
}
