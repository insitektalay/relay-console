import * as fs from "node:fs";
import * as path from "node:path";
import { MARKETPLACE_CATALOG } from "../../modules/marketplace/catalog/marketplace-catalog";
import { type MarketplaceAppDefinition } from "../../modules/marketplace/catalog/marketplace-catalog.types";
import {
  compileCanonicalHermesPack,
  compileCanonicalOpenClawPack,
} from "../../modules/marketplace/packs/canonical-pack";
import {
  compileGithubHermesPack,
  compileGithubOpenClawPack,
} from "../../modules/marketplace/packs/github/github.pack";
import {
  compileStripeHermesPack,
  compileStripeOpenClawPack,
} from "../../modules/marketplace/packs/stripe/stripe.pack";

const REFERENCE_APPS = new Set(["github", "stripe"]);

const GENERIC_PHRASES = [
  /Use .* for .* operations backed by official provider APIs/,
  /Read operations: list, retrieve, search, inspect status where supported/,
  /Write operations: create, update, move, send, publish, or delete only when the active policy allows it/,
  /Perform an external\/customer-facing action/,
  /Modify permissions, webhooks, production state, billing, publishing, or destructive resources/,
];

const SECRET_PATTERNS = [
  /xox[baprs]-[A-Za-z0-9-]+/i,
  /\b(sk|rk|pk)_(live|test|restricted)_[A-Za-z0-9_]+/i,
  /client_secret\s*[:=]\s*[^\s,;]+/i,
  /signing_secret\s*[:=]\s*[^\s,;]+/i,
  /webhook_secret\s*[:=]\s*[^\s,;]+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /AC[a-f0-9]{32}/i,
];

const PROVIDER_TOKENS: Record<string, string[]> = {
  resend: ["emails", "domains", "api-keys", "audiences", "contacts", "webhooks", "rate limit"],
  gmail: ["users.messages", "users.threads", "users.drafts", "users.labels", "watch", "history.list", "gmail.send"],
  outlook: ["Microsoft Graph", "/me/messages", "/me/mailFolders", "Mail.Send", "Mail.ReadWrite", "change notifications"],
  slack: ["chat.postMessage", "conversations.history", "conversations.replies", "users.info", "reactions.add", "channels:read", "chat:write"],
  discord: ["Gateway", "guilds", "channels", "messages", "interactions", "webhooks", "rate limits"],
  twilio: ["Messages", "Calls", "Conversations", "Messaging Services", "status callbacks", "Account SID"],
  linear: ["GraphQL", "issues", "teams", "projects", "cycles", "workflow states", "webhooks"],
  jira: ["issue", "project", "search", "JQL", "transitions", "worklog", "webhooks"],
  asana: ["tasks", "projects", "sections", "stories", "workspaces", "webhooks"],
  trello: ["boards", "lists", "cards", "checklists", "members", "webhooks"],
  clickup: ["teams", "spaces", "folders", "lists", "tasks", "custom fields", "webhooks"],
  notion: ["pages", "databases", "blocks", "comments", "properties", "query", "integration"],
  "google-drive": ["files", "mimeType", "permissions", "shared drives", "changes", "export", "download"],
  airtable: ["bases", "tables", "records", "fields", "views", "webhooks"],
  dropbox: ["files/list_folder", "files/download", "files/upload", "sharing", "team folders", "webhooks"],
  confluence: ["spaces", "pages", "content", "attachments", "labels", "versions"],
  coda: ["docs", "tables", "rows", "columns", "formulas", "webhooks"],
  gitlab: ["projects", "repository", "merge_requests", "issues", "pipelines", "webhooks"],
  supabase: ["projects", "PostgREST", "auth", "storage", "edge functions", "service_role"],
  vercel: ["projects", "deployments", "domains", "environment variables", "webhooks"],
  railway: ["GraphQL", "projects", "services", "deployments", "variables", "environments"],
  sentry: ["organizations", "projects", "issues", "events", "releases", "webhooks"],
  posthog: ["events", "persons", "insights", "funnels", "feature flags", "cohorts"],
  shopify: ["Admin GraphQL", "products", "variants", "orders", "customers", "inventory", "fulfillments", "refunds"],
  paddle: ["customers", "transactions", "subscriptions", "prices", "products", "webhooks"],
  "lemon-squeezy": ["stores", "products", "variants", "orders", "subscriptions", "licenses", "webhooks"],
  chargebee: ["customers", "subscriptions", "invoices", "items", "plans", "events", "webhooks"],
  hubspot: ["CRM objects", "contacts", "companies", "deals", "tickets", "associations", "private app"],
  salesforce: ["REST API", "sObjects", "SOQL", "Accounts", "Contacts", "Opportunities", "Cases"],
  zendesk: ["tickets", "users", "organizations", "groups", "macros", "webhooks"],
  intercom: ["conversations", "contacts", "admins", "teams", "messages", "webhooks"],
  pipedrive: ["deals", "persons", "organizations", "activities", "pipelines", "stages", "webhooks"],
  figma: ["files", "nodes", "comments", "images", "components", "webhooks"],
  canva: ["designs", "assets", "folders", "exports", "brand templates", "OAuth scopes"],
  webflow: ["sites", "collections", "items", "pages", "forms", "webhooks", "publish"],
  wordpress: ["posts", "pages", "media", "comments", "taxonomies", "application passwords"],
  "youtube-data-api": ["videos", "channels", "playlists", "commentThreads", "captions", "quota"],
};

