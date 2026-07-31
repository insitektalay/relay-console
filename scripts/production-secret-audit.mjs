#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  auditProductionSecrets,
  PRODUCTION_SECRET_POLICY,
  runProductionSecretAuditCli,
} from "../backend/security/production-secret-audit.mjs";

export {
  auditProductionSecrets,
  PRODUCTION_SECRET_POLICY,
  runProductionSecretAuditCli,
};

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  process.exitCode = runProductionSecretAuditCli();
}
