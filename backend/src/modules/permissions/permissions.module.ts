import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PermissionPolicyEntity } from '../../entities/permission-policy.entity'
import { PermissionsService } from './permissions.service'
import { PermissionsController } from './permissions.controller'
import { ResourceAccessModule } from '../resource-access/resource-access.module'
import { AuditLogModule } from '../audit-log/audit-log.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([PermissionPolicyEntity]),
    ResourceAccessModule,
    AuditLogModule,
  ],
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
