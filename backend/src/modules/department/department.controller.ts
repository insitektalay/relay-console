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
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { DepartmentService } from './department.service'
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { PaginationDto } from '../../common/dto/pagination.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { UserEntity } from '../../entities/user.entity'

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @ApiOperation({ summary: 'List departments' })
  findAll(
    @Query('workspaceId') workspaceId: string,
    @Query('companyId') companyId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.departmentService.findAll({ workspaceId, companyId }, user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Create department' })
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() user: UserEntity) {
    return this.departmentService.create(dto, user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get department detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.departmentService.findOne(id, user.id)
  }

  @Get(':id/dashboard')
  @ApiOperation({ summary: 'Get department dashboard' })
  getDashboard(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.departmentService.getDashboard(id, user.id)
  }

  @Get(':id/inbox')
  @ApiOperation({ summary: 'Get department inbox (alerts, incidents, reports)' })
  getInbox(@Param('id') id: string, @Query() pagination: PaginationDto, @CurrentUser() user: UserEntity) {
    return this.departmentService.getDepartmentInbox(id, user.id, pagination.page, pagination.pageSize)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update department' })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto, @CurrentUser() user: UserEntity) {
    return this.departmentService.update(id, dto, user.id)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete department' })
  delete(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.departmentService.delete(id, user.id)
  }
}
