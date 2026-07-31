import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type SlabCredentials = { apiToken: string };
type OperationType = "query" | "mutation";

export class SlabGraphqlError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SlabGraphqlAdapter {
  health(credentials: SlabCredentials) {
    return this.execute(credentials, "query", {
      document: "query RelaySlabHealth { currentUser { __typename } }",
      operationName: "RelaySlabHealth",
    });
  }

  query(credentials: SlabCredentials, input: JsonObject) {
    return this.execute(credentials, "query", input);
  }

  mutate(credentials: SlabCredentials, input: JsonObject) {
    return this.execute(credentials, "mutation", input);
  }

  private async execute(
    credentials: SlabCredentials,
    expected: OperationType,
    input: JsonObject,
  ) {
    this.requireCredentials(credentials);
    const document = this.requiredDocument(input.document);
    const operationName = this.optionalOperationName(input.operationName);
    this.assertOperation(document, expected, operationName);
    const variables = this.object(input.variables, "variables");
    this.rejectCredentialFields(variables);
    const body = JSON.stringify({
      query: document,
      ...(variables ? { variables } : {}),
      ...(operationName ? { operationName } : {}),
    });
    if (Buffer.byteLength(body) > 1_000_000) {
      throw new SlabGraphqlError(
        "provider_validation_error",
        "Slab GraphQL request exceeds 1 MB.",
      );
    }

    let response: Response;
    try {
      response = await safeConnectorFetch("https://api.slab.com/graphql", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: credentials.apiToken,
          "Content-Type": "application/json",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (error instanceof SlabGraphqlError) throw error;
      throw new SlabGraphqlError(
        "provider_unavailable",
        "Slab GraphQL could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 5_000_000) {
      throw new SlabGraphqlError(
        "provider_validation_error",
        "Slab GraphQL response exceeds 5 MB.",
      );
    }
    let payload: unknown;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      throw new SlabGraphqlError(
        "provider_unavailable",
        "Slab GraphQL returned an invalid response.",
        response.status,
      );
    }
    const redacted = this.redact(payload);
    if (!response.ok) {
      throw new SlabGraphqlError(
        this.safeCode(response.status),
        this.graphqlErrorMessage(redacted) ??
          `Slab GraphQL returned HTTP ${response.status}.`,
        response.status,
      );
    }
    const graphqlError = this.graphqlErrorMessage(redacted);
    if (graphqlError) {
      throw new SlabGraphqlError(
        this.graphqlErrorCode(redacted),
        graphqlError,
        response.status,
      );
    }
    return redacted;
  }

  private assertOperation(
    document: string,
    expected: OperationType,
    operationName?: string,
  ) {
    const tokens = this.lex(document);
    let braces = 0;
    let parentheses = 0;
    let brackets = 0;
    let maxBraces = 0;
    let fragmentDefinition = false;
    const operations: Array<{
      type: "query" | "mutation" | "subscription";
      name?: string;
    }> = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const atTopLevel = braces === 0 && parentheses === 0 && brackets === 0;
      if (
        atTopLevel &&
        token === "{" &&
        operations.length === 0 &&
        !fragmentDefinition
      ) {
        operations.push({ type: "query" });
      }
      if (token === "{") {
        braces += 1;
        maxBraces = Math.max(maxBraces, braces);
      } else if (token === "}") {
        braces -= 1;
        if (braces === 0) fragmentDefinition = false;
      }
      else if (token === "(") parentheses += 1;
      else if (token === ")") parentheses -= 1;
      else if (token === "[") brackets += 1;
      else if (token === "]") brackets -= 1;
      if (braces < 0 || parentheses < 0 || brackets < 0) {
        throw this.invalidDocument();
      }
      if (atTopLevel) {
        if (token === "fragment") fragmentDefinition = true;
        if (
          token === "query" ||
          token === "mutation" ||
          token === "subscription"
        ) {
          const next = tokens[index + 1];
          operations.push({
            type: token,
            name:
              next && /^[A-Za-z_][A-Za-z0-9_]*$/.test(next) ? next : undefined,
          });
        }
      }
      if (token === "__schema" || token === "__type") {
        throw new SlabGraphqlError(
          "policy_blocked",
          "Slab GraphQL introspection is not available to runtime agents.",
        );
      }
    }
    if (braces || parentheses || brackets || maxBraces > 20) {
      throw this.invalidDocument();
    }
    if (operations.length !== 1 || operations[0].type !== expected) {
      throw new SlabGraphqlError(
        "policy_blocked",
        `slab.${expected === "query" ? "query" : "mutate"} accepts exactly one ${expected} operation.`,
      );
    }
    if (operationName && operations[0].name !== operationName) {
      throw new SlabGraphqlError(
        "provider_validation_error",
        "operationName must match the single GraphQL operation.",
      );
    }
  }

