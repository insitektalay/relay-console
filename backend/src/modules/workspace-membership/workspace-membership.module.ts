import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import {
  WorkspaceEntity,
  WorkspaceMemberEntity,
} from '../../entities'
import { WorkspaceMembershipService } from './workspace-membership.service'

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceEntity, WorkspaceMemberEntity])],
  providers: [WorkspaceMembershipService],
  exports: [WorkspaceMembershipService],
})
export class WorkspaceMembershipModule {}
