import { createHash } from "node:crypto";
import { safeOutboundHttpClient } from "../../../common/security/safe-outbound-http";
import {
  type MarketplaceExtractedEndpoint,
  type MarketplaceExtractedSourceCoverage,
  type MarketplaceExtractedSourceModel,
  type MarketplacePackFactoryConfig,
  type MarketplacePackSource,
  type MarketplacePackSourceKind,
} from "./types";

export function summarizeDocsCoverage(config: MarketplacePackFactoryConfig) {
  const docs = config.docs ?? {};
  return {
    apiOverview: Boolean(docs.apiOverview),
    auth: Boolean(docs.auth),
    scopes: Boolean(docs.scopes),
    rateLimits: Boolean(docs.rateLimits),
    webhooks: Boolean(docs.webhooks),
    openApiSpec: Boolean(docs.openApiSpec),
    postmanCollection: Boolean(docs.postmanCollection),
    mcpManifest: Boolean(docs.mcpManifest),
  };
}

export type DocsSourceInput = MarketplacePackSource & {
  text?: string;
};

const MAX_DOC_SOURCES = 8;
const MAX_INLINE_SOURCE_BYTES = 100_000;
const MAX_TOTAL_INLINE_BYTES = 350_000;
const MAX_FETCHED_SOURCE_BYTES = 400_000;

export interface DocsSourceImportLimits {
  maxSources?: number;
  maxInlineSourceBytes?: number;
  maxTotalInlineBytes?: number;
}

export async function importDocsSources(
  sources: DocsSourceInput[],
  limits: DocsSourceImportLimits = {},
): Promise<MarketplaceExtractedSourceModel> {
  const maxSources = limits.maxSources ?? MAX_DOC_SOURCES;
  const maxInlineSourceBytes =
    limits.maxInlineSourceBytes ?? MAX_INLINE_SOURCE_BYTES;
  const maxTotalInlineBytes =
    limits.maxTotalInlineBytes ?? MAX_TOTAL_INLINE_BYTES;
  if (sources.length > maxSources) {
    throw new Error(`At most ${maxSources} documentation sources may be imported.`);
  }
  let totalInlineBytes = 0;
  const imported = await Promise.all(
    sources.map(async (source) => {
      if (source.text || source.notes) {
        const text = source.text ?? source.notes ?? "";
        const bytes = Buffer.byteLength(text, "utf8");
        totalInlineBytes += bytes;
        if (
          bytes > maxInlineSourceBytes ||
          totalInlineBytes > maxTotalInlineBytes
        ) {
          throw new Error("Inline documentation exceeds the import byte limit.");
        }
        return {
          source,
          text,
          status: "imported" as const,
          contentType: "text/markdown",
          contentHash: hashText(text),
        };
      }
      if (!source.url) {
        return {
          source,
          text: "",
          status: "not_imported" as const,
          error: "No URL or inline notes supplied.",
        };
      }
      try {
        const fetched = await fetchSourceText(source.url);
        return {
          source,
          text: fetched.text,
          status: "imported" as const,
          contentType: fetched.contentType,
          contentHash: hashText(fetched.text),
        };
      } catch (error) {
        return {
          source,
          text: "",
          status: "failed" as const,
          error: error instanceof Error ? error.message : "Source import failed.",
        };
      }
    }),
  );
  return extractDocsSourceModel(imported);
}

