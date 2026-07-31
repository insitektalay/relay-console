import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { IncidentEntity } from '../../entities/incident.entity'
import { AlertEntity } from '../../entities/alert.entity'
import { IncidentService } from './incident.service'
import { IncidentController } from './incident.controller'
import { ResourceAccessModule } from '../resource-access/resource-access.module'

@Module({
  imports: [TypeOrmModule.forFeature([IncidentEntity, AlertEntity]), ResourceAccessModule],
  controllers: [IncidentController],
  providers: [IncidentService],
  exports: [IncidentService],
})
export class IncidentModule {}
