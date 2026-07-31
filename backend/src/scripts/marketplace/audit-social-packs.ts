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

type SocialRequirement = {
  scopes: string[];
  endpoints: string[];
  writeActionEndpoints: string[];
  objects: string[];
  rateLimits: string[];
  requiredDocs: string[];
  forbidden: string[];
  requiredExampleTerms: string[];
};

const SOCIAL_APPS = [
  "x",
  "facebook-pages",
  "threads",
  "linkedin",
  "tiktok",
  "pinterest",
  "reddit",
  "mastodon",
  "bluesky",
] as const;

const REQUIRED_SOURCE_FILES = [
  "workflow.md",
  "auth.md",
  "permissions.md",
  "safe_actions.md",
  "api/endpoints.md",
  "api/rate_limits.md",
  "api/webhooks.md",
  "api/errors.md",
  "workflows/write_actions.md",
  "examples/approval_required.md",
  "examples/bad_requests.md",
];

const GENERIC_RESIDUE = [
  /Publishing a post, video, image, pin, status, record, comment, or reply/i,
  /Exact text, media, links, alt text, mentions, hashtags, and visibility/i,
  /Use <App> for objects backed by official APIs/i,
  /Read operations: list, retrieve, search, inspect status/i,
  /Write operations: create, update, move, send, publish, or delete/i,
  /generic “?publish content externally”?/i,
];

