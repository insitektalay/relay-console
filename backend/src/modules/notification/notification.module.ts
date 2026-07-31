import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AlertEntity } from '../../entities/alert.entity'
import { NotificationService } from './notification.service'
import { NotificationController } from './notification.controller'
import { ResourceAccessModule } from '../resource-access/resource-access.module'

@Module({
  imports: [TypeOrmModule.forFeature([AlertEntity]), ResourceAccessModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
