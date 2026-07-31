import {
  Controller,
  Get,
  Header,
  HttpStatus,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import {
  OperatorAuthenticated,
  Public,
} from "../../common/decorators/public.decorator";
import { RelayOperatorGuard } from "../cloud-commercial/operator.guard";
import { HealthService } from "./health.service";
import { SyntheticMonitorService } from "./synthetic-monitor.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly syntheticMonitor: SyntheticMonitorService,
  ) {}

  @Public()
  @Get()
  check() {
    return this.healthService.live();
  }

  @Public()
  @Get("live")
  live() {
    return this.healthService.live();
  }

  @OperatorAuthenticated()
  @UseGuards(RelayOperatorGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get("ready")
  @Header("Cache-Control", "no-store")
  async ready(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.ready();
    if (!result.ok) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }

  @OperatorAuthenticated()
  @UseGuards(RelayOperatorGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Get("synthetic")
  @Header("Cache-Control", "no-store")
  async synthetic(@Res({ passthrough: true }) res: Response) {
    const result = await this.syntheticMonitor.check();
    if (!result.ok) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }

}