const SECRET_PATTERNS = [
  /xox[baprs]-[A-Za-z0-9-]+/i,
  /\b(sk|rk|pk)_(live|test|restricted)_[A-Za-z0-9_]+/i,
  /client_secret\s*[:=]\s*[^\s,;]+/i,
  /signing_secret\s*[:=]\s*[^\s,;]+/i,
  /webhook_secret\s*[:=]\s*[^\s,;]+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

const REQUIREMENTS: Record<(typeof SOCIAL_APPS)[number], SocialRequirement> = {
  x: {
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access", "dm.read", "dm.write"],
    endpoints: ["/2/tweets", "/2/users/:id/tweets", "/2/users/:id/mentions", "/2/tweets/search/recent"],
    writeActionEndpoints: ["POST /2/tweets", "DELETE /2/tweets/:id"],
    objects: ["Tweets/posts", "Direct Message", "timelines", "mentions"],
    rateLimits: ["900 per 15 minutes", "x-rate-limit-remaining", "GET /2/tweets"],
    requiredDocs: ["https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code", "https://docs.x.com/x-api/fundamentals/rate-limits"],
    forbidden: ["Page access tokens", "app-review", "records/boosting"],
    requiredExampleTerms: ["Tweet", "@brand", "DM"],
  },
  "facebook-pages": {
    scopes: ["pages_manage_posts", "pages_read_engagement", "pages_manage_engagement", "pages_show_list"],
    endpoints: ["/{page-id}/feed", "/{page-id}/photos", "/{page-id}/videos", "/{post-id}/comments"],
    writeActionEndpoints: ["POST /{page-id}/feed", "POST /{page-id}/photos"],
    objects: ["Pages", "Page feed posts", "comments", "webhook subscriptions"],
    rateLimits: ["Graph API", "headers", "rate-limit"],
    requiredDocs: ["https://developers.facebook.com/docs/pages-api/posts/", "https://developers.facebook.com/docs/graph-api/webhooks/"],
    forbidden: ["Tweet IDs", "t3_", "app.bsky.feed.post"],
    requiredExampleTerms: ["Page", "comment", "scheduled_time"],
  },
  threads: {
    scopes: ["threads_basic", "threads_content_publish", "threads_manage_replies", "threads_read_replies", "threads_manage_insights"],
    endpoints: ["/{threads-user-id}/threads", "/{threads-container-id}", "/{threads-user-id}/threads_publish"],
    writeActionEndpoints: ["POST /{threads-user-id}/threads", "POST /{threads-user-id}/threads_publish"],
    objects: ["Threads user/profile", "media containers", "published Threads media", "replies"],
    rateLimits: ["Threads API limits", "container processing status", "publish limits"],
    requiredDocs: ["https://developers.facebook.com/docs/threads/", "https://developers.facebook.com/docs/threads/get-started"],
    forbidden: ["Direct Message endpoints", "Page access tokens"],
    requiredExampleTerms: ["Threads user", "container", "root post"],
  },
  linkedin: {
    scopes: ["w_member_social", "w_organization_social", "r_organization_social", "rw_organization_admin"],
    endpoints: ["https://api.linkedin.com/rest/posts", "LinkedIn-Version", "X-Restli-Protocol-Version"],
    writeActionEndpoints: ["POST https://api.linkedin.com/rest/posts"],
    objects: ["urn:li:person", "urn:li:organization", "lifecycleState", "media assets"],
    rateLimits: ["429", "application", "organization"],
    requiredDocs: ["https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api"],
    forbidden: ["pins", "statuses", "boosting", "modqueue"],
    requiredExampleTerms: ["organization", "author", "lifecycleState"],
  },
  tiktok: {
    scopes: ["video.publish", "video.upload", "user.info.basic"],
    endpoints: ["/v2/post/publish/creator_info/query/", "/v2/post/publish/video/init/", "/v2/post/publish/status/fetch/"],
    writeActionEndpoints: ["POST /v2/post/publish/video/init/", "POST /v2/post/publish/inbox/video/init/"],
    objects: ["creator_info", "privacy_level_options", "publish_id", "ai_generated_content"],
    rateLimits: ["6 requests per minute", "20 successful posts per day", "429"],
    requiredDocs: ["https://developers.tiktok.com/doc/content-posting-api-get-started"],
    forbidden: ["comment moderation endpoint"],
    requiredExampleTerms: ["privacy_level", "duet", "AI-generated"],
  },
  pinterest: {
    scopes: ["boards:read", "boards:write", "pins:read", "pins:write", "user_accounts:read", "analytics:read"],
    endpoints: ["/v5/boards", "/v5/pins", "/v5/user_account", "/v5/board_sections"],
    writeActionEndpoints: ["POST /v5/pins", "POST /v5/boards"],
    objects: ["boards", "board sections", "Pins", "media_source"],
    rateLimits: ["Trial access 1,000 requests per day", "Standard access 100 requests per second", "org_write 100 requests/minute"],
    requiredDocs: ["https://developers.pinterest.com/docs/reference/rate-limits/"],
    forbidden: ["Tweet ID", "subreddit"],
    requiredExampleTerms: ["Pin", "board", "media_source"],
  },
  reddit: {
    scopes: ["identity", "read", "submit", "edit", "modposts", "modconfig", "privatemessages"],
    endpoints: ["/api/submit", "/api/comment", "/api/editusertext", "/api/del"],
    writeActionEndpoints: ["POST /api/submit", "POST /api/comment"],
    objects: ["t1_", "t3_", "subreddits", "modqueue"],
    rateLimits: ["X-Ratelimit-Used", "X-Ratelimit-Remaining", "X-Ratelimit-Reset"],
    requiredDocs: ["https://www.reddit.com/dev/api/"],
    forbidden: ["boosting", "Pins", "Page IDs", "app.bsky"],
    requiredExampleTerms: ["subreddit", "flair", "t3_"],
  },
  mastodon: {
    scopes: ["read:statuses", "read:notifications", "write:statuses", "write:media", "admin:read:reports"],
    endpoints: ["/api/v1/statuses", "/api/v1/statuses/:id", "/api/v2/media", "/api/v1/notifications"],
    writeActionEndpoints: ["POST /api/v1/statuses", "DELETE /api/v1/statuses/:id"],
    objects: ["visibility public/unlisted/private/direct", "spoiler_text", "sensitive", "media_ids"],
    rateLimits: ["300 requests per 5 minutes", "30 per 30 minutes", "X-RateLimit-Remaining"],
    requiredDocs: ["https://docs.joinmastodon.org/api/oauth-scopes/", "https://docs.joinmastodon.org/api/rate-limits/"],
    forbidden: ["Page roles", "app.bsky"],
    requiredExampleTerms: ["visibility", "spoiler_text", "media_ids"],
  },
  bluesky: {
    scopes: ["app passwords", "DID", "PDS", "accessJwt", "refreshJwt"],
    endpoints: ["com.atproto.server.createSession", "com.atproto.repo.createRecord", "com.atproto.repo.deleteRecord", "com.atproto.repo.uploadBlob"],
    writeActionEndpoints: ["com.atproto.repo.createRecord", "com.atproto.repo.deleteRecord"],
    objects: ["app.bsky.feed.post", "strong refs", "facets", "labels"],
    rateLimits: ["3,000 per 5 minutes", "5,000 per hour", "35,000 per day", "CREATE=3"],
    requiredDocs: ["https://docs.bsky.app/docs/get-started", "https://docs.bsky.app/docs/advanced-guides/rate-limits"],
    forbidden: ["Page roles", "app review", "OAuth scopes to post"],
    requiredExampleTerms: ["DID", "PDS", "at://"],
  },
};

type AppResult = {
  slug: string;
  status: "pass" | "fail";
  catalogQuality: string;
  openclawFiles: number;
  hermesFiles: number;
  docsUrls: string[];
  failures: string[];
};

const results = SOCIAL_APPS.map((slug) => auditSocialApp(slug));
const regression = auditReferenceRegression();
const failed = results.some((result) => result.status === "fail") || regression.failures.length > 0;

console.log(renderResults(results, regression));
if (failed) process.exitCode = 1;

function auditSocialApp(slug: (typeof SOCIAL_APPS)[number]): AppResult {
  const app = getApp(slug);
  const req = REQUIREMENTS[slug];
  const sources = readSources(slug);
  const writeActions = fs.readFileSync(
    path.join(process.cwd(), "src", "modules", "marketplace", "packs", slug, "sources", "workflows", "write_actions.md"),
    "utf8",
  );
  const compiled = compile(app);
  const combined = `${sources.combined}\n${compiled.combined}`;
  const failures = [
    ...REQUIRED_SOURCE_FILES
      .filter((file) => !sources.files.has(file))
      .map((file) => `missing source file ${file}`),
    ...missingTerms(combined, req.scopes, "missing scope/permission"),
    ...missingTerms(combined, req.endpoints, "missing endpoint/method"),
    ...missingTerms(writeActions, req.writeActionEndpoints, "write_actions.md missing concrete write endpoint/method"),
    ...missingTerms(combined, req.objects, "missing object model"),
    ...missingTerms(combined, req.rateLimits, "missing rate-limit/quota detail"),
    ...missingTerms(combined, req.requiredDocs, "missing official docs URL"),
    ...missingTerms(combined, req.requiredExampleTerms, "missing native approval/bad-request example term"),
    ...patternHits(combined, GENERIC_RESIDUE).map((hit) => `generic residue: ${hit}`),
    ...req.forbidden
      .filter((term) => combined.toLowerCase().includes(term.toLowerCase()))
      .map((term) => `wrong-platform or unsupported claim remains: ${term}`),
    ...patternHits(combined, SECRET_PATTERNS).map((hit) => `secret-like value in source/compiled output: ${hit}`),
  ];

  if (app.packQuality.level === "curated" && failures.length > 0) {
    failures.unshift("catalog is curated while strict social audit is failing");
  }

  return {
    slug,
    status: failures.length === 0 ? "pass" : "fail",
    catalogQuality: `${app.packQuality.level}/${app.packQuality.publicationStatus}`,
    openclawFiles: compiled.openclawFiles,
    hermesFiles: compiled.hermesFiles,
    docsUrls: Array.from(new Set([app.providerDocsUrl, ...sources.docsUrls])).sort(),
    failures,
  };
}

function auditReferenceRegression() {
  const failures: string[] = [];
  for (const slug of ["github", "stripe"]) {
    const app = getApp(slug);
    const compiled = slug === "github" ? compileGithub(app) : compileStripe(app);
    if (compiled.openclawFiles < 1) failures.push(`${slug} OpenClaw output is empty`);
    if (compiled.hermesFiles < 1) failures.push(`${slug} Hermes output is empty`);
  }
  return { status: failures.length === 0 ? "pass" : "fail", failures };
}

function getApp(slug: string): MarketplaceAppDefinition {
  const app = MARKETPLACE_CATALOG.find((item) => item.slug === slug);
  if (!app) throw new Error(`Missing marketplace app ${slug}`);
  return app;
}

function compile(app: MarketplaceAppDefinition) {
  return compileCanonical(app);
}

function compileCanonical(app: MarketplaceAppDefinition) {
  const input = compilerInput(app);
  const openclaw = compileCanonicalOpenClawPack(input);
  const hermes = compileCanonicalHermesPack(input);
  return {
    openclawFiles: openclaw.files.length,
    hermesFiles: hermes.files.length,
    combined: [...openclaw.files, ...hermes.files].map((file) => file.content).join("\n"),
  };
}

function compileGithub(app: MarketplaceAppDefinition) {
  const input = compilerInput(app);
  const openclaw = compileGithubOpenClawPack(input);
  const hermes = compileGithubHermesPack(input);
  return { openclawFiles: openclaw.files.length, hermesFiles: hermes.files.length };
}

function compileStripe(app: MarketplaceAppDefinition) {
  const input = compilerInput(app);
  const openclaw = compileStripeOpenClawPack(input);
  const hermes = compileStripeHermesPack(input);
  return { openclawFiles: openclaw.files.length, hermesFiles: hermes.files.length };
}

function compilerInput(app: MarketplaceAppDefinition) {
  return {
    app,
    selectedCapabilities: app.capabilities.filter((capability) => capability.defaultEnabled).map((capability) => capability.id),
    approvalProfileId: app.approvalProfile,
    connection: null,
    libraryTargetFolder: `marketplace/${app.slug}`,
  };
}

function readSources(slug: string) {
  const baseDir = path.join(process.cwd(), "src", "modules", "marketplace", "packs", slug, "sources");
  const files = walk(baseDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.relative(baseDir, file));
  const combined = files
    .map((file) => fs.readFileSync(path.join(baseDir, file), "utf8"))
    .join("\n");
  const docsUrls = Array.from(combined.matchAll(/https?:\/\/[^\s)"'>,\]]+/g)).map((match) =>
    match[0].replace(/[.;:]$/, ""),
  );
  return { files: new Set(files), combined, docsUrls };
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function missingTerms(content: string, terms: string[], label: string) {
  const lower = content.toLowerCase();
  return terms
    .filter((term) => !lower.includes(term.toLowerCase()))
    .map((term) => `${label}: ${term}`);
}

function patternHits(content: string, patterns: RegExp[]) {
  return patterns
    .filter((pattern) => pattern.test(content))
    .map((pattern) => pattern.source);
}

function renderResults(results: AppResult[], regression: { status: string; failures: string[] }) {
  return JSON.stringify(
    {
      socialAudit: results,
      openClawHermesProof: Object.fromEntries(
        results.map((result) => [result.slug, { openclawFiles: result.openclawFiles, hermesFiles: result.hermesFiles }]),
      ),
      githubStripeRegression: regression,
      passed: results.every((result) => result.status === "pass") && regression.status === "pass",
    },
    null,
    2,
  );
}
