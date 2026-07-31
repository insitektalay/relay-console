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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { IncidentService } from './incident.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { UserEntity } from '../../entities/user.entity'
import {
  CreateIncidentDto,
  IncidentQueryDto,
  ResolveIncidentDto,
  UpdateIncidentDto,
} from './dto/incident.dto'

@ApiTags('incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@UsePipes(new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
}))
@Controller('incidents')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Get()
  @ApiOperation({ summary: 'List incidents' })
  findAll(@Query() query: IncidentQueryDto, @CurrentUser() user: UserEntity) {
    return this.incidentService.findAll(query, user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Create an incident' })
  create(@Body() body: CreateIncidentDto, @CurrentUser() user: UserEntity) {
    return this.incidentService.create(body, user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get incident detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.incidentService.findOne(id, user.id)
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve an incident' })
  resolve(@Param('id') id: string, @Body() body: ResolveIncidentDto, @CurrentUser() user: UserEntity) {
    return this.incidentService.resolve(id, user.id, body.notes)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an incident' })
  update(@Param('id') id: string, @Body() body: UpdateIncidentDto, @CurrentUser() user: UserEntity) {
    return this.incidentService.update(id, body, user.id)
  }
}
