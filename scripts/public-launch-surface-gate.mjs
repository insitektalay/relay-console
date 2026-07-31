#!/usr/bin/env node

import { createHash } from "node:crypto";
import { resolveMx } from "node:dns/promises";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  RELEASE_REPOSITORY,
  validateReleaseRemoteEvidence,
} from "./release-remote-evidence.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const SCHEMA_PATH = resolve(
  DEFAULT_ROOT,
  "RelayConsoleSwift/Release/public-launch-surfaces.schema.json",
);
export const CANONICAL_BASE_URL = "https://relayconsole.work";
export const RELEASE_IDENTITY_PATH = "/release-identity.json";
export const REQUIRED_ROUTES = [
  "/",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/support",
  "/security",
  "/subprocessors",
  "/data-deletion",
  "/third-party-notices",
  "/status",
  "/known-issues",
  "/release-notes",
  "/download",
  "/updates",
];

const PLACEHOLDER_PATTERNS = [
  /\b(?:draft|placeholder)\b/i,
  /\bbefore (?:public )?launch\b/i,
  /\b(?:must|required to|needs to) (?:be )?(?:approve|approved|review|reviewed|supply|select|configure)\b/i,
  /\bhas not (?:set|approved|published|selected)\b/i,
  /\bwill publish\b/i,
  /\b(?:no public artifact|not published|not available|will enable)\b/i,
  /<[^>]+>/,
];

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(
  JSON.parse(readFileSync(SCHEMA_PATH, "utf8")),
);

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const key = argument.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function json(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function normalizedText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|apos|quot);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function placeholderHits(text) {
  return PLACEHOLDER_PATTERNS
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);
}

