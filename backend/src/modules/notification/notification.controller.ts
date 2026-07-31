import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { NotificationService } from './notification.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('alerts')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List alerts' })
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.notificationService.findAll(query, user.id)
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark alert as read' })
  markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationService.markRead(id, user.id)
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all alerts as read' })
  markAllRead(@Query('workspaceId') workspaceId: string, @CurrentUser() user: any) {
    return this.notificationService.markAllRead(workspaceId, user.id)
  }

  @Get('count')
  @ApiOperation({ summary: 'Get unread alert count' })
  getCount(@Query('workspaceId') workspaceId: string, @CurrentUser() user: any) {
    return this.notificationService.getUnreadCount(workspaceId, user.id)
  }
}
