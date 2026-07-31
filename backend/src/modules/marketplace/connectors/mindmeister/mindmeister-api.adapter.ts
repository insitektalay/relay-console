import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Operation = { id: string; api: "v1" | "v2"; method: "GET" | "POST"; target: string; binary?: boolean };

export const MINDMEISTER_READ_OPERATIONS: readonly Operation[] = [
  { id: "profile.get", api: "v2", method: "GET", target: "/users/me" },
  { id: "maps.list", api: "v2", method: "GET", target: "/maps" },
  { id: "maps.get", api: "v2", method: "GET", target: "/maps/{id}" },
  { id: "maps.export_pdf", api: "v2", method: "GET", target: "/maps/{id}.pdf", binary: true },
  { id: "maps.export_docx", api: "v2", method: "GET", target: "/maps/{id}.docx", binary: true },
  { id: "maps.presentation", api: "v2", method: "GET", target: "/maps/{id}/presentation.zip", binary: true },
  { id: "maps.image", api: "v2", method: "GET", target: "/map_images/{id}.{format}", binary: true },
  { id: "maps.rights", api: "v2", method: "GET", target: "/maps/{mapId}/rights" },
  { id: "maps.right", api: "v2", method: "GET", target: "/maps/{mapId}/rights/{id}" },
  { id: "files.attachment", api: "v2", method: "GET", target: "/files/{id}/attachment", binary: true },
  ...[
    "mm.folders.contents", "mm.folders.getList", "mm.ideas.getMap", "mm.maps.export", "mm.maps.getChannel", "mm.maps.getCollaborators", "mm.maps.getList", "mm.maps.getMap", "mm.maps.getNotification", "mm.maps.getPublicList", "mm.maps.getPublicMap", "mm.maps.getSlides", "mm.maps.getTemplates", "mm.maps.history", "mm.people.getFriends", "mm.people.getInfo", "mm.provisioning.listTeams", "mm.reflection.APIVersion", "mm.reflection.getMethodInfo", "mm.reflection.getMethods", "mm.test.echo",
  ].map((target) => ({ id: `v1.${target}`, api: "v1" as const, method: "GET" as const, target })),
];

export const MINDMEISTER_WRITE_OPERATIONS: readonly Operation[] = [
  ...[
    "mm.files.add", "mm.folders.add", "mm.folders.delete", "mm.folders.move", "mm.folders.rename", "mm.ideas.toggleClosed", "mm.maps.add", "mm.maps.delete", "mm.maps.duplicate", "mm.maps.import", "mm.maps.move", "mm.maps.newFromTemplate", "mm.maps.publish", "mm.maps.redo", "mm.maps.revert", "mm.maps.setMetaData", "mm.maps.setNotification", "mm.maps.share", "mm.maps.unPublish", "mm.maps.unShare", "mm.maps.undo", "mm.maps.withdraw", "mm.provisioning.addUser", "mm.provisioning.changePlan", "mm.provisioning.changeStatus", "mm.provisioning.create", "mm.provisioning.joinTeam", "mm.provisioning.removeUser",
  ].map((target) => ({ id: `v1.${target}`, api: "v1" as const, method: "POST" as const, target })),
];

export class MindMeisterApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

@Injectable()
export class MindMeisterApiAdapter {
  health(accessToken: string) { return this.callRead(accessToken, { operation: "profile.get" }); }
  callRead(accessToken: string, input: JsonObject) { return this.call(accessToken, input, MINDMEISTER_READ_OPERATIONS); }
  callWrite(accessToken: string, input: JsonObject) { return this.call(accessToken, input, MINDMEISTER_WRITE_OPERATIONS); }

