import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EncryptionService } from "./encryption.service";
import { DistributedRateLimitService } from "./distributed-rate-limit.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [EncryptionService, DistributedRateLimitService],
  exports: [EncryptionService, DistributedRateLimitService],
})
export class SecurityModule {}
