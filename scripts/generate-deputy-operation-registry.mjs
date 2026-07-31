import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LLMS_URL = "https://developer.deputy.com/llms.txt";
const OUTPUT = new URL(
  "../backend/src/modules/marketplace/connectors/deputy/deputy-operation-registry.ts",
  import.meta.url,
);
const CONCURRENCY = 2;
const CACHE_DIR = join(tmpdir(), "relay-deputy-reference-cache");
await mkdir(CACHE_DIR, { recursive: true });

const llms = await fetchCached(LLMS_URL);
const referenceSection = llms.match(/## API Reference\n([\s\S]*?)(?=\n## )/)?.[1];
if (!referenceSection) throw new Error("Deputy API Reference index was not found.");

const urls = [
  ...new Set(
    [...referenceSection.matchAll(/\]\((https:\/\/developer\.deputy\.com\/reference\/[^)]+\.md)\)/g)].map(
      (match) => match[1],
    ),
  ),
].sort();

const documents = new Array(urls.length);
let cursor = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= urls.length) return;
      documents[index] = await fetchCached(urls[index]);
      if ((index + 1) % 100 === 0) {
        console.error(`Deputy reference progress: ${index + 1}/${urls.length}`);
      }
    }
  }),
);

const operationByRoute = new Map();
for (let index = 0; index < documents.length; index += 1) {
  const markdown = documents[index];
  const jsonBlock = markdown.match(/# OpenAPI definition\s*```json\s*([\s\S]*?)```/i)?.[1];
  if (!jsonBlock) continue;
  let spec;
  try {
    spec = JSON.parse(jsonBlock);
  } catch {
    continue;
  }
  const serverUrl = String(spec.servers?.[0]?.url ?? "");
  const serverVersion = serverUrl.match(/\/api\/(v[12])(?:\/|$)/)?.[1];
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const operation = pathItem?.[method];
      if (!operation || operation.deprecated === true) continue;
      let normalizedPath = normalizePath(path);
      if (!/^\/v[12]\//.test(normalizedPath) && serverVersion) {
        normalizedPath = `/${serverVersion}${normalizedPath}`;
      }
      if (!normalizedPath.startsWith("/v1/") && !normalizedPath.startsWith("/v2/")) continue;
      if (
        !/^\/(?:[A-Za-z0-9._~-]+|\{[A-Za-z0-9_.-]+\})(?:\/(?:[A-Za-z0-9._~-]+|\{[A-Za-z0-9_.-]+\}))*$/.test(
          normalizedPath,
        )
      ) {
        continue;
      }
      const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];
      const requestBody = operation.requestBody?.content ?? {};
      const contentTypes = Object.keys(requestBody);
      const jsonSchema =
        requestBody["application/json"]?.schema ??
        requestBody["application/*+json"]?.schema ??
        requestBody[contentTypes[0]]?.schema;
      const bodyProperties = Object.keys(resolveProperties(jsonSchema, spec));
      const bodyMode = contentTypes.some((value) => value.includes("multipart/form-data"))
        ? "multipart"
        : contentTypes.some((value) => value.includes("application/x-www-form-urlencoded"))
          ? "form"
          : contentTypes.length || ["post", "put", "patch"].includes(method)
            ? "json"
            : "none";
      const responseContent = Object.values(operation.responses ?? {}).flatMap((response) =>
        Object.keys(response?.content ?? {}),
      );
      const responseMode = responseContent.some(
        (value) => !value.includes("json") && !value.startsWith("text/"),
      )
        ? "binary"
        : "json";
      const candidate = {
        id: String(operation.operationId || `${method}_${normalizedPath}`),
        summary: String(operation.summary || operation.description || `${method.toUpperCase()} ${normalizedPath}`)
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 500),
        method: method.toUpperCase(),
        path: normalizedPath,
        tags: [...new Set((operation.tags ?? []).map(String))].sort(),
        pathParameters: parameterNames(parameters, "path", normalizedPath),
        queryParameters: parameterNames(parameters, "query"),
        headerParameters: parameterNames(parameters, "header").filter(
          (name) => !/^(authorization|cookie)$/i.test(name),
        ),
        bodyParameters: bodyProperties.sort(),
        bodyMode,
        responseMode,
      };
      const key = `${candidate.method} ${candidate.path}`;
      const previous = operationByRoute.get(key);
      if (!previous || richness(candidate) > richness(previous)) operationByRoute.set(key, candidate);
    }
  }
}