export function extractDocsSourceModel(
  importedSources: Array<{
    source: DocsSourceInput;
    text: string;
    status: "imported" | "failed" | "not_imported";
    contentType?: string;
    contentHash?: string;
    error?: string;
  }>,
): MarketplaceExtractedSourceModel {
  const extractedAt = new Date().toISOString();
  const sourceUrls = importedSources
    .map((item) => item.source.url)
    .filter((url): url is string => Boolean(url));
  const combined = importedSources.map((item) => item.text).join("\n\n");
  const importedMetadata = importedSources
    .filter((item) => item.status === "imported")
    .map((item) => `${item.source.kind} ${item.source.title ?? ""} ${item.source.url ?? ""}`)
    .join("\n");
  const sourceSummaries = importedSources.map((item) => {
    const signals = detectSignals(item.text, item.source.kind);
    return {
      kind: item.source.kind,
      url: item.source.url,
      title: item.source.title,
      official: item.source.official,
      status: item.status,
      contentLength: item.text.length || undefined,
      contentHash: item.contentHash,
      error: item.error,
      signals,
    };
  });
  const endpoints = dedupeEndpoints([
    ...extractHttpEndpoints(combined),
    ...extractRpcMethodEndpoints(combined),
  ]);
  const objects = dedupe([
    ...extractObjects(combined),
    ...endpoints.map((endpoint) => endpoint.family),
  ]).slice(0, 18);
  const endpointFamilies = buildEndpointFamilies(endpoints, objects);
  const authTypes = dedupe([
    /oauth/i.test(combined) ? "oauth" : "",
    /bearer/i.test(combined) ? "bearer_token" : "",
    /bot token|xoxb/i.test(combined) ? "bot_token" : "",
    /api key/i.test(combined) ? "api_key" : "",
  ].filter(Boolean));
  const scopeSignals = extractLines(combined, /scope|permission|x-oauth-scopes/i, 8);
  const rateLimitSignals = extractLines(combined, /rate.?limit|429|retry-after|per minute|per second/i, 8);
  const webhookSignals = extractLines(combined, /webhook|events api|event subscription|callback|socket mode/i, 8);
  const safetySignals = extractLines(
    combined,
    /secret|token|client_secret|delete|admin|publish|send|postmessage|external|bulk/i,
    10,
  );
  const workflowSignals = inferWorkflowSignals(combined, endpoints);
  const exampleSignals = extractLines(combined, /example|request|response|curl|http/i, 8);
  const highRiskSignals = dedupe([
    ...extractLines(combined, /send|post|invite|delete|admin|export|bulk|external|secret|token/i, 12),
    ...endpoints
      .filter((endpoint) => /post|send|delete|invite|admin|export|webhook/i.test(endpoint.path))
      .map((endpoint) => endpoint.path),
  ]).slice(0, 16);
  const coverage: MarketplaceExtractedSourceCoverage = {
    apiOverview: hasKind(importedSources, "official_api_docs") || /web api|api overview|reference/i.test(combined),
    auth: hasKind(importedSources, "auth_docs") || /oauth|authentication|authorization|bearer token/i.test(combined),
    scopes: /scope|permission|x-oauth-scopes/i.test(`${combined}\n${importedMetadata}`),
    rateLimits: /rate.?limit|429|retry-after/i.test(`${combined}\n${importedMetadata}`),
    webhooks: hasKind(importedSources, "webhook_docs") || /webhook|events api|event subscription/i.test(`${combined}\n${importedMetadata}`),
    errors: /error|status code|http 4|http 5|429|retry-after|troubleshoot/i.test(`${combined}\n${importedMetadata}`),
    endpoints:
      endpoints.length > 0 ||
      /endpoint|reference|api-reference|rest|graphql|method|resource/i.test(importedMetadata),
    objects:
      objects.length > 0 ||
      /object|resource|entity|model|database|record|customer|contact|issue|message/i.test(importedMetadata),
    safetyPolicy: safetySignals.length > 0,
    workflows: workflowSignals.length > 0,
    examples: exampleSignals.length > 0,
    officialSources: importedSources.some((item) => item.source.official && item.status === "imported"),
  };
  const missingSections = [
    !coverage.apiOverview ? "official API overview" : null,
    !coverage.auth ? "auth docs" : null,
    !coverage.scopes ? "scopes or permission docs" : null,
    !coverage.rateLimits ? "rate limit docs" : null,
    !coverage.webhooks ? "webhook/event docs" : null,
    !coverage.errors ? "error docs" : null,
    !coverage.endpoints ? "endpoint extraction" : null,
    !coverage.objects ? "object extraction" : null,
  ].filter((item): item is string => Boolean(item));
  const ingestionErrors = importedSources
    .filter((item) => item.error)
    .map((item) => ({
      source: item.source.url ?? item.source.title ?? item.source.kind,
      error: item.error ?? "Import failed.",
    }));
  return {
    extractedAt,
    sourceUrls,
    sourceSummaries,
    coverage,
    objects,
    authTypes,
    scopeSignals,
    rateLimitSignals,
    webhookSignals,
    endpoints,
    endpointFamilies,
    workflowSignals,
    safetySignals,
    exampleSignals,
    highRiskSignals,
    missingSections,
    warnings: [
      "Extracted from provider source material. Review before publishing.",
      ingestionErrors.length ? "One or more sources failed ingestion." : null,
      missingSections.length ? "Some source coverage is still missing." : null,
    ].filter((item): item is string => Boolean(item)),
    ingestionErrors,
  };
}