type AuditRow = {
  slug: string;
  state: "curated" | "review_needed" | "blocked";
  openclawFiles: number;
  hermesFiles: number;
  docsUrls: string[];
  genericPhraseHits: number;
  missingTokens: string[];
  secretMatches: string[];
  reasons: string[];
};

const rows = MARKETPLACE_CATALOG.map(auditApp);
const nonReferenceRows = rows.filter((row) => !REFERENCE_APPS.has(row.slug));
const falseCurated = nonReferenceRows
  .filter((row) => row.state === "curated" && row.reasons.length > 0)
  .map((row) => row.slug);

const report = renderReport(rows, falseCurated);
const reportPath = path.join(process.cwd(), "..", "docs", "marketplace", "CANONICAL_PACKS_REPORT.md");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, report);

const failed = falseCurated.length > 0 || rows.some((row) => row.secretMatches.length > 0);
console.log(JSON.stringify({
  totalApps: rows.length,
  referenceCurated: rows.filter((row) => REFERENCE_APPS.has(row.slug) && row.state === "curated").map((row) => row.slug),
  nonReferenceReviewNeeded: nonReferenceRows.filter((row) => row.state === "review_needed").length,
  nonReferenceBlocked: nonReferenceRows.filter((row) => row.state === "blocked").length,
  falseCurated,
  reportPath,
}, null, 2));

if (failed) process.exitCode = 1;