  private lex(document: string) {
    const tokens: string[] = [];
    let index = 0;
    while (index < document.length) {
      const character = document[index];
      if (/\s|,/.test(character)) {
        index += 1;
        continue;
      }
      if (character === "#") {
        while (index < document.length && document[index] !== "\n") index += 1;
        continue;
      }
      if (document.startsWith('"""', index)) {
        index += 3;
        while (index < document.length && !document.startsWith('"""', index)) {
          index += document[index] === "\\" ? 2 : 1;
        }
        if (!document.startsWith('"""', index)) throw this.invalidDocument();
        index += 3;
        tokens.push("STRING");
        continue;
      }
      if (character === '"') {
        index += 1;
        let closed = false;
        while (index < document.length) {
          if (document[index] === "\\") index += 2;
          else if (document[index] === '"') {
            index += 1;
            closed = true;
            break;
          } else index += 1;
        }
        if (!closed) throw this.invalidDocument();
        tokens.push("STRING");
        continue;
      }
      const name = document.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
      if (name) {
        tokens.push(name);
        index += name.length;
      } else if ("{}()[]!$:=@|&".includes(character)) {
        tokens.push(character);
        index += 1;
      } else if (document.startsWith("...", index)) {
        tokens.push("...");
        index += 3;
      } else if (/[-+.0-9]/.test(character)) {
        const number = document
          .slice(index)
          .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/)?.[0];
        if (!number) throw this.invalidDocument();
        tokens.push("NUMBER");
        index += number.length;
      } else throw this.invalidDocument();
      if (tokens.length > 5_000) {
        throw new SlabGraphqlError(
          "provider_validation_error",
          "Slab GraphQL document has too many tokens.",
        );
      }
    }
    return tokens;
  }

  private requiredDocument(value: unknown) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      Buffer.byteLength(value) > 200_000
    ) {
      throw new SlabGraphqlError(
        "provider_validation_error",
        "document is required and must be at most 200 KB.",
      );
    }
    return value.trim();
  }

  private optionalOperationName(value: unknown) {
    if (value === undefined || value === null || value === "") return undefined;
    if (
      typeof value !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_]{0,199}$/.test(value)
    ) {
      throw new SlabGraphqlError(
        "provider_validation_error",
        "operationName is invalid.",
      );
    }
    return value;
  }

  private object(value: unknown, name: string): JsonObject | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new SlabGraphqlError(
        "provider_validation_error",
        `${name} must be an object.`,
      );
    }
    return value as JsonObject;
  }

  private requireCredentials(credentials: SlabCredentials) {
    if (!credentials.apiToken) {
      throw new SlabGraphqlError(
        "credential_missing",
        "Slab API token is required.",
        401,
      );
    }
  }

  private rejectCredentialFields(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12) {
        throw new SlabGraphqlError(
          "policy_blocked",
          "Slab GraphQL variables are too deeply nested.",
        );
      }
      if (Array.isArray(item)) {
        if (item.length > 500) {
          throw new SlabGraphqlError(
            "provider_validation_error",
            "Slab GraphQL variable arrays may contain at most 500 items.",
          );
        }
        item.forEach((entry) => walk(entry, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 500) {
        throw new SlabGraphqlError(
          "provider_validation_error",
          "Slab GraphQL variable objects may contain at most 500 fields.",
        );
      }
      for (const [key, entry] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        ) {
          throw new SlabGraphqlError(
            "policy_blocked",
            `Credential-bearing variable ${key} is not allowed.`,
          );
        }
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) {
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private graphqlErrorMessage(value: unknown) {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const errors = Array.isArray(body?.errors) ? body?.errors : [];
    const first = errors[0];
    if (!first || typeof first !== "object" || Array.isArray(first))
      return null;
    const message = (first as JsonObject).message;
    return typeof message === "string"
      ? `Slab GraphQL: ${message.slice(0, 500)}`
      : "Slab GraphQL request failed.";
  }

  private graphqlErrorCode(value: unknown): MarketplaceConnectorSafeErrorCode {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const first = Array.isArray(body?.errors) ? body?.errors[0] : null;
    const extensions =
      first && typeof first === "object" && !Array.isArray(first)
        ? (first as JsonObject).extensions
        : null;
    const code =
      extensions && typeof extensions === "object" && !Array.isArray(extensions)
        ? String((extensions as JsonObject).code ?? "").toUpperCase()
        : "";
    if (code.includes("UNAUTH")) return "credential_missing";
    if (code.includes("FORBIDDEN") || code.includes("PERMISSION"))
      return "insufficient_scope";
    if (code.includes("RATE")) return "provider_rate_limited";
    return "provider_validation_error";
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private invalidDocument() {
    return new SlabGraphqlError(
      "provider_validation_error",
      "Slab GraphQL document is syntactically invalid or exceeds nesting limits.",
    );
  }
}