async function fetchSourceText(url: string) {
  const response = await safeOutboundHttpClient.getText(url, {
    maxBytes: MAX_FETCHED_SOURCE_BYTES,
    maxRedirects: 3,
    timeoutMs: 15_000,
    allowedContentTypes:
      /^(text\/|application\/(?:json|ld\+json|xml|xhtml\+xml|yaml|x-yaml))/i,
    headers: {
      accept: "text/html, text/markdown, text/plain, application/json;q=0.8",
      "accept-encoding": "gzip, deflate, br",
      "user-agent": "ClawChat-PackFactory/1.0 (+https://claw.chat)",
    },
  });
  return {
    contentType: response.contentType,
    text: normalizeSourceText(response.text, response.contentType).slice(
      0,
      350_000,
    ),
  };
}

function normalizeSourceText(raw: string, contentType: string) {
  if (/html/i.test(contentType) || /<html|<body|<main/i.test(raw)) {
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return raw.trim();
}

function detectSignals(text: string, kind: MarketplacePackSourceKind) {
  const signals = [
    /oauth|bearer|authentication|authorization/i.test(text) ? "auth" : "",
    /scope|permission/i.test(text) ? "scopes" : "",
    /rate.?limit|429|retry-after/i.test(text) ? "rate_limits" : "",
    /webhook|events api|event subscription/i.test(text) ? "webhooks" : "",
    /GET|POST|PATCH|DELETE|\/api\/|[a-z]+\.[a-z]/.test(text) ? "endpoints" : "",
    kind === "manual_notes" ? "manual_notes" : "",
  ].filter(Boolean);
  return dedupe(signals);
}

function extractHttpEndpoints(text: string): MarketplaceExtractedEndpoint[] {
  const endpoints: MarketplaceExtractedEndpoint[] = [];
  const pattern = /\b(GET|POST|PUT|PATCH|DELETE)\s+(https?:\/\/[^\s)]+|\/[A-Za-z0-9_./{}:-]+)/gi;
  for (const match of text.matchAll(pattern)) {
    const method = match[1].toUpperCase();
    const rawPath = match[2].replace(/[),.;]+$/g, "");
    const path = rawPath.startsWith("http") ? new URL(rawPath).pathname : rawPath;
    endpoints.push({
      method,
      path,
      family: endpointFamilyFromPath(path),
      summary: `${method} ${path}`,
    });
  }
  return endpoints.slice(0, 80);
}

function extractRpcMethodEndpoints(text: string): MarketplaceExtractedEndpoint[] {
  const endpoints: MarketplaceExtractedEndpoint[] = [];
  const pattern = /\b([a-z][a-z0-9_]*\.[a-z][a-z0-9_.]*)\b/g;
  for (const match of text.matchAll(pattern)) {
    const methodName = match[1];
    if (!/^(admin|api|apps|auth|bots|calls|canvases|chat|conversations|files|reactions|reminders|search|stars|team|users|views|workflows)\./.test(methodName)) {
      continue;
    }
    endpoints.push({
      method: "POST",
      path: `https://slack.com/api/${methodName}`,
      family: methodName.split(".")[0],
      summary: methodName,
    });
  }
  return endpoints.slice(0, 120);
}

