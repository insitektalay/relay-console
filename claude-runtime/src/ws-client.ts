import WebSocket from "ws";
import { Logger } from "./logger";

type DispatchHandler = (payload: Record<string, unknown>) => Promise<void>;
type ControlHandler = (
  eventType: string,
  payload: Record<string, unknown>,
  reply: (type: string, data: Record<string, unknown>) => void,
) => Promise<boolean> | boolean;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WsClient {
  private socket: WebSocket | null = null;
  private readonly logger = new Logger("ws");
  private closedManually = false;
  private reconnectLoop: Promise<void> | null = null;

  constructor(
    private readonly wsUrl: string,
    private readonly getAccessToken: () => Promise<string> | string,
    private readonly workspaceId: string,
    private readonly agentExternalIds: string[],
    private readonly onDispatch: DispatchHandler,
    private readonly onControl?: ControlHandler,
    private readonly controlCapabilities: string[] = [],
  ) {}

  async connect() {
    this.closedManually = false;
    await this.connectWithRetry();
  }

  async close() {
    this.closedManually = true;
    const socket = this.socket;
    this.socket = null;
    if (!socket) {
      return;
    }

    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close();
      setTimeout(() => resolve(), 1000);
    });
  }

  private async connectWithRetry() {
    while (!this.closedManually) {
      try {
        await this.openSocket();
        return;
      } catch (error) {
        this.logger.error(
          `websocket connect failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        await sleep(2000);
      }
    }
  }

  private scheduleReconnect() {
    if (this.closedManually || this.reconnectLoop) {
      return;
    }

    this.reconnectLoop = (async () => {
      this.logger.warn("attempting websocket reconnect");
      try {
        await this.connectWithRetry();
      } finally {
        this.reconnectLoop = null;
      }
    })();
  }

  private async openSocket() {
    const token = await this.getAccessToken();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let authenticated = false;
      let bridgeControlSubscribed = false;
      const socket = new WebSocket(this.wsUrl);
      this.socket = socket;

      const finishResolve = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const finishReject = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      socket.once("open", () => {
        socket.send(
          JSON.stringify({
            type: "authenticate",
            token,
            capabilities: this.controlCapabilities,
          }),
        );
      });

      socket.on("message", (raw) => {
        try {
          const event = JSON.parse(String(raw)) as {
            type: string;
            data?: Record<string, unknown>;
          };

          if (event.type === "authenticated") {
            authenticated = true;
            socket.send(
              JSON.stringify({
                type: "subscribe_bridge_control",
                workspaceId: this.workspaceId,
                capabilities: this.controlCapabilities,
              }),
            );
            return;
          }

          if (event.type === "subscribed_bridge_control") {
            bridgeControlSubscribed = true;
            for (const externalAgentId of this.agentExternalIds) {
              socket.send(
                JSON.stringify({
                  type: "register_bridge_agent",
                  externalAgentId,
                }),
              );
            }
            this.logger.info("websocket authenticated");
            finishResolve();
            return;
          }

          if (event.type === "agent.dispatch" && event.data) {
            void this.onDispatch(event.data).catch((error: Error) => {
              this.logger.error("dispatch handler failed", error.message);
            });
            return;
          }

          if (event.data?.requestId && this.onControl) {
            void Promise.resolve(
              this.onControl(event.type, event.data, (type, data) => {
                if (socket.readyState !== WebSocket.OPEN) {
                  return;
                }
                socket.send(JSON.stringify({ type, data }));
              }),
            ).catch((error: Error) => {
              this.logger.error("control handler failed", error.message);
            });
            return;
          }

          if (event.type === "error") {
            const message =
              typeof event.data?.message === "string"
                ? event.data.message
                : "unknown websocket error";
            finishReject(new Error(message));
          }
        } catch (error) {
          finishReject(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      });

      socket.once("error", (error) => {
        if (!authenticated) {
          finishReject(error);
          return;
        }
        this.logger.error(`websocket error: ${error.message}`);
      });

      socket.on("close", () => {
        this.socket = null;
        this.logger.warn("websocket closed");
        if (!authenticated) {
          finishReject(new Error("websocket closed before authentication"));
          return;
        }
        if (!bridgeControlSubscribed) {
          finishReject(
            new Error("websocket closed before bridge control subscription"),
          );
          return;
        }
        if (!this.closedManually) {
          this.scheduleReconnect();
        }
      });
    });
  }
}
