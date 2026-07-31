import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { WorkLogEntity } from '../../entities/work-log.entity'
import { WorkLogsService } from './worklogs.service'
import { WorkLogsController } from './worklogs.controller'
import { ResourceAccessModule } from '../resource-access/resource-access.module'

@Module({
  imports: [TypeOrmModule.forFeature([WorkLogEntity]), ResourceAccessModule],
  controllers: [WorkLogsController],
  providers: [WorkLogsService],
  exports: [WorkLogsService],
})
export class WorkLogsModule {}
