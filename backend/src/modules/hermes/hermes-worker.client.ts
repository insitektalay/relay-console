import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  HermesWorkerEvent,
  HermesWorkerHealth,
  HermesWorkerRunRequest,
} from "./hermes-worker.types";

@Injectable()
export class HermesWorkerClient {
  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    const configured = this.configService
      .get<string>("HERMES_WORKER_BASE_URL")
      ?.trim();
    if (!configured && this.isProduction()) {
      throw new Error("HERMES_WORKER_BASE_URL is required in production");
    }
    return this.validateBaseUrl(configured ?? "http://127.0.0.1:8765");
  }

  private get sharedSecret(): string {
    const secret = this.configService.get<string>(
      "HERMES_WORKER_SHARED_SECRET",
    );
    if (!secret) {
      throw new Error("HERMES_WORKER_SHARED_SECRET is not configured");
    }
    return secret;
  }

  private buildHeaders(
    sharedSecret = this.sharedSecret,
  ): Record<string, string> {
    if (Buffer.byteLength(sharedSecret, "utf8") < 32) {
      throw new Error("Hermes worker shared secret must be at least 32 bytes");
    }
    return {
      Authorization: `Bearer ${sharedSecret}`,
      "Content-Type": "application/json",
    };
  }

  async getHealth(target?: {
    baseUrl: string;
    sharedSecret: string;
  }): Promise<HermesWorkerHealth> {
    const response = await fetch(`${this.targetBaseUrl(target)}/health`, {
      headers: this.buildHeaders(target?.sharedSecret),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Hermes worker health check failed: ${response.status}`);
    }
    return (await response.json()) as HermesWorkerHealth;
  }

  async streamRun(
    input: HermesWorkerRunRequest,
    onEvent: (event: HermesWorkerEvent) => Promise<void> | void,
    target?: { baseUrl: string; sharedSecret: string },
  ): Promise<void> {
    const response = await fetch(
      `${this.targetBaseUrl(target)}/v1/runs/stream`,
      {
        method: "POST",
        headers: this.buildHeaders(target?.sharedSecret),
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(Math.min(input.timeoutMs + 15_000, 1_815_000)),
      },
    );

    if (!response.ok) {
      const text = (await response.text()).slice(0, 8_192);
      throw new Error(
        `Hermes worker stream failed with ${response.status}: ${text}`,
      );
    }

    if (!response.body) {
      throw new Error("Hermes worker returned an empty response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      if (Buffer.byteLength(buffer, "utf8") > 128 * 1024) {
        await reader.cancel();
        throw new Error("Hermes worker emitted an oversized event");
      }
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        await onEvent(JSON.parse(trimmed) as HermesWorkerEvent);
      }
    }

    if (buffer.trim()) {
      await onEvent(JSON.parse(buffer) as HermesWorkerEvent);
    }
  }

  async cancelRun(
    dispatchId: string,
    target?: { baseUrl: string; sharedSecret: string },
  ): Promise<void> {
    if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,199}$/.test(dispatchId)) {
      throw new Error("Hermes dispatchId is invalid");
    }
    const response = await fetch(
      `${this.targetBaseUrl(target)}/v1/runs/${dispatchId}/cancel`,
      {
        method: "POST",
        headers: this.buildHeaders(target?.sharedSecret),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok && response.status !== 404) {
      const text = (await response.text()).slice(0, 8_192);
      throw new Error(
        `Hermes worker cancel failed with ${response.status}: ${text}`,
      );
    }
  }

  private targetBaseUrl(target?: { baseUrl: string }) {
    return this.validateBaseUrl(target?.baseUrl ?? this.baseUrl);
  }

  private validateBaseUrl(value: string) {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      throw new Error("Hermes worker URL must be an origin");
    }
    if (this.isProduction()) {
      const hostname = url.hostname.toLowerCase();
      const isPrivateRailwayOrigin =
        url.protocol === "http:" &&
        url.port === "8765" &&
        /^relay-hermes-[a-z0-9](?:[a-z0-9-]{0,119}[a-z0-9])?\.railway\.internal$/.test(
          hostname,
        );
      if (!isPrivateRailwayOrigin) {
        throw new Error(
          "Production Hermes worker must use an exact Railway private service origin",
        );
      }
    } else if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Hermes worker URL must use HTTP or HTTPS");
    }
    return url.origin;
  }

  private isProduction() {
    return (
      this.configService.get<string>("NODE_ENV")?.trim().toLowerCase() ===
      "production"
    );
  }
}
