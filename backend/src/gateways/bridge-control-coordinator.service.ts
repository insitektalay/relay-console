import {
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { BridgeRuntimeType } from "../modules/bridge/bridge-compatibility-policy";

type BridgeControlAuthority = {
  workspaceId: string;
  runtimeType: BridgeRuntimeType;
  targetBridgeDeviceId?: string | null;
};

type PendingBridgeRequest = {
  allowedTypes: Set<string>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  authority: BridgeControlAuthority;
};

@Injectable()
export class BridgeControlCoordinatorService {
  private pendingRequests = new Map<string, PendingBridgeRequest>();

  registerRequest<T>(
    requestId: string,
    allowedTypes: string[],
    timeoutMs: number = 15_000,
    authority: BridgeControlAuthority,
  ): Promise<{ type: string; data: T }> {
    if (!requestId) {
      throw new ServiceUnavailableException(
        "Bridge control request is missing an id",
      );
    }

    if (this.pendingRequests.has(requestId)) {
      throw new ServiceUnavailableException(
        `Bridge control request ${requestId} is already pending`,
      );
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(
          new GatewayTimeoutException(
            `Timed out waiting for bridge control response ${requestId}`,
          ),
        );
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        allowedTypes: new Set(allowedTypes),
        resolve,
        reject,
        timeout,
        authority,
      });
    });
  }

  resolveFromBridgeMessage(
    message: {
      type: string;
      data?: Record<string, unknown> | null;
    },
    responder: BridgeControlAuthority,
  ): boolean {
    const requestId =
      typeof message.data?.requestId === "string"
        ? message.data.requestId
        : null;

    if (!requestId) {
      return false;
    }

    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return false;
    }

    if (!pending.allowedTypes.has(message.type)) {
      return false;
    }
    if (
      responder.workspaceId !== pending.authority.workspaceId ||
      responder.runtimeType !== pending.authority.runtimeType ||
      (pending.authority.targetBridgeDeviceId &&
        responder.targetBridgeDeviceId !==
          pending.authority.targetBridgeDeviceId)
    ) {
      return false;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);

    if (message.type.endsWith(".error")) {
      const errorMessage =
        typeof message.data?.error === "string"
          ? message.data.error
          : "Bridge control request failed";
      pending.reject(new ServiceUnavailableException(errorMessage));
      return true;
    }

    pending.resolve({
      type: message.type,
      data: message.data,
    });
    return true;
  }
}