  private async call(accessToken: string, input: JsonObject, allowed: readonly Operation[]) {
    if (!accessToken?.trim() || accessToken.length > 10_000) throw new MindMeisterApiError("credential_missing", "MindMeister OAuth access token is required.", 401);
    const id = typeof input.operation === "string" ? input.operation.trim() : "";
    const operation = allowed.find((item) => item.id === id);
    if (!operation) throw new MindMeisterApiError("provider_validation_error", "MindMeister operation is outside the supported API boundary.");
    const params = this.object(input.params); const query = this.object(input.query);
    this.rejectCredentials(params); this.rejectCredentials(query);
    const url = operation.api === "v1"
      ? new URL("https://www.mindmeister.com/services/rest/oauth2")
      : new URL(`https://www.mindmeister.com/api/v2${this.expand(operation.target, params)}`);
    if (operation.api === "v1") url.searchParams.set("method", operation.target);
    this.appendQuery(url.searchParams, query);
    const body = operation.method === "POST" ? new URLSearchParams(this.scalarRecord(params)) : undefined;
    try {
      const response = await safeConnectorFetch(url, { method: operation.method, headers: { Accept: operation.binary ? "application/octet-stream" : "application/json", Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body, redirect: "error", signal: AbortSignal.timeout(30_000) });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 16_000_000) throw new MindMeisterApiError("provider_validation_error", "MindMeister response exceeds 16 MB.");
      let data: unknown;
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (operation.binary || (!contentType.includes("json") && !contentType.includes("xml"))) data = { contentType: contentType.split(";")[0] || "application/octet-stream", dataBase64: raw.toString("base64") };
      else if (contentType.includes("json")) { try { data = raw.length ? JSON.parse(raw.toString("utf8")) : null; } catch { data = { content: raw.toString("utf8").slice(0, 1_000_000) }; } }
      else data = { contentType: "application/xml", content: raw.toString("utf8").slice(0, 2_000_000) };
      data = this.redact(data);
      if (!response.ok) throw new MindMeisterApiError(this.safeCode(response.status), this.message(data) ?? `MindMeister returned HTTP ${response.status}.`, response.status);
      return data;
    } catch (error) {
      if (error instanceof MindMeisterApiError) throw error;
      throw new MindMeisterApiError("provider_unavailable", "MindMeister could not be reached.", 502);
    }
  }

  private expand(template: string, params: JsonObject) {
    const consumed = new Set<string>();
    const path = template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_, key: string) => { const value = params[key]; consumed.add(key); if (typeof value !== "string" && typeof value !== "number") throw new MindMeisterApiError("provider_validation_error", `MindMeister ${key} is required.`); const text = String(value); if (!/^[A-Za-z0-9._~-]{1,300}$/.test(text)) throw new MindMeisterApiError("provider_validation_error", `MindMeister ${key} is invalid.`); return encodeURIComponent(text); });
    if (Object.keys(params).some((key) => !consumed.has(key))) throw new MindMeisterApiError("provider_validation_error", "MindMeister path parameters contain unsupported fields.");
    return path;
  }
  private appendQuery(target: URLSearchParams, query: JsonObject) { if (Object.keys(query).length > 50) throw new MindMeisterApiError("provider_validation_error", "MindMeister request has too many query fields."); for (const [key, value] of Object.entries(query)) { if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) throw new MindMeisterApiError("provider_validation_error", "MindMeister query key is invalid."); for (const item of Array.isArray(value) ? value.slice(0, 100) : [value]) { if (!["string", "number", "boolean"].includes(typeof item)) throw new MindMeisterApiError("provider_validation_error", `MindMeister query field ${key} must be scalar.`); target.append(key, String(item).slice(0, 20_000)); } } }
  private scalarRecord(value: JsonObject) { const result: Record<string, string> = {}; if (Object.keys(value).length > 100) throw new MindMeisterApiError("provider_validation_error", "MindMeister request has too many fields."); for (const [key, item] of Object.entries(value)) { if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key) || !["string", "number", "boolean"].includes(typeof item)) throw new MindMeisterApiError("provider_validation_error", `MindMeister field ${key} must be scalar.`); result[key] = String(item).slice(0, 100_000); } return result; }
  private object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
  private rejectCredentials(value: unknown, depth = 0) { if (!value || typeof value !== "object") return; if (depth > 12) throw new MindMeisterApiError("policy_blocked", "MindMeister request is too deeply nested.", 403); for (const [key, item] of Object.entries(value as JsonObject)) { if (/(authorization|access.?token|refresh.?token|client.?secret|api.?key|password|cookie|credential)/i.test(key)) throw new MindMeisterApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403); this.rejectCredentials(item, depth + 1); } }
  private redact(value: unknown, depth = 0): unknown { if (depth > 20) return "[truncated]"; if (typeof value === "string") return value.slice(0, 4_000_000); if (Array.isArray(value)) return value.slice(0, 5000).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 10_000).map(([key, item]) => [key, /(token|secret|password|authorization|cookie|credential)/i.test(key) ? "[redacted]" : this.redact(item, depth + 1)])); }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "token_expired"; if (status === 403) return "insufficient_scope"; if (status === 429) return "provider_rate_limited"; if (status >= 500) return "provider_unavailable"; return "provider_validation_error"; }
  private message(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) return null; const object = value as JsonObject; const candidate = object.message ?? object.error_description ?? object.error; return typeof candidate === "string" ? candidate.slice(0, 500) : null; }
}
