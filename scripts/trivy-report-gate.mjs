#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const BLOCKING_SEVERITIES = new Set(["CRITICAL", "HIGH"])

function expectArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

export function evaluateTrivyReport(report, reportName = "Trivy report") {
  if (report === null || typeof report !== "object" || Array.isArray(report)) {
    throw new Error(`${reportName} must be a JSON object`)
  }
  if (!Number.isSafeInteger(report.SchemaVersion)) {
    throw new Error(`${reportName} has no schema version`)
  }
  if (typeof report.ArtifactName !== "string" || report.ArtifactName.length === 0) {
    throw new Error(`${reportName} has no artifact identity`)
  }
  const results = expectArray(report.Results, `${reportName} results`)
  if (results.length === 0) throw new Error(`${reportName} has no scan results`)

  const findings = []
  for (const result of results) {
    for (const [field, kind] of [
      ["Vulnerabilities", "vulnerability"],
      ["Misconfigurations", "misconfiguration"],
      ["Secrets", "secret"],
    ]) {
      if (result[field] === undefined) continue
      for (const finding of expectArray(
        result[field],
        `${reportName} ${field}`,
      )) {
        const severity = String(finding.Severity ?? "").toUpperCase()
        if (!BLOCKING_SEVERITIES.has(severity)) continue
        findings.push({
          id:
            finding.VulnerabilityID ??
            finding.ID ??
            finding.RuleID ??
            "unknown",
          kind,
          package: finding.PkgName ?? finding.Title ?? result.Target ?? "unknown",
          severity,
          target: result.Target ?? "unknown",
        })
      }
    }
  }
  findings.sort((left, right) =>
    `${left.severity}:${left.id}:${left.target}`.localeCompare(
      `${right.severity}:${right.id}:${right.target}`,
    ),
  )
  return {
    artifact: report.ArtifactName,
    blockingFindings: findings,
    resultCount: results.length,
  }
}

async function main() {
  const reportPaths = process.argv.slice(2)
  if (reportPaths.length === 0) {
    throw new Error("at least one Trivy JSON report path is required")
  }
  const summaries = []
  for (const reportPath of reportPaths) {
    let report
    try {
      report = JSON.parse(await readFile(reportPath, "utf8"))
    } catch (error) {
      throw new Error(`${reportPath} is not a valid Trivy report: ${error.message}`)
    }
    summaries.push(evaluateTrivyReport(report, reportPath))
  }
  const blocking = summaries.flatMap((summary) =>
    summary.blockingFindings.map((finding) => ({
      artifact: summary.artifact,
      ...finding,
    })),
  )
  if (blocking.length > 0) {
    for (const finding of blocking) {
      console.error(
        `${finding.severity} ${finding.id} in ${finding.artifact} ` +
          `(${finding.target}: ${finding.package})`,
      )
    }
    throw new Error(
      `${blocking.length} High/Critical production image finding(s) block release`,
    )
  }
  process.stdout.write(`${JSON.stringify(summaries)}\n`)
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isEntryPoint) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
