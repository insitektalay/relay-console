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
import { OrgService } from './org.service'
import { CreateCompanyDto, UpdateCompanyDto, CreateManagerRelationshipDto } from './dto/org.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { UserEntity } from '../../entities/user.entity'

@ApiTags('org')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('org')
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Get('chart')
  @ApiOperation({ summary: 'Get full org chart for workspace' })
  getOrgChart(@Query('workspaceId') workspaceId: string, @CurrentUser() user: UserEntity) {
    return this.orgService.getOrgChart(workspaceId, user.id)
  }

  @Get('companies')
  @ApiOperation({ summary: 'List companies in workspace' })
  getCompanies(@Query('workspaceId') workspaceId: string, @CurrentUser() user: UserEntity) {
    return this.orgService.getCompanies(workspaceId, user.id)
  }

  @Post('companies')
  @ApiOperation({ summary: 'Create a company' })
  createCompany(@Body() dto: CreateCompanyDto, @CurrentUser() user: UserEntity) {
    return this.orgService.createCompany(dto, user.id)
  }

  @Get('companies/:id')
  @ApiOperation({ summary: 'Get company with departments' })
  getCompany(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.orgService.getCompany(id, user.id)
  }

  @Patch('companies/:id')
  @ApiOperation({ summary: 'Update company' })
  updateCompany(@Param('id') id: string, @Body() dto: UpdateCompanyDto, @CurrentUser() user: UserEntity) {
    return this.orgService.updateCompany(id, dto, user.id)
  }

  @Post('relationships')
  @ApiOperation({ summary: 'Create manager-report relationship' })
  createRelationship(@Body() dto: CreateManagerRelationshipDto, @CurrentUser() user: UserEntity) {
    return this.orgService.createManagerRelationship(dto.managerId, dto.reportId, user.id)
  }

  @Delete('relationships/:managerId/:reportId')
  @ApiOperation({ summary: 'Delete manager-report relationship' })
  deleteRelationship(
    @Param('managerId') managerId: string,
    @Param('reportId') reportId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.orgService.deleteManagerRelationship(managerId, reportId, user.id)
  }
}
