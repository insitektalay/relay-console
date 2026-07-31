import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import {
  ScheduledThreadMessageEntity,
  TaskEntity,
  ThreadEntity,
  UserEntity,
} from '../../entities'
import { MeetingService } from './meeting.service'
import { MessageModule } from '../message/message.module'
import { ThreadModule } from '../thread/thread.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduledThreadMessageEntity,
      ThreadEntity,
      TaskEntity,
      UserEntity,
    ]),
    MessageModule,
    ThreadModule,
  ],
  providers: [MeetingService],
  exports: [MeetingService],
})
export class MeetingModule {}
