import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { WaitlistEntryEntity } from '../../entities/waitlist-entry.entity'
import { WaitlistController } from './waitlist.controller'
import { WaitlistService } from './waitlist.service'

@Module({
  imports: [TypeOrmModule.forFeature([WaitlistEntryEntity])],
  controllers: [WaitlistController],
  providers: [WaitlistService],
})
export class WaitlistModule {}
