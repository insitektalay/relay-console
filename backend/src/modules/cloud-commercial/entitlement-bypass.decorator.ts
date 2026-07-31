import { SetMetadata } from "@nestjs/common";

export const ENTITLEMENT_WRITE_BYPASS_KEY = "relay.entitlement-write-bypass";
export const AllowReadOnlyEntitlement = () => SetMetadata(ENTITLEMENT_WRITE_BYPASS_KEY, true);
