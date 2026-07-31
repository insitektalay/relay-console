import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PaperclipConnectionEntity } from '../../entities/paperclip-connection.entity'
import { PaperclipThreadLinkEntity } from '../../entities/paperclip-thread-link.entity'
import { ThreadEntity } from '../../entities/thread.entity'
import { WorkspaceMembershipModule } from '../workspace-membership/workspace-membership.module'
import { SecurityModule } from '../security/security.module'
import { PaperclipController } from './paperclip.controller'
import { PaperclipApiClientService } from './paperclip-api-client.service'
import { PaperclipConnectionService } from './paperclip-connection.service'
import { PaperclipThreadLinkService } from './paperclip-thread-link.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaperclipConnectionEntity,
      PaperclipThreadLinkEntity,
      ThreadEntity,
    ]),
    WorkspaceMembershipModule,
    SecurityModule,
  ],
  controllers: [PaperclipController],
  providers: [
    PaperclipApiClientService,
    PaperclipConnectionService,
    PaperclipThreadLinkService,
  ],
  exports: [PaperclipConnectionService, PaperclipThreadLinkService],
})
export class PaperclipModule {}
