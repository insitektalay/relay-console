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
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { PermissionsService } from './permissions.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { UserEntity } from '../../entities/user.entity'
import {
  CreatePermissionPolicyDto,
  PermissionWorkspaceQueryDto,
  UpdatePermissionPolicyDto,
} from './dto/permissions.dto'

@ApiTags('permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@UsePipes(new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
}))
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List permission policies' })
  findAll(@Query() query: PermissionWorkspaceQueryDto, @CurrentUser() user: UserEntity) {
    return this.permissionsService.findAll(query.workspaceId, user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Create permission policy' })
  create(@Body() body: CreatePermissionPolicyDto, @CurrentUser() user: UserEntity) {
    return this.permissionsService.create(body, user.id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update permission policy' })
  update(
    @Param('id') id: string,
    @Body() body: UpdatePermissionPolicyDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.permissionsService.update(id, body.permissions, user.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete permission policy' })
  delete(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.permissionsService.delete(id, user.id)
  }
}
