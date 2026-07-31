import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "crypto";

@Injectable()
export class RelayOperatorGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configured = this.config.get<string>("RELAY_OPERATOR_API_SECRET")?.trim();
    const supplied = context.switchToHttp().getRequest().get("x-relay-operator-secret")?.trim();
    if (!configured || !supplied) throw new UnauthorizedException("OPERATOR_AUTH_REQUIRED");
    const expected = createHash("sha256").update(configured).digest();
    const actual = createHash("sha256").update(supplied).digest();
    if (!timingSafeEqual(expected, actual)) throw new UnauthorizedException("OPERATOR_AUTH_INVALID");
    return true;
  }
}
