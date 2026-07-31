import { ApiKeyHealthRoutingExtension } from "./api-key-health-routing.extension";
import { ApprovalExtension1 } from "./approval-01.extension";
import { CredentialsExtension1 } from "./credentials-01.extension";
import { CredentialsExtension2 } from "./credentials-02.extension";
import { CredentialsExtension3 } from "./credentials-03.extension";
import { CredentialsExtension4 } from "./credentials-04.extension";
import { CredentialsExtension5 } from "./credentials-05.extension";
import { DataPolicyExtension1 } from "./data-policy-01.extension";
import { HealthExtension1 } from "./health-01.extension";
import { OrchestrationExtension1 } from "./orchestration-01.extension";
import { SupportExtension1 } from "./support-01.extension";
import { mergeConnectorMethodModules } from "../connector-method-module";

export const CONNECTOR_EXECUTION_EXTENSIONS = mergeConnectorMethodModules(
  ApiKeyHealthRoutingExtension,
  ApprovalExtension1,
  CredentialsExtension1,
  CredentialsExtension2,
  CredentialsExtension3,
  CredentialsExtension4,
  CredentialsExtension5,
  DataPolicyExtension1,
  HealthExtension1,
  OrchestrationExtension1,
  SupportExtension1,
);

export type ConnectorExecutionExtensionMethods =
  typeof CONNECTOR_EXECUTION_EXTENSIONS;
