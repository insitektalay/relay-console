import fs from "node:fs";
import crypto from "node:crypto";

const source = "/tmp/egnyte-openapi.json";
const target = new URL(
  "../backend/src/modules/marketplace/connectors/egnyte/egnyte-operation-registry.ts",
  import.meta.url,
);
const specBytes = fs.readFileSync(source);
const spec = JSON.parse(specBytes);
const methods = ["get", "post", "put", "patch", "delete"];

function resolve(ref) {
  if (!ref?.$ref) return ref;
  return ref.$ref
    .replace(/^#\//, "")
    .split("/")
    .reduce((value, key) => value[key], spec);
}

function schemaFields(schema, seen = new Set()) {
  schema = resolve(schema) ?? {};
  if (seen.has(schema)) return [];
  seen.add(schema);
  return [
    ...Object.keys(schema.properties ?? {}),
    ...(schema.allOf ?? []).flatMap((part) => schemaFields(part, seen)),
    ...(schema.oneOf ?? []).flatMap((part) => schemaFields(part, seen)),
    ...(schema.anyOf ?? []).flatMap((part) => schemaFields(part, seen)),
  ].filter((value, index, values) => values.indexOf(value) === index).sort();
}

const operations = [];
for (const [path, pathItem] of Object.entries(spec.paths)) {
  for (const method of methods) {
    const operation = pathItem[method];
    if (!operation || operation.deprecated) continue;
    const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].map(resolve);
    const content = operation.requestBody?.content ?? {};
    const contentTypes = Object.keys(content);
    const bodyMode = contentTypes.includes("multipart/form-data")
      ? "multipart"
      : contentTypes.includes("application/x-www-form-urlencoded")
        ? "form"
        : contentTypes.includes("application/json")
          ? "json"
          : "none";
    const bodyContent =
      content["application/json"] ??
      content["multipart/form-data"] ??
      content["application/x-www-form-urlencoded"];
    const responseContentTypes = Object.values(operation.responses ?? {}).flatMap((response) =>
      Object.keys(resolve(response)?.content ?? {}),
    );
    operations.push({
      id: operation.operationId,
      summary: operation.summary ?? operation.description ?? operation.operationId,
      method: method.toUpperCase(),
      path: path.replace(/^\/pubapi\//, "/"),
      tags: operation.tags ?? pathItem.tags ?? [],
      pathParameters: parameters.filter((p) => p.in === "path").map((p) => p.name).sort(),
      queryParameters: parameters.filter((p) => p.in === "query").map((p) => p.name).sort(),
      headerParameters: parameters.filter((p) => p.in === "header").map((p) => p.name).sort(),
      bodyParameters: schemaFields(bodyContent?.schema),
      bodyMode,
      responseMode: responseContentTypes.some((type) => type === "application/octet-stream" || type === "text/csv")
        ? "binary"
        : "json",
    });
  }
}
operations.sort((a, b) => a.id.localeCompare(b.id));

const output = `// Generated from Egnyte's official OpenAPI 3.0.3 specification (info version 1.3.2).\n// Source SHA-256: ${crypto.createHash("sha256").update(specBytes).digest("hex")}\n// Evidence date: 2026-07-14. Four explicitly deprecated operations are intentionally excluded.\n\nexport type EgnyteOperation = {\n  id: string;\n  summary: string;\n  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";\n  path: string;\n  tags: readonly string[];\n  pathParameters: readonly string[];\n  queryParameters: readonly string[];\n  headerParameters: readonly string[];\n  bodyParameters: readonly string[];\n  bodyMode: "none" | "json" | "multipart" | "form";\n  responseMode: "json" | "binary";\n};\n\nexport const EGNYTE_OPERATIONS = ${JSON.stringify(operations, null, 2)} as const satisfies readonly EgnyteOperation[];\n\nexport const EGNYTE_OPERATION_IDS = EGNYTE_OPERATIONS.map((operation) => operation.id);\nexport const EGNYTE_READ_OPERATION_IDS = EGNYTE_OPERATIONS.filter((operation) => operation.method === "GET").map((operation) => operation.id);\nconst EGNYTE_ADMIN_TAGS = new Set([\n  "Domains", "Settings", "Templates", "Webhooks", "groups", "metadata", "project-custom-fields", "project_folders", "scim", "tokens", "users", "v1-reports", "v2-stream", "webhooks",\n]);\nexport const EGNYTE_ADMIN_OPERATION_IDS = EGNYTE_OPERATIONS.filter((operation) => operation.method !== "GET" && operation.tags.some((tag) => EGNYTE_ADMIN_TAGS.has(tag))).map((operation) => operation.id);\nconst EGNYTE_ADMIN_OPERATION_ID_SET = new Set(EGNYTE_ADMIN_OPERATION_IDS);\nexport const EGNYTE_CONTENT_WRITE_OPERATION_IDS = EGNYTE_OPERATIONS.filter((operation) => operation.method !== "GET" && !EGNYTE_ADMIN_OPERATION_ID_SET.has(operation.id)).map((operation) => operation.id);\nexport const EGNYTE_OPERATION_BY_ID = new Map<string, EgnyteOperation>(EGNYTE_OPERATIONS.map((operation) => [operation.id, operation]));\n`;

fs.mkdirSync(new URL(".", target), { recursive: true });
fs.writeFileSync(target, output);
console.log(`Wrote ${operations.length} active Egnyte operations to ${target.pathname}`);
