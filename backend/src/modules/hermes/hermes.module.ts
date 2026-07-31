import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AgentEntity } from "../../entities/agent.entity";
import { ManagedRuntimeEntity } from "../../entities";
import { EventsModule } from "../../gateways/events.module";
import { RuntimeModule } from "../runtime/runtime.module";
import { HermesBridgeRuntimeService } from "./hermes-bridge-runtime.service";
import { HermesRuntimeAdapter } from "./hermes-runtime.adapter";
import { HermesWorkerClient } from "./hermes-worker.client";

@Module({
  imports: [
    ConfigModule,
    EventsModule,
    RuntimeModule,
    TypeOrmModule.forFeature([AgentEntity, ManagedRuntimeEntity]),
  ],
  providers: [
    HermesRuntimeAdapter,
    HermesWorkerClient,
    HermesBridgeRuntimeService,
  ],
  exports: [
    HermesRuntimeAdapter,
    HermesWorkerClient,
    HermesBridgeRuntimeService,
  ],
})
export class HermesModule {}
