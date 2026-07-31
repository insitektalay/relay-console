import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  MarketplaceConnectionEntity,
  LinkedApplicationEntity,
  ScheduledThreadMessageEntity,
  TaskEntity,
  ToolRequestEntity,
} from "../../entities";
import { ToolRequestService } from "./tool-request.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ToolRequestEntity,
      LinkedApplicationEntity,
      MarketplaceConnectionEntity,
      TaskEntity,
      ScheduledThreadMessageEntity,
    ]),
  ],
  providers: [ToolRequestService],
  exports: [ToolRequestService],
})
export class ToolRequestModule {}