function extractObjects(text: string) {
  const objectTerms = [
    "channels",
    "conversations",
    "messages",
    "threads",
    "users",
    "files",
    "events",
    "webhooks",
    "teams",
    "groups",
    "apps",
    "reactions",
    "views",
    "workflows",
    "customers",
    "invoices",
    "subscriptions",
    "payments",
    "issues",
    "projects",
    "documents",
    "records",
  ];
  return objectTerms.filter((term) => new RegExp(`\\b${term}\\b`, "i").test(text));
}

function buildEndpointFamilies(endpoints: MarketplaceExtractedEndpoint[], objects: string[]) {
  const families = new Map<string, MarketplaceExtractedEndpoint[]>();
  for (const endpoint of endpoints) {
    const current = families.get(endpoint.family) ?? [];
    current.push(endpoint);
    families.set(endpoint.family, current);
  }
  for (const object of objects) {
    if (!families.has(object)) families.set(object, []);
  }
  return [...families.entries()].slice(0, 12).map(([family, familyEndpoints]) => ({
    id: slugId(family),
    label: title(family),
    guidance: `Extracted ${title(family)} provider operations from imported source material. Reads are safest; writes must follow capability and approval policy.`,
    representativeEndpoints: familyEndpoints.length
      ? familyEndpoints.slice(0, 8).map((endpoint) =>
          [endpoint.method, endpoint.path].filter(Boolean).join(" "),
        )
      : [`${title(family)} operations mentioned in source material`],
  }));
}

function inferWorkflowSignals(text: string, endpoints: MarketplaceExtractedEndpoint[]) {
  return dedupe([
    /history|list|search|read/i.test(text) ? "read_and_summarize" : "",
    /draft|preview|prepare/i.test(text) ? "draft_before_write" : "",
    endpoints.some((endpoint) => /chat\.postMessage|send|post/i.test(endpoint.path)) ? "draft_then_send_message_with_approval" : "",
    /event|webhook/i.test(text) ? "inspect_event_delivery" : "",
    /rate.?limit|429/i.test(text) ? "handle_rate_limit_retry_after" : "",
  ].filter(Boolean));
}

function extractLines(text: string, pattern: RegExp, limit: number) {
  return dedupe(
    text
      .split(/\n+/)
      .map((line) => sanitizeExtractedLine(line.trim().replace(/\s+/g, " ")))
      .filter((line) => line.length > 24 && line.length < 260 && pattern.test(line)),
  ).slice(0, limit);
}

function sanitizeExtractedLine(line: string) {
  return line
    .replace(/\bxox[baprs]-[A-Za-z0-9-]+/gi, "[redacted_slack_token]")
    .replace(/\b(sk|rk|pk)_(live|test|restricted)_[A-Za-z0-9_]+/gi, "[redacted_api_key]")
    .replace(/(client_secret\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/(signing_secret\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/(webhook_secret\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[redacted_private_key]");
}

function endpointFamilyFromPath(path: string) {
  const parts = path
    .replace(/^\/+/, "")
    .split(/[/.]/)
    .filter(Boolean);
  return parts[0] ?? "api";
}

function hasKind(
  importedSources: Array<{ source: DocsSourceInput; status: string }>,
  kind: MarketplacePackSourceKind,
) {
  return importedSources.some((item) => item.source.kind === kind && item.status === "imported");
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function dedupe<T>(items: T[]) {
  return [...new Set(items)];
}

function dedupeEndpoints(endpoints: MarketplaceExtractedEndpoint[]) {
  const seen = new Set<string>();
  return endpoints.filter((endpoint) => {
    const key = `${endpoint.method ?? ""}:${endpoint.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function slugId(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function title(input: string) {
  return input
    .split(/[_\-\s/.]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
