import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const docsPages = [
  "users-and-accounts",
  "time-tracking",
  "focus-sessions",
  "projects-and-tasks",
  "calendar",
  "taxonomies",
  "alerts-and-goals",
  "notifications",
  "personalization",
  "devices",
  "events",
];

const analyticOperations = [
  ["GET", "/api/oauth/data"],
  ["GET", "/api/oauth/overview_data"],
  ["GET", "/api/oauth/category_data"],
  ["GET", "/api/oauth/productivity_data"],
  ["GET", "/api/oauth/daily_summary_feed"],
  ["GET", "/api/oauth/alerts_feed"],
  ["GET", "/api/oauth/highlights_feed"],
  ["POST", "/api/oauth/highlights_post"],
  ["POST", "/api/oauth/start_focustime"],
  ["POST", "/api/oauth/end_focustime"],
  ["GET", "/api/oauth/focustime_started_feed"],
  ["GET", "/api/oauth/focustime_ended_feed"],
  ["POST", "/api/oauth/offline_time_post"],
];

const analyticQueryParameters = [
  "by",
  "taxonomy",
  "interval",
  "restrict_begin",
  "restrict_end",
  "restrict_kind",
  "restrict_thing",
  "restrict_thingy",
  "perspective",
  "resolution_time",
  "format",
  "op",
  "highlight_date",
  "description",
  "source",
  "duration",
  "activity_name",
  "activity_category",
  "activity_start_time",
  "activity_end_time",
];

const decode = (value) =>
  value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

const operationId = (method, path) =>
  `${method.toLowerCase()}_${path
    .replace(/^\/api\/(resource|oauth)\//, "$1_")
    .replace(/\(\/:([^)]+)\)/g, "_$1_optional")
    .replace(/\/:([^/]+)/g, "_$1")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")}`.toLowerCase();

const operations = [];
for (const page of docsPages) {
  const url = `https://www.rescuetime.com/api-docs/${page}`;
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const html = await response.text();
  const blocks = html.match(/<div class="api-endpoint">[\s\S]*?(?=<div class="api-endpoint">|<\/main>|$)/g) ?? [];
  for (const block of blocks) {
    const header = block.match(
      /<span class="http-method method-(get|post|put|patch|delete)">[^<]+<\/span>\s*<code class="endpoint-path">([^<]+)<\/code>/,
    );
    if (!header) continue;
    const method = header[1].toUpperCase();
    const documentedPath = decode(header[2].trim());
    const parameterNames = [...block.matchAll(/<td class="param-name">\s*([^<]+?)\s*<\/td>/g)]
      .map((match) => decode(match[1].trim()).replace(/\..*$/, ""))
    const pathVariants = /\(\/:([^)]+)\)/.test(documentedPath)
      ? [documentedPath.replace(/\(\/:([^)]+)\)/g, ""), documentedPath.replace(/\(\/:([^)]+)\)/g, "/:$1")]
      : [documentedPath];
    for (const documentedVariant of pathVariants) {
      const path = documentedVariant.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
      const pathParameters = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
      operations.push({
        id: operationId(method, documentedVariant),
        method,
        path,
        pathParameters: [...new Set(pathParameters)],
        queryParameters: [...new Set(parameterNames.filter((name) => !pathParameters.includes(name)))],
        bodyAllowed: !["GET", "DELETE"].includes(method),
        source: url,
      });
    }
  }
}

for (const [method, path] of analyticOperations) {
  operations.push({
    id: operationId(method, path),
    method,
    path,
    pathParameters: [],
    queryParameters: analyticQueryParameters,
    bodyAllowed: method !== "GET",
    source: "https://www.rescuetime.com/rtx/developers",
  });
}

const unique = [...new Map(operations.map((operation) => [`${operation.method} ${operation.path}`, operation])).values()]
  .sort((left, right) => left.id.localeCompare(right.id));
const readCount = unique.filter((operation) => operation.method === "GET").length;
const mutationCount = unique.length - readCount;
if (unique.length < 120 || readCount < 50 || mutationCount < 50) {
  throw new Error(`Unexpected RescueTime surface: ${unique.length}/${readCount}/${mutationCount}`);
}

const output = resolve(
  "backend/src/modules/marketplace/connectors/rescuetime/rescuetime-operation-registry.ts",
);
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  `// Generated from RescueTime's official API documentation on 2026-07-15.\n` +
    `export type RescueTimeOperation = {\n` +
    `  id: string;\n  method: "GET" | "POST" | "PATCH" | "DELETE";\n  path: string;\n` +
    `  pathParameters: readonly string[];\n  queryParameters: readonly string[];\n` +
    `  bodyAllowed: boolean;\n  source: string;\n};\n\n` +
    `export const RESCUETIME_OPERATIONS = ${JSON.stringify(unique, null, 2)} as const satisfies readonly RescueTimeOperation[];\n\n` +
    `export const RESCUETIME_OPERATION_BY_ID: ReadonlyMap<string, RescueTimeOperation> = new Map(RESCUETIME_OPERATIONS.map((operation) => [operation.id, operation]));\n` +
    `export const RESCUETIME_READ_OPERATION_IDS = RESCUETIME_OPERATIONS.filter((operation) => operation.method === "GET").map((operation) => operation.id);\n` +
    `export const RESCUETIME_MANAGE_OPERATION_IDS = RESCUETIME_OPERATIONS.filter((operation) => operation.method !== "GET").map((operation) => operation.id);\n`,
);
console.log(JSON.stringify({ output, operations: unique.length, reads: readCount, mutations: mutationCount }, null, 2));