function mailAddresses(html) {
  return [...html.matchAll(/mailto:([^"'?\s>]+)/gi)]
    .map((match) => decodeURIComponent(match[1]).toLowerCase())
    .filter((value, index, values) => /^[^@\s]+@[^@\s]+$/.test(value) && values.indexOf(value) === index)
    .sort();
}

function captureError(error, fallback) {
  if (!error || typeof error !== "object") return fallback;
  return String(error.code ?? error.name ?? fallback).slice(0, 80);
}

function deploymentURL(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function releaseBindingFromRemoteEvidence(remoteEvidence) {
  const result = validateReleaseRemoteEvidence(remoteEvidence, {
    sourceCommit: remoteEvidence?.sourceCommit ?? null,
    sourceBranch: remoteEvidence?.sourceBranch ?? null,
  });
  if (!result.valid) {
    throw new Error(`Remote release evidence is invalid: ${result.errors.join(" ")}`);
  }
  return {
    repository: RELEASE_REPOSITORY,
    sourceCommit: remoteEvidence.sourceCommit,
    sourceBranch: remoteEvidence.sourceBranch,
    githubDeploymentId: remoteEvidence.vercel.githubDeploymentId,
    deploymentURL: deploymentURL(remoteEvidence.vercel.deploymentURL),
  };
}

async function captureReleaseIdentity({ baseURL, fetchImpl }) {
  const requestedURL = `${baseURL}${RELEASE_IDENTITY_PATH}`;
  try {
    const response = await fetchImpl(requestedURL, {
      redirect: "follow",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.text();
    let document = null;
    let error = response.ok ? null : `HTTP${response.status}`;
    if (response.ok && body.length <= 65_536) {
      try {
        const parsed = JSON.parse(body);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) document = parsed;
        else error = "InvalidJSONDocument";
      } catch {
        error = "InvalidJSON";
      }
    } else if (response.ok) error = "ResponseTooLarge";
    return {
      path: RELEASE_IDENTITY_PATH,
      finalURL: response.url || requestedURL,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      bodySha256: createHash("sha256").update(body).digest("hex"),
      document,
      error,
    };
  } catch (error) {
    return {
      path: RELEASE_IDENTITY_PATH,
      finalURL: requestedURL,
      status: null,
      contentType: "",
      bodySha256: null,
      document: null,
      error: captureError(error, "FetchError"),
    };
  }
}

export async function capturePublicLaunchSurfaces({
  remoteEvidence,
  baseURL = CANONICAL_BASE_URL,
  fetchImpl = fetch,
  resolveMxImpl = resolveMx,
  capturedAt = new Date().toISOString(),
} = {}) {
  const releaseBinding = releaseBindingFromRemoteEvidence(remoteEvidence);
  if (!releaseBinding.deploymentURL) {
    throw new Error("Remote release evidence has an invalid Vercel deployment URL.");
  }
  const releaseIdentity = await captureReleaseIdentity({ baseURL, fetchImpl });
  const routes = [];
  const advertisedAddresses = new Set();
  for (const path of REQUIRED_ROUTES) {
    const requestedURL = `${baseURL}${path}`;
    try {
      const response = await fetchImpl(requestedURL, {
        redirect: "follow",
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(10_000),
      });
      const html = await response.text();
      const text = normalizedText(html);
      const addresses = mailAddresses(html);
      for (const address of addresses) advertisedAddresses.add(address);
      routes.push({
        path,
        finalURL: response.url || requestedURL,
        status: response.status,
        contentType: response.headers.get("content-type") ?? "",
        bodySha256: createHash("sha256").update(html).digest("hex"),
        placeholderHits: placeholderHits(text),
        supportHoursPublished: path === "/support" && /Monday to Friday/i.test(text) && /UK time/i.test(text),
        responseTargetPublished: path === "/support" && /within two business days/i.test(text),
        error: response.ok ? null : `HTTP${response.status}`,
      });
    } catch (error) {
      routes.push({
        path,
        finalURL: requestedURL,
        status: null,
        contentType: "",
        bodySha256: null,
        placeholderHits: [],
        supportHoursPublished: false,
        responseTargetPublished: false,
        error: captureError(error, "FetchError"),
      });
    }
  }

  const domains = [...new Set([...advertisedAddresses].map((address) => address.split("@")[1]))].sort();
  const mailDomains = [];
  for (const domain of domains) {
    try {
      const records = await resolveMxImpl(domain);
      mailDomains.push({
        domain,
        exchanges: records
          .map(({ exchange }) => exchange.toLowerCase().replace(/\.$/, ""))
          .filter(Boolean)
          .sort(),
        error: null,
      });
    } catch (error) {
      mailDomains.push({
        domain,
        exchanges: [],
        error: captureError(error, "DnsError"),
      });
    }
  }

  return {
    schemaVersion: "relay.public-launch-surfaces.v5",
    capturedAt,
    baseURL,
    releaseBinding,
    releaseIdentity,
    routes,
    advertisedAddresses: [...advertisedAddresses].sort(),
    mailDomains,
  };
}

function formatSchemaError(error) {
  const location = error.instancePath || "$";
  if (error.keyword === "additionalProperties") {
    return `${location}: unsupported field ${error.params.additionalProperty}`;
  }
  return `${location}: ${error.message ?? error.keyword}`;
}

export function validatePublicLaunchSurfacesSchema(snapshot) {
  if (validateSchema(snapshot)) return [];
  return (validateSchema.errors ?? []).map(formatSchemaError);
}

export function validatePublicLaunchSurfaces(snapshot, { remoteEvidence = null } = {}) {
  const errors = validatePublicLaunchSurfacesSchema(snapshot).map((error) => `Schema: ${error}`);
  let expectedBinding = null;
  try {
    expectedBinding = releaseBindingFromRemoteEvidence(remoteEvidence);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Remote release evidence is required.");
  }

  if (snapshot?.baseURL !== CANONICAL_BASE_URL) errors.push(`baseURL must be ${CANONICAL_BASE_URL}`);
  if (!Number.isFinite(Date.parse(snapshot?.capturedAt))) errors.push("capturedAt must be an ISO timestamp");

  if (expectedBinding) {
    for (const key of ["repository", "sourceCommit", "sourceBranch", "githubDeploymentId"]) {
      if (snapshot?.releaseBinding?.[key] !== expectedBinding[key]) errors.push(`release binding ${key} differs from remote evidence`);
    }
    if (deploymentURL(snapshot?.releaseBinding?.deploymentURL) !== expectedBinding.deploymentURL) {
      errors.push("release binding deploymentURL differs from remote evidence");
    }
  }

  const identity = snapshot?.releaseIdentity;
  if (identity?.status !== 200) errors.push(`release identity returned ${identity?.status ?? "no response"}`);
  if (identity?.finalURL !== `${CANONICAL_BASE_URL}${RELEASE_IDENTITY_PATH}`) errors.push("release identity redirected away from its canonical URL");
  if (!String(identity?.contentType).toLowerCase().includes("application/json")) errors.push("release identity did not return JSON");
  if (!/^[a-f0-9]{64}$/.test(identity?.bodySha256 ?? "")) errors.push("release identity is missing a content hash");
  if (identity?.error) errors.push(`release identity capture failed: ${identity.error}`);
  const document = identity?.document;
  if (!document) errors.push("release identity document is missing");
  else {
    for (const key of ["repository", "sourceCommit", "sourceBranch", "deploymentURL"]) {
      const expected = key === "deploymentURL"
        ? deploymentURL(snapshot?.releaseBinding?.[key])
        : snapshot?.releaseBinding?.[key];
      const actual = key === "deploymentURL" ? deploymentURL(document[key]) : document[key];
      if (actual !== expected) errors.push(`release identity ${key} differs from the release binding`);
    }
    if (document.environment !== "production") errors.push("release identity is not a production deployment");
  }

  const routes = Array.isArray(snapshot?.routes) ? snapshot.routes : [];
  for (const path of REQUIRED_ROUTES) {
    const matches = routes.filter((route) => route?.path === path);
    if (matches.length !== 1) {
      errors.push(`${path} must appear exactly once`);
      continue;
    }
    const route = matches[0];
    if (route.finalURL !== `${CANONICAL_BASE_URL}${path}`) errors.push(`${path} redirected away from its canonical URL`);
    if (route.status !== 200) errors.push(`${path} returned ${route.status ?? "no response"}`);
    if (!String(route.contentType).toLowerCase().includes("text/html")) errors.push(`${path} did not return HTML`);
    if (!/^[a-f0-9]{64}$/.test(route.bodySha256 ?? "")) errors.push(`${path} is missing a content hash`);
    if (route.placeholderHits?.length) errors.push(`${path} still contains launch-placeholder wording`);
    if (route.error) errors.push(`${path} capture failed: ${route.error}`);
  }
  if (routes.length !== REQUIRED_ROUTES.length) errors.push("snapshot contains unexpected or duplicate routes");

  const support = routes.find((route) => route?.path === "/support");
  if (!support?.supportHoursPublished) errors.push("support hours are not published");
  if (!support?.responseTargetPublished) errors.push("support response target is not published");

  const addresses = Array.isArray(snapshot?.advertisedAddresses) ? snapshot.advertisedAddresses : [];
  if (addresses.length === 0) errors.push("no public support or security email address is advertised");
  const domains = new Set(addresses.map((address) => address.split("@")[1]));
  const mailDomains = Array.isArray(snapshot?.mailDomains) ? snapshot.mailDomains : [];
  for (const domain of domains) {
    const matches = mailDomains.filter((entry) => entry?.domain === domain);
    if (matches.length !== 1 || matches[0].exchanges?.length === 0) errors.push(`${domain} has no verified MX route`);
  }
  if (mailDomains.length !== domains.size || mailDomains.some((entry) => !domains.has(entry?.domain))) {
    errors.push("mail-domain evidence contains unexpected or duplicate domains");
  }
  return { valid: errors.length === 0, errors };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (typeof options["remote-evidence"] !== "string") {
    throw new Error("--remote-evidence <release-remote-evidence.json> is required.");
  }
  const remoteEvidence = json(options["remote-evidence"]);
  let snapshot;
  if (options.capture) {
    snapshot = await capturePublicLaunchSurfaces({ remoteEvidence });
  } else if (typeof options.validate === "string") {
    snapshot = json(options.validate);
  } else {
    throw new Error("Use --capture or --validate <public-launch-surfaces.json>.");
  }
  const result = validatePublicLaunchSurfaces(snapshot, { remoteEvidence });
  if (options.capture) {
    const payload = `${JSON.stringify(snapshot, null, 2)}\n`;
    if (typeof options.output === "string") writeFileSync(resolve(options.output), payload);
    else process.stdout.write(payload);
  }
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  if (!result.valid) process.exitCode = 1;
  else process.stderr.write("Public launch surfaces are valid for the exact Vercel release.\n");
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) await main();
