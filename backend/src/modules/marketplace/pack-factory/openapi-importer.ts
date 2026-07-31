import { safeOutboundHttpClient } from "../../../common/security/safe-outbound-http";
import {
  type MarketplaceExtractedSourceModel,
  type MarketplacePackSource,
} from "./types";
import { extractDocsSourceModel } from "./docs-source-importer";

type RemoteOpenApiSource = Omit<MarketplacePackSource, "filePath">;

const MAX_OPENAPI_BYTES = 2 * 1024 * 1024;
const MAX_OPENAPI_PATHS = 1_000;
const MAX_OPENAPI_ENDPOINTS = 500;
const MAX_COMPONENT_SUMMARY_BYTES = 200_000;

export type OpenApiEndpointSummary = {
  method: string;
  path: string;
  summary?: string;
  tag?: string;
};

export function summarizeOpenApiSpec(spec: unknown): OpenApiEndpointSummary[] {
  if (!spec || typeof spec !== "object") return [];
  const paths = (spec as { paths?: unknown }).paths;
  if (!paths || typeof paths !== "object") return [];
  if (Object.keys(paths).length > MAX_OPENAPI_PATHS) {
    throw new Error(`OpenAPI spec exceeds ${MAX_OPENAPI_PATHS} paths.`);
  }
  const endpoints: OpenApiEndpointSummary[] = [];
  for (const [path, operations] of Object.entries(paths)) {
    if (!operations || typeof operations !== "object") continue;
    for (const [method, operation] of Object.entries(operations)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      const op = operation as { summary?: string; tags?: string[] };
      endpoints.push({
        method: method.toUpperCase(),
        path,
        summary: op.summary,
        tag: op.tags?.[0],
      });
      if (endpoints.length > MAX_OPENAPI_ENDPOINTS) {
        throw new Error(
          `OpenAPI spec exceeds ${MAX_OPENAPI_ENDPOINTS} operations.`,
        );
      }
    }
  }
  return endpoints;
}

export async function importOpenApiSource(source: RemoteOpenApiSource) {
  if (!source.url && !source.notes) {
    throw new Error("OpenAPI source requires an HTTPS URL or inline content.");
  }
  const raw = source.notes ? source.notes : await fetchOpenApiSpec(source.url!);
  if (Buffer.byteLength(raw, "utf8") > MAX_OPENAPI_BYTES) {
    throw new Error("OpenAPI source exceeds the import byte limit.");
  }
  const spec = parseSpec(raw);
  const endpointSummaries = summarizeOpenApiSpec(spec);
  const text = [
    `OpenAPI source: ${source.title ?? source.url ?? "inline content"}`,
    ...endpointSummaries.map((endpoint) =>
      [endpoint.method, endpoint.path, endpoint.summary, endpoint.tag]
        .filter(Boolean)
        .join(" "),
    ),
    JSON.stringify(
      (spec as { components?: unknown }).components ?? {},
    ).slice(0, MAX_COMPONENT_SUMMARY_BYTES),
  ].join("\n");
  const extracted = extractDocsSourceModel([
    {
      source,
      text,
      status: "imported",
      contentType: "application/openapi+json",
      contentHash: undefined,
    },
  ]);
  return addOpenApiEndpointFamilies(extracted, endpointSummaries, source.official);
}

async function fetchOpenApiSpec(url: string) {
  const response = await safeOutboundHttpClient.getText(url, {
    maxBytes: MAX_OPENAPI_BYTES,
    maxRedirects: 3,
    timeoutMs: 15_000,
    allowedContentTypes:
      /^(application\/(?:json|.+\+json|yaml|x-yaml|octet-stream)|text\/(?:plain|yaml|x-yaml))/i,
    headers: {
      accept: "application/json, application/yaml, text/yaml, text/plain",
      "accept-encoding": "gzip, deflate, br",
      "user-agent": "ClawChat-PackFactory/1.0 (+https://claw.chat)",
    },
  });
  return response.text;
}

function parseSpec(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return parseMinimalYamlOpenApi(raw);
  }
}

function parseMinimalYamlOpenApi(raw: string) {
  const paths: Record<string, Record<string, { summary?: string; tags?: string[] }>> = {};
  let currentPath: string | null = null;
  let currentMethod: string | null = null;
  for (const line of raw.split(/\n/)) {
    const pathMatch = line.match(/^\s{2}(\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      currentMethod = null;
      paths[currentPath] = paths[currentPath] ?? {};
      continue;
    }
    const methodMatch = line.match(/^\s{4}(get|post|put|patch|delete):\s*$/i);
    if (methodMatch && currentPath) {
      currentMethod = methodMatch[1].toLowerCase();
      paths[currentPath][currentMethod] = {};
      continue;
    }
    const summaryMatch = line.match(/^\s{6}summary:\s*(.+)$/);
    if (summaryMatch && currentPath && currentMethod) {
      paths[currentPath][currentMethod].summary = summaryMatch[1].replace(/^['"]|['"]$/g, "");
    }
  }
  return { paths };
}

function addOpenApiEndpointFamilies(
  extracted: MarketplaceExtractedSourceModel,
  endpoints: OpenApiEndpointSummary[],
  officialSource: boolean,
) {
  const grouped = new Map<string, OpenApiEndpointSummary[]>();
  for (const endpoint of endpoints) {
    const family = endpoint.tag ?? endpoint.path.replace(/^\/+/, "").split("/")[0] ?? "api";
    grouped.set(family, [...(grouped.get(family) ?? []), endpoint]);
  }
  return {
    ...extracted,
    endpoints: endpoints.map((endpoint) => ({
      method: endpoint.method,
      path: endpoint.path,
      family: endpoint.tag ?? endpoint.path.replace(/^\/+/, "").split("/")[0] ?? "api",
      summary: endpoint.summary,
    })),
    endpointFamilies: [...grouped.entries()].slice(0, 16).map(([family, familyEndpoints]) => ({
      id: family.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
      label: family
        .split(/[_\-\s/]+/)
        .filter(Boolean)
        .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
        .join(" "),
      guidance: `Imported from OpenAPI ${family} operations. Reads are safest; writes must follow approval policy.`,
      representativeEndpoints: familyEndpoints
        .slice(0, 8)
        .map((endpoint) => `${endpoint.method} ${endpoint.path}`),
    })),
    coverage: {
      ...extracted.coverage,
      endpoints: endpoints.length > 0,
      objects: extracted.objects.length > 0 || endpoints.length > 0,
      officialSources: officialSource || extracted.coverage.officialSources,
    },
  };
}