const usedIds = new Map();
const operations = [...operationByRoute.values()]
  .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
  .map((operation) => {
    const base = safeId(operation.id);
    const occurrence = usedIds.get(base) ?? 0;
    usedIds.set(base, occurrence + 1);
    return { ...operation, id: occurrence ? `${base}_${occurrence + 1}` : base };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

if (operations.length < 1_000) {
  throw new Error(`Only ${operations.length} Deputy operations were parsed; refusing partial registry.`);
}

const sourceHash = createHash("sha256")
  .update(llms)
  .update("\n")
  .update(documents.join("\n"))
  .digest("hex");
const generated = `// Generated from Deputy's official ReadMe API reference index and per-operation OpenAPI definitions.
// Source index: ${LLMS_URL}
// Source SHA-256: ${sourceHash}
// Evidence date: 2026-07-15. Deprecated routes and non-v1/v2 privileged provisioning surfaces are excluded.

export type DeputyOperation = {
  id: string;
  summary: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  tags: readonly string[];
  pathParameters: readonly string[];
  queryParameters: readonly string[];
  headerParameters: readonly string[];
  bodyParameters: readonly string[];
  bodyMode: "none" | "json" | "multipart" | "form";
  responseMode: "json" | "binary";
};

export const DEPUTY_OPERATIONS = ${JSON.stringify(operations, null, 2)} as const satisfies readonly DeputyOperation[];

export const DEPUTY_OPERATION_BY_ID = new Map<string, DeputyOperation>(
  DEPUTY_OPERATIONS.map((operation) => [operation.id, operation]),
);

export const DEPUTY_READ_OPERATION_IDS = DEPUTY_OPERATIONS.filter(
  (operation) => operation.method === "GET",
).map((operation) => operation.id);

export const DEPUTY_WRITE_OPERATION_IDS = DEPUTY_OPERATIONS.filter(
  (operation) => operation.method !== "GET",
).map((operation) => operation.id);
`;

await writeFile(OUTPUT, generated);
console.log(
  JSON.stringify({
    references: urls.length,
    operations: operations.length,
    reads: operations.filter((operation) => operation.method === "GET").length,
    writes: operations.filter((operation) => operation.method !== "GET").length,
    sourceHash,
  }),
);

function normalizePath(value) {
  let path = String(value).trim().replace(/^https?:\/\/[^/]+/i, "");
  path = path.replace(/^\/api(?=\/v[12]\/)/, "");
  path = path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}");
  return path.startsWith("/") ? path : `/${path}`;
}

function parameterNames(parameters, location, path = "") {
  const names = parameters
    .filter((parameter) => parameter?.in === location && parameter?.name)
    .map((parameter) => String(parameter.name));
  if (location === "path") {
    for (const match of path.matchAll(/\{([^}]+)\}/g)) names.push(match[1]);
  }
  return [...new Set(names)].sort();
}

function resolveProperties(schema, spec, seen = new Set()) {
  if (!schema || typeof schema !== "object") return {};
  if (schema.$ref) {
    if (seen.has(schema.$ref)) return {};
    seen.add(schema.$ref);
    const target = schema.$ref
      .replace(/^#\//, "")
      .split("/")
      .reduce((value, key) => value?.[key], spec);
    return resolveProperties(target, spec, seen);
  }
  if (schema.properties) return schema.properties;
  if (schema.allOf) return Object.assign({}, ...schema.allOf.map((item) => resolveProperties(item, spec, seen)));
  return {};
}

function richness(operation) {
  return (
    operation.pathParameters.length * 5 +
    operation.queryParameters.length * 3 +
    operation.headerParameters.length * 2 +
    operation.bodyParameters.length +
    operation.summary.length / 1_000
  );
}

function safeId(value) {
  const id = String(value)
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);
  return id || "operation";
}

async function fetchText(url, attempt = 1) {
  const response = await fetch(url, { headers: { Accept: "text/markdown" } });
  if (!response.ok) {
    if (response.status === 429 || response.status === 403) {
      const proxyUrl = `https://r.jina.ai/${url.replace(/^https:/, "http:")}`;
      const proxyResponse = await fetch(proxyUrl, {
        headers: { Accept: "text/markdown" },
      });
      if (proxyResponse.ok) return proxyResponse.text();
    }
    if (attempt < 10 && response.status >= 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(retryAfter * 1_000, attempt * attempt * 1_000)),
      );
      return fetchText(url, attempt + 1);
    }
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.text();
}

async function fetchCached(url) {
  const cacheName = `${createHash("sha256").update(url).digest("hex")}.md`;
  const cachePath = join(CACHE_DIR, cacheName);
  try {
    return await readFile(cachePath, "utf8");
  } catch {
    const text = await fetchText(url);
    await writeFile(cachePath, text);
    await new Promise((resolve) => setTimeout(resolve, 250));
    return text;
  }
}