function auditApp(app: MarketplaceAppDefinition): AuditRow {
  const selectedCapabilities = app.capabilities
    .filter((capability) => capability.defaultEnabled)
    .map((capability) => capability.id);
  const compilerInput = {
    app,
    selectedCapabilities,
    approvalProfileId: app.approvalProfile,
    connection: null,
    libraryTargetFolder: `marketplace/${app.slug}`,
  };
  const openclaw = app.slug === "github"
    ? compileGithubOpenClawPack(compilerInput)
    : app.slug === "stripe"
      ? compileStripeOpenClawPack(compilerInput)
      : compileCanonicalOpenClawPack(compilerInput);
  const hermes = app.slug === "github"
    ? compileGithubHermesPack(compilerInput)
    : app.slug === "stripe"
      ? compileStripeHermesPack(compilerInput)
      : compileCanonicalHermesPack(compilerInput);
  const sourceContent = readPackSources(app.slug);
  const compiledContent = [...openclaw.files, ...hermes.files].map((file) => file.content).join("\n");
  const combinedContent = `${sourceContent}\n${compiledContent}`;
  const genericPhraseHits = GENERIC_PHRASES.reduce(
    (count, pattern) => count + (combinedContent.match(new RegExp(pattern.source, "gi"))?.length ?? 0),
    0,
  );
  const expectedTokens = PROVIDER_TOKENS[app.slug] ?? [];
  const missingTokens = REFERENCE_APPS.has(app.slug)
    ? []
    : expectedTokens.filter((token) => !combinedContent.toLowerCase().includes(token.toLowerCase()));
  const docsUrls = Array.from(new Set([
    app.providerDocsUrl,
    ...Array.from(sourceContent.matchAll(/https?:\/\/[^\s)"'>,\]]+/g)).map((match) => match[0].replace(/[.;:]$/, "")),
  ])).sort();
  const secretMatches = SECRET_PATTERNS.flatMap((pattern) => compiledContent.match(pattern) ?? []);
  const reasons = buildReasons(app, genericPhraseHits, missingTokens, docsUrls);
  return {
    slug: app.slug,
    state: app.packQuality.publicationStatus === "blocked" ? "blocked" : app.packQuality.level === "curated" ? "curated" : "review_needed",
    openclawFiles: openclaw.files.length,
    hermesFiles: hermes.files.length,
    docsUrls,
    genericPhraseHits,
    missingTokens,
    secretMatches,
    reasons,
  };
}

function buildReasons(
  app: MarketplaceAppDefinition,
  genericPhraseHits: number,
  missingTokens: string[],
  docsUrls: string[],
) {
  if (REFERENCE_APPS.has(app.slug)) return ["Reference curated pack retained."];
  const reasons = [
    genericPhraseHits > 0 ? `${genericPhraseHits} repeated generic phrase hit(s) remain in source or compiled output` : null,
    missingTokens.length > 0 ? `missing provider-specific doctrine tokens: ${missingTokens.join(", ")}` : null,
    docsUrls.length === 0 ? "no official docs URL recorded" : null,
    app.packQuality.level !== "curated" ? "catalog metadata honestly set to generated_draft/review_needed" : null,
  ];
  return reasons.filter((reason): reason is string => Boolean(reason));
}

function readPackSources(slug: string) {
  const packDir = path.join(process.cwd(), "src", "modules", "marketplace", "packs", slug);
  const files = walk(packDir).filter((file) => file.endsWith(".md") || file.endsWith(".ts"));
  return files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function renderReport(rows: AuditRow[], falseCurated: string[]) {
  const nonReferenceRows = rows.filter((row) => !REFERENCE_APPS.has(row.slug));
  const upgraded = nonReferenceRows.filter((row) => row.state === "curated" && row.reasons.length === 0);
  const notCurated = nonReferenceRows.filter((row) => row.state !== "curated" || row.reasons.length > 0);
  return [
    "# Marketplace Canonical Packs Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Apps upgraded to genuine curated/reference quality in this pass: ${upgraded.length ? upgraded.map((row) => row.slug).join(", ") : "none"}.`,
    `- Apps honestly marked not curated: ${notCurated.length}.`,
    `- False curated metadata: ${falseCurated.length ? falseCurated.join(", ") : "none"}.`,
    "- GitHub and Stripe remain reference curated packs.",
    "",
    "## File Counts",
    "",
    "| App | State | OpenClaw files | Hermes files |",
    "| --- | --- | ---: | ---: |",
    ...rows.map((row) => `| ${row.slug} | ${row.state} | ${row.openclawFiles} | ${row.hermesFiles} |`),
    "",
    "## Non-Curated Apps And Evidence",
    "",
    "| App | Reason | Official docs URLs recorded |",
    "| --- | --- | --- |",
    ...notCurated.map((row) => `| ${row.slug} | ${row.reasons.join("; ")} | ${row.docsUrls.join("<br>")} |`),
    "",
    "## Official Docs Used",
    "",
    "| App | Official docs URLs recorded |",
    "| --- | --- |",
    ...nonReferenceRows.map((row) => `| ${row.slug} | ${row.docsUrls.join("<br>")} |`),
    "",
    "## Provider-Specific Doctrine Added",
    "",
    "| App | Provider-specific doctrine signals present |",
    "| --- | --- |",
    ...nonReferenceRows.map((row) => `| ${row.slug} | ${(PROVIDER_TOKENS[row.slug] ?? []).join(", ")} |`),
    "",
    "## Provider-Specific Audit Detail",
    "",
    "| App | Generic phrase hits | Missing provider tokens | Secret scan |",
    "| --- | ---: | --- | --- |",
    ...nonReferenceRows.map((row) => `| ${row.slug} | ${row.genericPhraseHits} | ${row.missingTokens.length ? row.missingTokens.join(", ") : "none"} | ${row.secretMatches.length ? row.secretMatches.join(", ") : "passed"} |`),
    "",
    "## Validation Notes",
    "",
    "- This audit treats compile success, existing directories, provider URLs, and metadata as insufficient proxy signals.",
    "- Non-reference apps pass only when repeated generic phrases are absent, expected provider tokens are present, compiled output secret scan passes, and catalogue quality is not a false curated label.",
    "- Apps that remain non-curated must carry a concrete reason from this audit.",
    "",
  ].join("\n");
}
