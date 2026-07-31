import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ApprovalService } from './approval.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import { ApprovalActionDto, ApprovalQueryDto } from './dto/approval.dto'
import { UserEntity } from '../../entities/user.entity'

@ApiTags('approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  @ApiOperation({ summary: 'List approvals' })
  findAll(@Query() query: ApprovalQueryDto, @CurrentUser() user: UserEntity) {
    return this.approvalService.findAll(query, user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get approval detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.approvalService.findOne(id, user.id)
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a request' })
  approve(@Param('id') id: string, @CurrentUser() user: UserEntity, @Body() body: ApprovalActionDto) {
    return this.approvalService.resolve(id, user.id, 'approved', body.notes)
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a request' })
  reject(@Param('id') id: string, @CurrentUser() user: UserEntity, @Body() body: ApprovalActionDto) {
    return this.approvalService.resolve(id, user.id, 'rejected', body.notes)
  }
}
