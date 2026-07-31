import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogEntity } from '../../entities'
import { WorkspaceMembershipModule } from '../workspace-membership/workspace-membership.module'
import { AuditLogController } from './audit-log.controller'
import { AuditLogService } from './audit-log.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLogEntity]),
    WorkspaceMembershipModule,
  ],
  providers: [AuditLogService],
  controllers: [AuditLogController],
  exports: [AuditLogService],
})
export class AuditLogModule {}
