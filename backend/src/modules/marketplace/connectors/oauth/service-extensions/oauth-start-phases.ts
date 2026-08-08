import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { COGNITO_FORMS_MCP_RESOURCE } from "../../cognito-forms/cognito-forms-mcp.adapter";
import {
  JOTFORM_MCP_RESOURCE,
  JotformMcpError,
} from "../../jotform/jotform-mcp.adapter";
import {
  CRAFT_MCP_RESOURCE,
  CraftMcpError,
} from "../../craft/craft-mcp.adapter";
import {
  MastodonApiAdapter,
  MastodonApiError,
} from "../../mastodon/mastodon-api.adapter";
import { RELAY_GOOGLE_OAUTH_SLUGS } from "../google-oauth-providers";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import {
  resolveOAuthStartClientId,
  resolveOAuthStartClientSecret,
} from "../oauth-start-credentials";

async function runOAuthStartPhase1(
  service: MarketplaceConnectorOAuthService,
  context: {
    workspaceId: string;
    userId: string;
    appSlug: string;
    input: Parameters<MarketplaceConnectorOAuthService["startOAuth"]>[3];
  },
) {
  const manifest = service.requireOAuthManifest(context.appSlug);
  const existing = context.input.connectionId
    ? await service.getConnectionWithSecrets(
        context.workspaceId,
        manifest.slug,
        context.input.connectionId,
      )
    : null;
  const existingCredentials = existing
    ? service.credentials.decrypt(existing)
    : null;
  let mastodonRegistration: Awaited<
    ReturnType<MastodonApiAdapter["registerApp"]>
  > | null = null;
  let jotformRegistration: { clientId: string } | null = null;
  let craftRegistration: { clientId: string; clientSecret: string } | null =
    null;
  if (manifest.slug === "mastodon") {
    try {
      const requestedOrigin = service.mastodonApi.normalizeInstanceOrigin(
        context.input.providerDomain ??
          service.stringOrNull(existing?.metadata?.mastodonInstanceOrigin) ??
          "",
      );
      const existingOrigin = existing
        ? service.mastodonApi.normalizeInstanceOrigin(
            existing.metadata?.mastodonInstanceOrigin,
          )
        : null;
      const existingClientId = service.stringOrNull(
        existingCredentials?.clientId,
      );
      const existingClientSecret = service.stringOrNull(
        existingCredentials?.clientSecret,
      );
      if (
        requestedOrigin === existingOrigin &&
        existingClientId &&
        existingClientSecret
      ) {
        mastodonRegistration = {
          origin: requestedOrigin,
          clientId: existingClientId,
          clientSecret: existingClientSecret,
          ...(await service.mastodonApi.getInstance(requestedOrigin)),
        };
      } else {
        mastodonRegistration = await service.mastodonApi.registerApp(
          requestedOrigin,
          service.getCallbackUrl("mastodon"),
          manifest.auth.oauth?.requiredScopes ?? [],
        );
      }
    } catch (error) {
      if (error instanceof MastodonApiError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
  if (
    manifest.slug === "jotform" &&
    !context.input.clientId?.trim() &&
    !service.configService.get<string>("JOTFORM_MCP_CLIENT_ID")?.trim() &&
    !service.stringOrNull(existingCredentials?.clientId) &&
    !service.stringOrNull(existing?.metadata?.clientId)
  ) {
    try {
      jotformRegistration = await service.jotformMcp.registerPublicClient(
        service.getCallbackUrl("jotform"),
      );
    } catch (error) {
      if (error instanceof JotformMcpError) {
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
  }
  if (
    manifest.slug === "craft" &&
    !context.input.clientId?.trim() &&
    !service.stringOrNull(existingCredentials?.clientId) &&
    !service.stringOrNull(existing?.metadata?.clientId)
  ) {
    try {
      craftRegistration = await service.craftMcp.registerClient(
        service.getCallbackUrl("craft"),
      );
    } catch (error) {
      if (error instanceof CraftMcpError)
        throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }
  const cloudflareAccountId =
    manifest.slug === "cloudflare"
      ? service.stringOrNull(existingCredentials?.CLOUDFLARE_ACCOUNT_ID)
      : null;
  const cloudflareZoneId =
    manifest.slug === "cloudflare"
      ? service.stringOrNull(existingCredentials?.CLOUDFLARE_ZONE_ID)
      : null;
  const vercelProjectId =
    manifest.slug === "vercel"
      ? service.stringOrNull(existingCredentials?.VERCEL_PROJECT_ID)
      : null;
  const herokuTeamId =
    manifest.slug === "heroku"
      ? service.stringOrNull(existingCredentials?.HEROKU_TEAM_ID)
      : null;
  const herokuAppId =
    manifest.slug === "heroku"
      ? service.stringOrNull(existingCredentials?.HEROKU_APP_ID)
      : null;
  const digitalOceanTeamId =
    manifest.slug === "digitalocean"
      ? service.stringOrNull(existingCredentials?.DIGITALOCEAN_TEAM_ID)
      : null;
  const digitalOceanProjectId =
    manifest.slug === "digitalocean"
      ? service.stringOrNull(existingCredentials?.DIGITALOCEAN_PROJECT_ID)
      : null;
  const digitalOceanResourceUrn =
    manifest.slug === "digitalocean"
      ? service.stringOrNull(existingCredentials?.DIGITALOCEAN_RESOURCE_URN)
      : null;
  const firebaseProjectId =
    manifest.slug === "firebase"
      ? service.stringOrNull(existingCredentials?.FIREBASE_PROJECT_ID)
      : null;
  const supabaseOrganizationSlug =
    manifest.slug === "supabase"
      ? service.stringOrNull(existingCredentials?.SUPABASE_ORGANIZATION_SLUG)
      : null;
  const supabaseProjectRef =
    manifest.slug === "supabase"
      ? service.stringOrNull(existingCredentials?.SUPABASE_PROJECT_REF)
      : null;
  const bambooHRCompanyDomain =
    manifest.slug === "bamboohr"
      ? service
          .stringOrNull(existingCredentials?.BAMBOOHR_COMPANY_DOMAIN)
          ?.toLowerCase()
      : null;
  const bambooHRLocationId =
    manifest.slug === "bamboohr"
      ? service.stringOrNull(existingCredentials?.BAMBOOHR_LOCATION_ID)
      : null;
  const greenhouseOrganizationId =
    manifest.slug === "greenhouse"
      ? service.stringOrNull(existingCredentials?.GREENHOUSE_ORGANIZATION_ID)
      : null;
  const leverAccountId =
    manifest.slug === "lever"
      ? service.stringOrNull(existingCredentials?.LEVER_ACCOUNT_ID)
      : null;
  const gmailAccountEmail =
    manifest.slug === "gmail"
      ? service
          .stringOrNull(existingCredentials?.GMAIL_ACCOUNT_EMAIL)
          ?.toLowerCase()
      : null;
  const googleCalendarAccountEmail =
    manifest.slug === "google-calendar"
      ? service
          .stringOrNull(existingCredentials?.GOOGLE_CALENDAR_ACCOUNT_EMAIL)
          ?.toLowerCase()
      : null;
  const googleCalendarDefaultCalendarId =
    manifest.slug === "google-calendar"
      ? service.stringOrNull(
          existingCredentials?.GOOGLE_CALENDAR_DEFAULT_CALENDAR_ID,
        )
      : null;
  if (
    manifest.slug === "cloudflare" &&
    (!cloudflareAccountId ||
      !cloudflareZoneId ||
      !/^[a-f0-9]{32}$/.test(cloudflareAccountId) ||
      !/^[a-f0-9]{32}$/.test(cloudflareZoneId))
  )
    throw new BadRequestException(
      "Cloudflare OAuth requires exact 32-character account and zone IDs",
    );
  if (
    manifest.slug === "vercel" &&
    (!vercelProjectId || !/^[A-Za-z0-9_-]{3,128}$/.test(vercelProjectId))
  )
    throw new BadRequestException(
      "Vercel installation requires one exact selected project ID",
    );
  if (
    manifest.slug === "heroku" &&
    (!herokuTeamId ||
      !herokuAppId ||
      !/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(
        herokuTeamId,
      ) ||
      !/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(
        herokuAppId,
      ))
  )
    throw new BadRequestException(
      "Heroku OAuth requires exact Team and selected-App UUIDs",
    );
  const digitalOceanUuid =
    /^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;
  const digitalOceanUrn =
    /^(?:do:droplet:[1-9][0-9]{0,19}|do:app:[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})$/;
  if (
    manifest.slug === "digitalocean" &&
    (!digitalOceanTeamId ||
      !digitalOceanProjectId ||
      !digitalOceanResourceUrn ||
      !digitalOceanUuid.test(digitalOceanTeamId) ||
      !digitalOceanUuid.test(digitalOceanProjectId) ||
      !digitalOceanUrn.test(digitalOceanResourceUrn))
  )
    throw new BadRequestException(
      "DigitalOcean OAuth requires exact Team, Project, and selected Droplet/App bindings",
    );
  if (
    manifest.slug === "firebase" &&
    (!firebaseProjectId ||
      !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(firebaseProjectId))
  )
    throw new BadRequestException(
      "Firebase OAuth requires one exact 6-30 character selected Project ID",
    );
  if (
    manifest.slug === "supabase" &&
    (!supabaseOrganizationSlug ||
      !supabaseProjectRef ||
      !/^[a-z0-9][a-z0-9_-]{1,127}$/.test(supabaseOrganizationSlug) ||
      !/^[a-z]{20}$/.test(supabaseProjectRef))
  )
    throw new BadRequestException(
      "Supabase OAuth requires one exact Organization slug and twenty-letter selected Project ref",
    );
  if (
    manifest.slug === "bamboohr" &&
    (!bambooHRCompanyDomain ||
      !bambooHRLocationId ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(bambooHRCompanyDomain) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(bambooHRLocationId))
  )
    throw new BadRequestException(
      "BambooHR OAuth requires one exact Company Domain and selected Location ID",
    );
  if (
    manifest.slug === "greenhouse" &&
    (!greenhouseOrganizationId ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(greenhouseOrganizationId))
  )
    throw new BadRequestException(
      "Greenhouse OAuth requires one exact Recruiting Organization ID",
    );
  if (
    manifest.slug === "lever" &&
    (!leverAccountId || !/^[A-Za-z0-9_-]{1,128}$/.test(leverAccountId))
  )
    throw new BadRequestException("Lever OAuth requires one exact Account ID");
  if (
    manifest.slug === "gmail" &&
    (!gmailAccountEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmailAccountEmail))
  )
    throw new BadRequestException(
      "Gmail OAuth requires one exact account email",
    );
  if (
    manifest.slug === "google-calendar" &&
    (!googleCalendarAccountEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(googleCalendarAccountEmail) ||
      !googleCalendarDefaultCalendarId ||
      googleCalendarDefaultCalendarId.length > 320)
  )
    throw new BadRequestException(
      "Google Calendar OAuth requires one exact primary account email and default Calendar ID",
    );
  const dropboxClientId =
    manifest.slug === "dropbox"
      ? service.configService.get<string>("DROPBOX_CLIENT_ID")?.trim()
      : null;
  const boxClientId =
    manifest.slug === "box"
      ? service.configService.get<string>("BOX_CLIENT_ID")?.trim()
      : null;
  const googleClientId = RELAY_GOOGLE_OAUTH_SLUGS.has(manifest.slug)
    ? service.configService.get<string>("GOOGLE_OAUTH_CLIENT_ID")?.trim()
    : null;
  const signNowClientId =
    manifest.slug === "signnow"
      ? service.configService.get<string>("SIGNNOW_CLIENT_ID")?.trim()
      : null;
  const signRequestClientId =
    manifest.slug === "signrequest"
      ? service.configService.get<string>("SIGNREQUEST_CLIENT_ID")?.trim()
      : null;
  const signeasyClientId =
    manifest.slug === "signeasy"
      ? service.configService.get<string>("SIGNEASY_CLIENT_ID")?.trim()
      : null;
  const rightSignatureClientId =
    manifest.slug === "rightsignature"
      ? service.configService.get<string>("RIGHTSIGNATURE_CLIENT_ID")?.trim()
      : null;
  const restreamClientId =
    manifest.slug === "restream"
      ? service.configService.get<string>("RESTREAM_CLIENT_ID")?.trim()
      : null;
  const clientId = resolveOAuthStartClientId(service, {
    slug: manifest.slug,
    explicitClientId:
      context.input.clientId ??
      jotformRegistration?.clientId ??
      craftRegistration?.clientId,
    mastodonClientId: mastodonRegistration?.clientId,
    googleClientId,
    boxClientId,
    dropboxClientId,
    signNowClientId,
    signRequestClientId,
    signeasyClientId,
    rightSignatureClientId,
    restreamClientId,
    storedClientId: existingCredentials?.clientId,
    metadataClientId: existing?.metadata?.clientId,
  });
  if (!clientId)
    throw new BadRequestException(`${manifest.name} client ID is required`);
  const dropboxClientSecret =
    manifest.slug === "dropbox"
      ? service.configService.get<string>("DROPBOX_CLIENT_SECRET")?.trim()
      : null;
  const boxClientSecret =
    manifest.slug === "box"
      ? service.configService.get<string>("BOX_CLIENT_SECRET")?.trim()
      : null;
  const googleClientSecret = RELAY_GOOGLE_OAUTH_SLUGS.has(manifest.slug)
    ? service.configService.get<string>("GOOGLE_OAUTH_CLIENT_SECRET")?.trim()
    : null;
  const restreamClientSecret =
    manifest.slug === "restream"
      ? service.configService.get<string>("RESTREAM_CLIENT_SECRET")?.trim()
      : null;
  const clientSecret = resolveOAuthStartClientSecret(service, {
    slug: manifest.slug,
    explicitClientSecret:
      context.input.clientSecret ?? craftRegistration?.clientSecret,
    mastodonClientSecret: mastodonRegistration?.clientSecret,
    googleClientSecret,
    boxClientSecret,
    dropboxClientSecret,
    restreamClientSecret,
    storedClientSecret: existingCredentials?.clientSecret,
  });
  if (manifest.slug === "freeagent" && !clientSecret)
    throw new BadRequestException(
      "FreeAgent client secret is not configured on Railway",
    );
  return {
    ...context,
    manifest,
    existing,
    existingCredentials,
    mastodonRegistration,
    jotformRegistration,
    craftRegistration,
    cloudflareAccountId,
    cloudflareZoneId,
    vercelProjectId,
    herokuTeamId,
    herokuAppId,
    digitalOceanTeamId,
    digitalOceanProjectId,
    digitalOceanResourceUrn,
    firebaseProjectId,
    supabaseOrganizationSlug,
    supabaseProjectRef,
    bambooHRCompanyDomain,
    bambooHRLocationId,
    greenhouseOrganizationId,
    leverAccountId,
    gmailAccountEmail,
    googleCalendarAccountEmail,
    googleCalendarDefaultCalendarId,
    digitalOceanUuid,
    digitalOceanUrn,
    dropboxClientId,
    boxClientId,
    googleClientId,
    signNowClientId,
    signRequestClientId,
    signeasyClientId,
    rightSignatureClientId,
    restreamClientId,
    clientId,
    dropboxClientSecret,
    boxClientSecret,
    googleClientSecret,
    restreamClientSecret,
    clientSecret,
  };
}

async function runOAuthStartPhase2(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthStartPhase1>>,
) {
  if (context.manifest.slug === "salesforce" && !context.clientSecret)
    throw new BadRequestException(
      "Salesforce client secret is not configured on Railway",
    );
  if (context.manifest.slug === "hubspot" && !context.clientSecret)
    throw new BadRequestException(
      "HubSpot client secret is not configured on Railway",
    );
  if (context.manifest.slug === "pipedrive" && !context.clientSecret)
    throw new BadRequestException(
      "Pipedrive client secret is not configured on Railway",
    );
  if (context.manifest.slug === "zoho" && !context.clientSecret)
    throw new BadRequestException(
      "Zoho CRM client secret is not configured on Railway",
    );
  if (context.manifest.slug === "zoho-desk" && !context.clientSecret)
    throw new BadRequestException(
      "Zoho Desk client secret is not configured on Railway",
    );
  if (context.manifest.slug === "zoho-projects" && !context.clientSecret)
    throw new BadRequestException(
      "Zoho Projects client secret is not configured on Railway",
    );
  if (context.manifest.slug === "zoho-people" && !context.clientSecret)
    throw new BadRequestException(
      "Zoho People client secret is not configured on Railway",
    );
  if (context.manifest.slug === "zoho-campaigns" && !context.clientSecret)
    throw new BadRequestException(
      "Zoho Campaigns client secret is not configured on Railway",
    );
  if (context.manifest.slug === "zoho-analytics" && !context.clientSecret)
    throw new BadRequestException(
      "Zoho Analytics client secret is not configured on Railway",
    );
  if (context.manifest.slug === "copper" && !context.clientSecret)
    throw new BadRequestException(
      "Copper client secret is not configured on Railway",
    );
  if (context.manifest.slug === "surveymonkey" && !context.clientSecret)
    throw new BadRequestException(
      "SurveyMonkey client secret is not configured on Railway",
    );
  if (context.manifest.slug === "fillout" && !context.clientSecret)
    throw new BadRequestException(
      "Fillout client secret is not configured on Railway",
    );
  if (context.manifest.slug === "mailchimp" && !context.clientSecret)
    throw new BadRequestException(
      "Mailchimp client secret is not configured on Railway",
    );
  if (context.manifest.slug === "mailchimp-surveys" && !context.clientSecret)
    throw new BadRequestException(
      "Mailchimp Surveys client secret is not configured on Railway",
    );
  if (context.manifest.slug === "klaviyo-sms" && !context.clientSecret)
    throw new BadRequestException(
      "Klaviyo SMS client secret is not configured on Railway",
    );
  if (context.manifest.slug === "klaviyo" && !context.clientSecret)
    throw new BadRequestException(
      "Klaviyo client secret is not configured on Railway",
    );
  if (context.manifest.slug === "convertkit" && !context.clientSecret)
    throw new BadRequestException(
      "Kit client secret is not configured on Railway",
    );
  if (context.manifest.slug === "campaign-monitor" && !context.clientSecret)
    throw new BadRequestException(
      "Campaign Monitor client secret is not configured on Railway",
    );
  if (context.manifest.slug === "constant-contact" && !context.clientSecret)
    throw new BadRequestException(
      "Constant Contact client secret is not configured on Railway",
    );
  if (context.manifest.slug === "close" && !context.clientSecret)
    throw new BadRequestException(
      "Close client secret is not configured on Railway",
    );
  if (context.manifest.slug === "attio" && !context.clientSecret)
    throw new BadRequestException(
      "Attio public app client secret is not configured on Railway",
    );
  if (context.manifest.slug === "zendesk-sell" && !context.clientSecret)
    throw new BadRequestException(
      "Zendesk Sell OAuth app client secret is not configured on Railway",
    );
  if (context.manifest.slug === "keap-max-classic" && !context.clientSecret)
    throw new BadRequestException(
      "Keap Max Classic OAuth app client secret is not configured on Railway",
    );
  if (context.manifest.slug === "zendesk" && !context.clientSecret)
    throw new BadRequestException(
      "Zendesk global OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "zoom" && !context.clientSecret)
    throw new BadRequestException(
      "Zoom OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "intercom" && !context.clientSecret)
    throw new BadRequestException(
      "Intercom public app client secret is not configured on Railway",
    );
  if (context.manifest.slug === "help-scout" && !context.clientSecret)
    throw new BadRequestException(
      "Help Scout OAuth app client secret is not configured on Railway",
    );
  if (context.manifest.slug === "front" && !context.clientSecret)
    throw new BadRequestException(
      "Front OAuth app client secret is not configured on Railway",
    );
  if (context.manifest.slug === "teamwork" && !context.clientSecret)
    throw new BadRequestException(
      "Teamwork App Login client secret is not configured on Railway",
    );
  if (context.manifest.slug === "basecamp" && !context.clientSecret)
    throw new BadRequestException(
      "Basecamp OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "wrike" && !context.clientSecret)
    throw new BadRequestException(
      "Wrike OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "smartsheet" && !context.clientSecret)
    throw new BadRequestException(
      "Smartsheet OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "todoist" && !context.clientSecret)
    throw new BadRequestException(
      "Todoist OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "ticktick" && !context.clientSecret)
    throw new BadRequestException(
      "TickTick OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "harvest" && !context.clientSecret)
    throw new BadRequestException(
      "Harvest OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "calendly" && !context.clientSecret)
    throw new BadRequestException(
      "Calendly OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "cal-com" && !context.clientSecret)
    throw new BadRequestException(
      "Cal.com OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "docusign" && !context.clientSecret)
    throw new BadRequestException(
      "Docusign integration-key secret is not configured on Railway",
    );
  if (context.manifest.slug === "dropbox-sign" && !context.clientSecret)
    throw new BadRequestException(
      "Dropbox Sign OAuth API App client secret is not configured on Railway",
    );
  if (context.manifest.slug === "pandadoc" && !context.clientSecret)
    throw new BadRequestException(
      "PandaDoc OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "typeform" && !context.clientSecret)
    throw new BadRequestException(
      "Typeform OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "sendfox" && !context.clientSecret)
    throw new BadRequestException(
      "SendFox OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "beehiiv" && !context.clientSecret)
    throw new BadRequestException(
      "beehiiv OAuth client secret is not configured on Railway",
    );
  if (context.manifest.slug === "buffer" && !context.clientSecret)
    throw new BadRequestException(
      "Buffer OAuth client secret is not configured on Railway",
    );
  if (
    [
      "clio-manage",
      "clio-grow",
      "practicepanther",
      "smokeball",
      "lawpay",
      "filevine",
      "microsoft-365-ediscovery",
      "google-vault",
    ].includes(context.manifest.slug) &&
    !context.clientSecret
  )
    throw new BadRequestException(
      `${context.manifest.name} OAuth client secret is not configured on Railway`,
    );
  if (
    context.manifest.slug === "smokeball" &&
    !service.configService.get<string>("SMOKEBALL_API_KEY")?.trim()
  )
    throw new BadRequestException(
      "Smokeball provider-issued API key is not configured on Railway",
    );
  if (context.manifest.slug === "threads" && !context.clientSecret)
    throw new BadRequestException(
      "Threads app secret is not configured on Railway",
    );
  if (context.manifest.slug === "pinterest" && !context.clientSecret)
    throw new BadRequestException(
      "Pinterest app secret is not configured on Railway",
    );
  if (context.manifest.slug === "tumblr" && !context.clientSecret)
    throw new BadRequestException(
      "Tumblr consumer secret is not configured on Railway",
    );
  if (context.manifest.slug === "mastodon" && !context.clientSecret)
    throw new BadRequestException(
      "Mastodon dynamic app registration did not return a client secret",
    );
  if (context.manifest.slug === "nationbuilder" && !context.clientSecret)
    throw new BadRequestException(
      "NationBuilder OAuth client secret is not configured on Railway",
    );
  if (
    context.manifest.auth.credentialSchema.some(
      (field) =>
        field.secret && field.required && field.name.endsWith("_CLIENT_SECRET"),
    ) &&
    !context.clientSecret
  ) {
    throw new BadRequestException(
      `${context.manifest.name} client secret is required`,
    );
  }
  return {
    ...context,
  };
}

async function runOAuthStartPhase3(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthStartPhase2>>,
) {
  const encryptedSecret =
    context.clientSecret &&
    ![
      "box",
      "signnow",
      "signrequest",
      "signeasy",
      "rightsignature",
      "adobe-acrobat-sign",
      "dropbox",
      "dropbox-paper",
      "pcloud",
      "sharefile",
      "deputy",
      "7shifts",
      "resource-guru",
      "timely-time-tracking",
      "rescuetime",
      "hubstaff",
      "zoho-workdrive",
      "zoho-people",
      "zoho-campaigns",
      "zoho-analytics",
      "inoreader",
      "guru",
      "vimeo",
      "wistia",
      "restream",
      "frame-io",
      "mural",
      "figjam",
      "figma",
      "canva",
      "webflow",
      "wordpress-com",
      "onedrive",
      "sharepoint",
      "microsoft-planner",
      "microsoft-to-do",
      "microsoft-lists",
      "lucidspark",
      "onenote",
      "microsoft-bookings",
      "microsoft-power-bi",
      "microsoft-dynamics-365-sales",
      "microsoft-dynamics-365-customer-service",
      "microsoft-dynamics-365-business-central",
      "microsoft-entra-id",
      "yammer",
      "viva-learning",
      "microsoft-dynamics-365",
      "microsoft-viva-engage",
      "zoom",
      "linkedin",
      "lucidchart",
      "mindmeister",
      "meistertask",
      "jane-app",
      "shopify",
      "sage-accounting",
      "freeagent",
      "salesforce",
      "hubspot",
      "zoho",
      "zoho-desk",
      "zoho-projects",
      "copper",
      "surveymonkey",
      "fillout",
      "mailchimp",
      "mailchimp-surveys",
      "klaviyo-sms",
      "klaviyo",
      "convertkit",
      "campaign-monitor",
      "constant-contact",
      "close",
      "zendesk",
      "intercom",
      "attio",
      "help-scout",
      "front",
      "teamwork",
      "basecamp",
      "wrike",
      "smartsheet",
      "todoist",
      "ticktick",
      "harvest",
      "calendly",
      "cal-com",
      "docusign",
      "dropbox-sign",
      "pandadoc",
      "typeform",
      "sendfox",
      "beehiiv",
      "hootsuite",
      "buffer",
      "optimizely",
    ].includes(context.manifest.slug)
      ? service.credentials.encrypt({ clientSecret: context.clientSecret })
      : null;
  const accessOptions = context.manifest.auth.oauth?.accessOptions ?? [];
  const requestedCapabilities = context.input.selectedCapabilities?.length
    ? context.input.selectedCapabilities
    : context.existing?.selectedCapabilities?.length
      ? context.existing.selectedCapabilities
      : context.manifest.capabilities
          .filter((capability) => capability.defaultEnabled)
          .map((capability) => capability.id);
  const sameValues = (left: string[], right: readonly string[]) =>
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value));
  const selectedAccessOption =
    accessOptions.find(
      (option) => option.id === context.input.accessOptionId?.trim(),
    ) ??
    accessOptions.find((option) =>
      sameValues(requestedCapabilities, option.capabilityIds),
    ) ??
    accessOptions.find((option) => option.defaultSelected);
  if (
    context.input.accessOptionId?.trim() &&
    selectedAccessOption?.id !== context.input.accessOptionId.trim()
  ) {
    throw new BadRequestException(
      `${context.manifest.name} OAuth access option is invalid`,
    );
  }
  if (
    selectedAccessOption &&
    context.input.selectedCapabilities?.length &&
    !sameValues(
      context.input.selectedCapabilities,
      selectedAccessOption.capabilityIds,
    )
  ) {
    throw new BadRequestException(
      `${context.manifest.name} OAuth access option does not match the selected capabilities`,
    );
  }
  const selectedCapabilities = selectedAccessOption
    ? [...selectedAccessOption.capabilityIds]
    : requestedCapabilities;
  let requiredScopes = selectedAccessOption
    ? [...selectedAccessOption.scopes]
    : (context.manifest.auth.oauth?.requiredScopes ?? []);
  const optionalScopes = service.normalizeOptionalScopes(
    context.input.optionalScopes ?? [],
    context.manifest.auth.oauth?.optionalScopes ?? [],
  );
  let scopes = [...requiredScopes, ...optionalScopes];
  const egnyteDomain =
    context.manifest.slug === "egnyte"
      ? service.normalizeEgnyteDomain(
          context.input.providerDomain ??
            service.stringOrNull(context.existing?.metadata?.egnyteDomain) ??
            "",
        )
      : null;
  const nationBuilderNationSlug =
    context.manifest.slug === "nationbuilder"
      ? service.normalizeNationBuilderNationSlug(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata?.nationBuilderNationSlug,
            ) ??
            "",
        )
      : null;
  const bynderPortalOrigin =
    context.manifest.slug === "bynder"
      ? service.normalizeBynderPortal(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata?.bynderPortalOrigin,
            ) ??
            "",
        )
      : null;
  const cantoAccountOrigin =
    context.manifest.slug === "canto"
      ? service.normalizeCantoAccount(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata?.cantoAccountOrigin,
            ) ??
            "",
        )
      : null;
  const dynamics365SalesEnvironmentOrigin =
    context.manifest.slug === "microsoft-dynamics-365-sales"
      ? service.microsoftDynamics365SalesApi.normalizeEnvironment(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata?.dynamics365SalesEnvironmentOrigin,
            ) ??
            "",
        )
      : null;
  const dynamics365CustomerServiceEnvironmentOrigin =
    context.manifest.slug === "microsoft-dynamics-365-customer-service"
      ? service.microsoftDynamics365CustomerServiceApi.normalizeEnvironment(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata
                ?.dynamics365CustomerServiceEnvironmentOrigin,
            ) ??
            "",
        )
      : null;
  const businessCentralEnvironmentName =
    context.manifest.slug === "microsoft-dynamics-365-business-central"
      ? service.microsoftDynamics365BusinessCentralApi.normalizeEnvironmentName(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata?.businessCentralEnvironmentName,
            ) ??
            "",
        )
      : null;
  const frontifyAccountOrigin =
    context.manifest.slug === "frontify"
      ? service.normalizeFrontifyAccount(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata?.frontifyAccountOrigin,
            ) ??
            "",
        )
      : null;
  const assetBankBaseUrl =
    context.manifest.slug === "asset-bank"
      ? service.normalizeAssetBankSite(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata?.assetBankBaseUrl,
            ) ??
            "",
        )
      : null;
  const sageAccountingSubscriptionKey =
    context.manifest.slug === "sage-accounting"
      ? service.normalizeSageAccountingSubscriptionKey(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existingCredentials?.sageAccountingSubscriptionKey,
            ) ??
            "",
        )
      : null;
  const myobCompanyFileToken =
    context.manifest.slug === "myob"
      ? service.normalizeMyobCompanyFileToken(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existingCredentials?.myobCompanyFileToken,
            ) ??
            "",
        )
      : null;
  const zohoBooksOrganizationId =
    context.manifest.slug === "zoho-books"
      ? (
          context.input.providerDomain ??
          service.stringOrNull(
            context.existing?.metadata?.zohoBooksOrganizationId,
          ) ??
          ""
        ).trim()
      : null;
  if (
    context.manifest.slug === "zoho-books" &&
    !/^[1-9][0-9]{0,19}$/.test(zohoBooksOrganizationId ?? "")
  )
    throw new BadRequestException(
      "Zoho Books organization ID must be a positive numeric identifier",
    );
  const zohoInvoiceOrganizationId =
    context.manifest.slug === "zoho-invoice"
      ? (
          context.input.providerDomain ??
          service.stringOrNull(
            context.existing?.metadata?.zohoInvoiceOrganizationId,
          ) ??
          ""
        ).trim()
      : null;
  if (
    context.manifest.slug === "zoho-invoice" &&
    !/^[1-9][0-9]{0,19}$/.test(zohoInvoiceOrganizationId ?? "")
  )
    throw new BadRequestException(
      "Zoho Invoice organization ID must be a positive numeric identifier",
    );
  const zohoExpenseOrganizationId =
    context.manifest.slug === "zoho-expense"
      ? (
          context.input.providerDomain ??
          service.stringOrNull(
            context.existing?.metadata?.zohoExpenseOrganizationId,
          ) ??
          ""
        ).trim()
      : null;
  if (
    context.manifest.slug === "zoho-expense" &&
    !/^[1-9][0-9]{0,19}$/.test(zohoExpenseOrganizationId ?? "")
  )
    throw new BadRequestException(
      "Zoho Expense organization ID must be a positive numeric identifier",
    );
  const zohoProjectsPortalId =
    context.manifest.slug === "zoho-projects"
      ? (
          context.input.providerDomain ??
          service.stringOrNull(
            context.existing?.metadata?.zohoProjectsPortalId,
          ) ??
          ""
        ).trim()
      : null;
  if (
    context.manifest.slug === "zoho-projects" &&
    !/^[1-9][0-9]{0,24}$/.test(zohoProjectsPortalId ?? "")
  )
    throw new BadRequestException(
      "Zoho Projects portal ID must be a positive numeric identifier",
    );
  const msProjectEnvironmentOrigin =
    context.manifest.slug === "ms-project"
      ? service.normalizeMsProjectEnvironment(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata?.msProjectEnvironmentOrigin,
            ) ??
            "",
        )
      : null;
  const sharePointSite =
    context.manifest.slug === "sharepoint"
      ? service.normalizeSharePointSite(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata?.sharepointSiteWebUrl,
            ) ??
            "",
        )
      : null;
  const microsoftListsBinding =
    context.manifest.slug === "microsoft-lists"
      ? service.normalizeMicrosoftListsBinding({
          siteId:
            context.input.selectedSiteId ??
            service.stringOrNull(context.existing?.metadata?.selectedSiteId),
          listId:
            context.input.selectedListId ??
            service.stringOrNull(context.existing?.metadata?.selectedListId),
          listWebUrl:
            context.input.selectedListWebUrl ??
            context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata?.selectedListWebUrl,
            ),
          listDisplayName:
            context.input.selectedListDisplayName ??
            service.stringOrNull(
              context.existing?.metadata?.selectedListDisplayName,
            ),
          allowedFieldNames:
            context.input.allowedFieldNames ??
            (Array.isArray(context.existing?.metadata?.allowedFieldNames)
              ? context.existing.metadata.allowedFieldNames
              : []),
        })
      : null;
  const microsoftBookingsBinding =
    context.manifest.slug === "microsoft-bookings"
      ? service.normalizeMicrosoftBookingsBinding({
          businessId:
            context.input.selectedBusinessId ??
            service.stringOrNull(
              context.existing?.metadata?.selectedBusinessId,
            ),
          displayName:
            context.input.selectedBusinessDisplayName ??
            service.stringOrNull(
              context.existing?.metadata?.selectedBusinessDisplayName,
            ),
        })
      : null;
  return {
    ...context,
    encryptedSecret,
    selectedAccessOption,
    selectedCapabilities,
    requiredScopes,
    optionalScopes,
    scopes,
    egnyteDomain,
    nationBuilderNationSlug,
    bynderPortalOrigin,
    cantoAccountOrigin,
    dynamics365SalesEnvironmentOrigin,
    dynamics365CustomerServiceEnvironmentOrigin,
    businessCentralEnvironmentName,
    frontifyAccountOrigin,
    assetBankBaseUrl,
    sageAccountingSubscriptionKey,
    myobCompanyFileToken,
    zohoBooksOrganizationId,
    zohoInvoiceOrganizationId,
    zohoExpenseOrganizationId,
    zohoProjectsPortalId,
    msProjectEnvironmentOrigin,
    sharePointSite,
    microsoftListsBinding,
    microsoftBookingsBinding,
  };
}

async function runOAuthStartPhase4(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthStartPhase3>>,
) {
  const microsoftPowerBIBinding =
    context.manifest.slug === "microsoft-power-bi"
      ? service.normalizeMicrosoftPowerBIBinding({
          workspaceId:
            context.input.selectedWorkspaceId ??
            service.stringOrNull(
              context.existing?.metadata?.selectedWorkspaceId,
            ),
          workspaceName:
            context.input.selectedWorkspaceName ??
            service.stringOrNull(
              context.existing?.metadata?.selectedWorkspaceName,
            ),
        })
      : null;
  const microsoftDynamics365Binding =
    context.manifest.slug === "microsoft-dynamics-365"
      ? service.normalizeMicrosoftDynamics365Binding({
          environmentOrigin:
            context.input.selectedEnvironmentOrigin ??
            context.input.providerDomain ??
            service.stringOrNull(context.existing?.metadata?.environmentOrigin),
          environmentDisplayName:
            context.input.selectedEnvironmentDisplayName ??
            service.stringOrNull(
              context.existing?.metadata?.environmentDisplayName,
            ),
        })
      : null;
  const microsoftVivaEngageBinding =
    context.manifest.slug === "microsoft-viva-engage"
      ? service.normalizeMicrosoftVivaEngageBinding({
          communityId:
            context.input.selectedCommunityId ??
            service.stringOrNull(
              context.existing?.metadata?.selectedCommunityId,
            ),
          communityName:
            context.input.selectedCommunityName ??
            service.stringOrNull(
              context.existing?.metadata?.selectedCommunityName,
            ),
        })
      : null;
  const janeClinicOrigin =
    context.manifest.slug === "jane-app"
      ? service.normalizeJaneClinicOrigin(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata?.janeClinicOrigin,
            ) ??
            service.stringOrNull(
              context.existingCredentials?.janeClinicOrigin,
            ) ??
            "",
        )
      : null;
  const shopifyShopDomain =
    context.manifest.slug === "shopify"
      ? service.normalizeShopifyDomain(
          context.input.providerDomain ??
            service.stringOrNull(context.existing?.metadata?.shopDomain) ??
            "",
        )
      : null;
  const zendeskInstanceOrigin =
    context.manifest.slug === "zendesk"
      ? service.normalizeZendeskInstance(
          context.input.providerDomain ??
            service.stringOrNull(
              context.existing?.metadata?.zendeskInstanceOrigin,
            ) ??
            "",
        )
      : null;
  const googleAdsCustomerId =
    context.manifest.slug === "google-ads"
      ? service.googleAdsCustomerId(
          context.input.customerId ?? context.existing?.metadata?.customerId,
          true,
        )
      : null;
  const googleAdsLoginCustomerId =
    context.manifest.slug === "google-ads"
      ? service.googleAdsCustomerId(
          context.input.loginCustomerId ??
            context.existing?.metadata?.loginCustomerId,
          false,
        )
      : null;
  const googleAnalyticsPropertyId =
    context.manifest.slug === "google-analytics"
      ? service.googleAnalyticsPropertyId(
          context.input.propertyId ??
            context.existing?.metadata?.selectedPropertyId,
        )
      : null;
  const googleSearchConsoleSiteUrl =
    context.manifest.slug === "google-search-console"
      ? service.googleSearchConsoleSiteUrl(
          context.input.siteUrl ?? context.existing?.metadata?.selectedSiteUrl,
        )
      : null;
  const googleBusinessProfileAccountName =
    context.manifest.slug === "google-business-profile"
      ? service.googleBusinessProfileAccountName(
          context.input.accountName ??
            context.existing?.metadata?.selectedAccountName,
        )
      : null;
  const googleBusinessProfileLocationName =
    context.manifest.slug === "google-business-profile"
      ? service.googleBusinessProfileLocationName(
          context.input.locationName ??
            context.existing?.metadata?.selectedLocationName,
        )
      : null;
  const googleMerchantCenterAccountName =
    context.manifest.slug === "google-merchant-center"
      ? service.googleMerchantCenterAccountName(
          context.input.accountName ??
            context.existing?.metadata?.selectedAccountName,
        )
      : null;
  if (context.msProjectEnvironmentOrigin) {
    context.requiredScopes = [
      "offline_access",
      `${context.msProjectEnvironmentOrigin}/user_impersonation`,
    ];
  }
  if (microsoftDynamics365Binding) {
    context.requiredScopes = [
      "offline_access",
      `${microsoftDynamics365Binding.environmentOrigin}/user_impersonation`,
    ];
    context.scopes = [...context.requiredScopes, ...context.optionalScopes];
  }
  if (microsoftVivaEngageBinding) {
    context.requiredScopes = [
      "offline_access",
      "https://www.yammer.com/.default",
    ];
    context.scopes = [...context.requiredScopes, ...context.optionalScopes];
  }
  if (context.dynamics365SalesEnvironmentOrigin) {
    context.requiredScopes = [
      "offline_access",
      `${context.dynamics365SalesEnvironmentOrigin}/user_impersonation`,
    ];
  }
  if (context.dynamics365CustomerServiceEnvironmentOrigin) {
    context.requiredScopes = [
      "offline_access",
      `${context.dynamics365CustomerServiceEnvironmentOrigin}/user_impersonation`,
    ];
  }
  context.scopes = [...context.requiredScopes, ...context.optionalScopes];

  const authority =
    context.manifest.slug === "mastodon"
      ? {
          mode: null,
          tenantId: null,
          authorizationUrl: `${context.mastodonRegistration!.origin}/oauth/authorize`,
          tokenUrl: `${context.mastodonRegistration!.origin}/oauth/token`,
        }
      : context.manifest.slug === "zendesk"
        ? service.zendeskAuthority(zendeskInstanceOrigin!)
        : context.manifest.slug === "shopify"
          ? service.shopifyAuthority(shopifyShopDomain!)
          : context.manifest.slug === "egnyte"
            ? service.egnyteAuthority(context.egnyteDomain!)
            : context.manifest.slug === "bynder"
              ? service.bynderAuthority(context.bynderPortalOrigin!)
              : context.manifest.slug === "canto"
                ? service.cantoAuthority(context.cantoAccountOrigin!)
                : context.manifest.slug === "frontify"
                  ? service.frontifyAuthority(context.frontifyAccountOrigin!)
                  : context.manifest.slug === "asset-bank"
                    ? service.assetBankAuthority(context.assetBankBaseUrl!)
                    : service.resolveOAuthAuthority(context.manifest.slug, {
                        mode: context.input.microsoftAuthorityMode,
                        tenantId: context.input.microsoftTenantId,
                        existingMetadata: context.existing?.metadata,
                      });
  const selectedAuthority =
    context.manifest.slug === "bamboohr"
      ? service.bambooHRAuthority(context.bambooHRCompanyDomain!)
      : authority;
  const state = randomBytes(32).toString("base64url");
  const codeVerifier =
    context.manifest.auth.oauth?.pkce === false
      ? ""
      : randomBytes(48).toString("base64url");
  const encryptedCodeVerifier = codeVerifier
    ? service.credentials.encrypt({ codeVerifier })
    : null;
  const expectedProfileLabel = context.input.expectedProfileLabel?.trim() ?? "";
  if (expectedProfileLabel.length > 120) {
    throw new BadRequestException(
      "Nextdoor expected profile label must be 120 characters or fewer",
    );
  }
  const providerNonce = ["line", "slite", "hubstaff"].includes(
    context.manifest.slug,
  )
    ? randomBytes(32).toString("base64url")
    : "";
  return {
    ...context,
    microsoftPowerBIBinding,
    microsoftDynamics365Binding,
    microsoftVivaEngageBinding,
    janeClinicOrigin,
    shopifyShopDomain,
    zendeskInstanceOrigin,
    googleAdsCustomerId,
    googleAdsLoginCustomerId,
    googleAnalyticsPropertyId,
    googleSearchConsoleSiteUrl,
    googleBusinessProfileAccountName,
    googleBusinessProfileLocationName,
    googleMerchantCenterAccountName,
    authority,
    selectedAuthority,
    state,
    codeVerifier,
    encryptedCodeVerifier,
    expectedProfileLabel,
    providerNonce,
  };
}

async function runOAuthStartPhase5(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthStartPhase4>>,
) {
  let encryptedProviderSession = [
    "mastodon",
    "nextdoor",
    "line",
    "slite",
    "egnyte",
    "nationbuilder",
    "bynder",
    "canto",
    "frontify",
    "asset-bank",
    "ms-project",
    "onedrive",
    "sharepoint",
    "microsoft-lists",
    "microsoft-bookings",
    "microsoft-power-bi",
    "microsoft-dynamics-365",
    "microsoft-viva-engage",
    "jane-app",
    "hubstaff",
    "shopify",
    "zendesk",
    "sage-accounting",
    "myob",
    "zoho-books",
    "zoho-invoice",
    "zoho-expense",
    "zoho-projects",
    "cloudflare",
    "vercel",
    "heroku",
    "digitalocean",
    "firebase",
    "supabase",
    "bamboohr",
    "greenhouse",
    "lever",
    "gmail",
    "google-calendar",
    "google-ads",
    "google-analytics",
    "google-search-console",
    "google-business-profile",
    "google-merchant-center",
  ].includes(context.manifest.slug)
    ? service.credentials.encrypt(
        context.manifest.slug === "mastodon"
          ? {
              mastodonInstanceOrigin: context.mastodonRegistration?.origin,
              mastodonInstanceDomain:
                context.mastodonRegistration?.instanceDomain,
              mastodonInstanceVersion:
                context.mastodonRegistration?.instanceVersion,
              mastodonMaxCharacters:
                context.mastodonRegistration?.maxCharacters,
            }
          : context.manifest.slug === "google-ads"
            ? {
                customerId: context.googleAdsCustomerId,
                loginCustomerId: context.googleAdsLoginCustomerId,
              }
            : context.manifest.slug === "google-analytics"
              ? { propertyId: context.googleAnalyticsPropertyId }
              : context.manifest.slug === "google-search-console"
                ? { siteUrl: context.googleSearchConsoleSiteUrl }
                : context.manifest.slug === "google-business-profile"
                  ? {
                      accountName: context.googleBusinessProfileAccountName,
                      locationName: context.googleBusinessProfileLocationName,
                    }
                  : context.manifest.slug === "google-merchant-center"
                    ? { accountName: context.googleMerchantCenterAccountName }
                    : context.manifest.slug === "google-calendar"
                      ? {
                          googleCalendarAccountEmail:
                            context.googleCalendarAccountEmail,
                          googleCalendarDefaultCalendarId:
                            context.googleCalendarDefaultCalendarId,
                        }
                      : context.manifest.slug === "gmail"
                        ? { gmailAccountEmail: context.gmailAccountEmail }
                        : context.manifest.slug === "lever"
                          ? { leverAccountId: context.leverAccountId }
                          : context.manifest.slug === "greenhouse"
                            ? {
                                greenhouseOrganizationId:
                                  context.greenhouseOrganizationId,
                              }
                            : context.manifest.slug === "bamboohr"
                              ? {
                                  bambooHRCompanyDomain:
                                    context.bambooHRCompanyDomain,
                                  bambooHRLocationId:
                                    context.bambooHRLocationId,
                                }
                              : context.manifest.slug === "supabase"
                                ? {
                                    supabaseOrganizationSlug:
                                      context.supabaseOrganizationSlug,
                                    supabaseProjectRef:
                                      context.supabaseProjectRef,
                                  }
                                : context.manifest.slug === "firebase"
                                  ? {
                                      firebaseProjectId:
                                        context.firebaseProjectId,
                                    }
                                  : context.manifest.slug === "digitalocean"
                                    ? {
                                        digitalOceanTeamId:
                                          context.digitalOceanTeamId,
                                        digitalOceanProjectId:
                                          context.digitalOceanProjectId,
                                        digitalOceanResourceUrn:
                                          context.digitalOceanResourceUrn,
                                      }
                                    : context.manifest.slug === "heroku"
                                      ? {
                                          herokuTeamId: context.herokuTeamId,
                                          herokuAppId: context.herokuAppId,
                                        }
                                      : context.manifest.slug === "vercel"
                                        ? {
                                            vercelProjectId:
                                              context.vercelProjectId,
                                          }
                                        : context.manifest.slug === "cloudflare"
                                          ? {
                                              cloudflareAccountId:
                                                context.cloudflareAccountId,
                                              cloudflareZoneId:
                                                context.cloudflareZoneId,
                                            }
                                          : context.manifest.slug ===
                                              "zoho-projects"
                                            ? {
                                                zohoProjectsPortalId:
                                                  context.zohoProjectsPortalId,
                                              }
                                            : context.manifest.slug ===
                                                "zoho-expense"
                                              ? {
                                                  zohoExpenseOrganizationId:
                                                    context.zohoExpenseOrganizationId,
                                                }
                                              : context.manifest.slug ===
                                                  "zoho-invoice"
                                                ? {
                                                    zohoInvoiceOrganizationId:
                                                      context.zohoInvoiceOrganizationId,
                                                  }
                                                : context.manifest.slug ===
                                                    "zoho-books"
                                                  ? {
                                                      zohoBooksOrganizationId:
                                                        context.zohoBooksOrganizationId,
                                                    }
                                                  : context.manifest.slug ===
                                                      "myob"
                                                    ? {
                                                        myobCompanyFileToken:
                                                          context.myobCompanyFileToken,
                                                        myobApiKey:
                                                          context.clientId,
                                                      }
                                                    : context.manifest.slug ===
                                                        "sage-accounting"
                                                      ? {
                                                          sageAccountingSubscriptionKey:
                                                            context.sageAccountingSubscriptionKey,
                                                        }
                                                      : context.manifest
                                                            .slug === "zendesk"
                                                        ? {
                                                            zendeskInstanceOrigin:
                                                              context.zendeskInstanceOrigin,
                                                          }
                                                        : context.manifest
                                                              .slug ===
                                                            "shopify"
                                                          ? {
                                                              shopDomain:
                                                                context.shopifyShopDomain,
                                                            }
                                                          : context.manifest
                                                                .slug ===
                                                              "egnyte"
                                                            ? {
                                                                egnyteDomain:
                                                                  context.egnyteDomain,
                                                              }
                                                            : context.manifest
                                                                  .slug ===
                                                                "nationbuilder"
                                                              ? {
                                                                  nationBuilderNationSlug:
                                                                    context.nationBuilderNationSlug,
                                                                }
                                                              : context.manifest
                                                                    .slug ===
                                                                  "bynder"
                                                                ? {
                                                                    bynderPortalOrigin:
                                                                      context.bynderPortalOrigin,
                                                                  }
                                                                : context
                                                                      .manifest
                                                                      .slug ===
                                                                    "canto"
                                                                  ? {
                                                                      cantoAccountOrigin:
                                                                        context.cantoAccountOrigin,
                                                                    }
                                                                  : context
                                                                        .manifest
                                                                        .slug ===
                                                                      "frontify"
                                                                    ? {
                                                                        frontifyAccountOrigin:
                                                                          context.frontifyAccountOrigin,
                                                                      }
                                                                    : context
                                                                          .manifest
                                                                          .slug ===
                                                                        "asset-bank"
                                                                      ? {
                                                                          assetBankBaseUrl:
                                                                            context.assetBankBaseUrl,
                                                                        }
                                                                      : context
                                                                            .manifest
                                                                            .slug ===
                                                                          "sharepoint"
                                                                        ? {
                                                                            sharepointSiteWebUrl:
                                                                              context
                                                                                .sharePointSite
                                                                                ?.webUrl,
                                                                            sharepointSiteHostname:
                                                                              context
                                                                                .sharePointSite
                                                                                ?.hostname,
                                                                            sharepointSiteRelativePath:
                                                                              context
                                                                                .sharePointSite
                                                                                ?.relativePath,
                                                                          }
                                                                        : context
                                                                              .manifest
                                                                              .slug ===
                                                                            "microsoft-lists"
                                                                          ? context.microsoftListsBinding
                                                                          : context
                                                                                .manifest
                                                                                .slug ===
                                                                              "microsoft-bookings"
                                                                            ? context.microsoftBookingsBinding
                                                                            : context
                                                                                  .manifest
                                                                                  .slug ===
                                                                                "microsoft-power-bi"
                                                                              ? context.microsoftPowerBIBinding
                                                                              : context
                                                                                    .manifest
                                                                                    .slug ===
                                                                                  "microsoft-dynamics-365"
                                                                                ? context.microsoftDynamics365Binding
                                                                                : context
                                                                                      .manifest
                                                                                      .slug ===
                                                                                    "microsoft-viva-engage"
                                                                                  ? context.microsoftVivaEngageBinding
                                                                                  : context
                                                                                        .manifest
                                                                                        .slug ===
                                                                                      "ms-project"
                                                                                    ? {
                                                                                        msProjectEnvironmentOrigin:
                                                                                          context.msProjectEnvironmentOrigin,
                                                                                      }
                                                                                    : context
                                                                                          .manifest
                                                                                          .slug ===
                                                                                        "jane-app"
                                                                                      ? {
                                                                                          janeClinicOrigin:
                                                                                            context.janeClinicOrigin,
                                                                                        }
                                                                                      : [
                                                                                            "line",
                                                                                            "slite",
                                                                                            "hubstaff",
                                                                                          ].includes(
                                                                                            context
                                                                                              .manifest
                                                                                              .slug,
                                                                                          )
                                                                                        ? {
                                                                                            nonce:
                                                                                              context.providerNonce,
                                                                                          }
                                                                                        : {
                                                                                            expectedProfileLabel:
                                                                                              context.expectedProfileLabel,
                                                                                          },
      )
    : null;
  if (context.manifest.slug === "microsoft-dynamics-365-sales") {
    encryptedProviderSession = service.credentials.encrypt({
      dynamics365SalesEnvironmentOrigin:
        context.dynamics365SalesEnvironmentOrigin,
    });
  } else if (
    context.manifest.slug === "microsoft-dynamics-365-customer-service"
  ) {
    encryptedProviderSession = service.credentials.encrypt({
      dynamics365CustomerServiceEnvironmentOrigin:
        context.dynamics365CustomerServiceEnvironmentOrigin,
    });
  } else if (
    context.manifest.slug === "microsoft-dynamics-365-business-central"
  ) {
    encryptedProviderSession = service.credentials.encrypt({
      businessCentralEnvironmentName: context.businessCentralEnvironmentName,
    });
  }
  const callbackUri = service.getCallbackUrl(context.manifest.slug);
  const redirectUri =
    context.manifest.slug === "egnyte"
      ? `${callbackUri}?state=${encodeURIComponent(context.state)}`
      : callbackUri;
  await service.cleanupOAuthStates(context.manifest.slug);
  await service.oauthStateRepo.save(
    service.oauthStateRepo.create({
      workspaceId: context.workspaceId,
      userId: context.userId,
      appSlug: context.manifest.slug,
      reauthorizeConnectionId: context.existing?.id ?? null,
      stateHash: service.hashState(context.state),
      legacyCodeVerifier: null,
      codeVerifierCiphertext: context.encryptedCodeVerifier?.ciphertext ?? null,
      codeVerifierIv: context.encryptedCodeVerifier?.iv ?? null,
      codeVerifierAuthTag: context.encryptedCodeVerifier?.authTag ?? null,
      codeVerifierKeyVersion: context.encryptedCodeVerifier?.keyVersion ?? null,
      providerSessionCiphertext: encryptedProviderSession?.ciphertext ?? null,
      providerSessionIv: encryptedProviderSession?.iv ?? null,
      providerSessionAuthTag: encryptedProviderSession?.authTag ?? null,
      providerSessionKeyVersion: encryptedProviderSession?.keyVersion ?? null,
      clientId: context.clientId,
      authorityMode: context.selectedAuthority.mode,
      authorityTenantId: context.selectedAuthority.tenantId,
      authorityAuthorizeUrl: context.selectedAuthority.authorizationUrl,
      authorityTokenUrl: context.selectedAuthority.tokenUrl,
      clientSecretCiphertext: context.encryptedSecret?.ciphertext ?? null,
      clientSecretIv: context.encryptedSecret?.iv ?? null,
      clientSecretAuthTag: context.encryptedSecret?.authTag ?? null,
      clientSecretKeyVersion: context.encryptedSecret?.keyVersion ?? null,
      scopes: context.scopes,
      selectedCapabilities: context.selectedCapabilities,
      displayName:
        context.input.displayName?.trim() ||
        context.existing?.displayName ||
        `${context.manifest.name} connection`,
      environment:
        context.input.environment?.trim() ||
        context.existing?.environment ||
        "default",
      redirectUri,
      returnTo: service.normalizeReturnTo(context.input.returnTo),
      expiresAt: new Date(
        Date.now() +
          ([
            "zoho",
            "zoho-desk",
            "zoho-mail",
            "zoho-workdrive",
            "zoho-books",
            "zoho-invoice",
            "zoho-expense",
            "zoho-projects",
            "zoho-people",
            "zoho-campaigns",
            "zoho-analytics",
          ].includes(context.manifest.slug)
            ? 2
            : 10) *
            60 *
            1000,
      ),
    }),
  );
  const url = new URL(context.selectedAuthority.authorizationUrl);
  url.searchParams.set(
    context.manifest.slug === "canto"
      ? "app_id"
      : context.manifest.slug === "audius"
        ? "api_key"
        : "client_id",
    context.clientId,
  );
  if (context.manifest.slug !== "stripe") {
    url.searchParams.set("response_type", "code");
  }
  if (context.manifest.slug === "bamboohr") {
    url.searchParams.set("request", "authorize");
  }
  if (context.manifest.slug === "lever") {
    url.searchParams.set("audience", "https://api.lever.co/v1/");
  }
  url.searchParams.set("redirect_uri", redirectUri);
  return {
    ...context,
    encryptedProviderSession,
    callbackUri,
    redirectUri,
    url,
  };
}

async function runOAuthStartPhase6(
  service: MarketplaceConnectorOAuthService,
  context: Awaited<ReturnType<typeof runOAuthStartPhase5>>,
) {
  if (
    context.scopes.length &&
    ![
      "ringcentral",
      "restream",
      "quip",
      "wistia",
      "pcloud",
      "nifty",
      "notion",
      "stripe",
      "intercom",
      "attio",
      "help-scout",
      "front",
      "teamwork",
      "basecamp",
      "supabase",
      "optimizely",
    ].includes(context.manifest.slug)
  ) {
    context.url.searchParams.set(
      "scope",
      context.scopes.join(
        context.manifest.slug === "frontify"
          ? "+"
          : context.manifest.slug === "campaign-monitor" ||
              context.manifest.slug === "twist" ||
              [
                "zoho",
                "zoho-desk",
                "zoho-mail",
                "zoho-workdrive",
                "zoho-books",
                "zoho-invoice",
                "zoho-expense",
                "zoho-projects",
                "zoho-people",
                "zoho-campaigns",
                "zoho-analytics",
              ].includes(context.manifest.slug)
            ? ","
            : context.manifest.slug === "linear"
              ? ","
              : context.manifest.slug === "todoist"
                ? ","
                : " ",
      ),
    );
  }
  if (context.manifest.slug === "pcloud" && context.scopes.length) {
    context.url.searchParams.set("permissions", context.scopes.join(","));
  }
  if (context.manifest.slug === "optimizely" && context.scopes.length) {
    context.url.searchParams.set("scopes", context.scopes.join(" "));
  }
  context.url.searchParams.set("state", context.state);
  if (context.manifest.slug === "campaign-monitor") {
    context.url.searchParams.set("type", "web_server");
  }
  if (context.manifest.slug === "audius") {
    context.url.searchParams.set("response_mode", "query");
    context.url.searchParams.set("display", "fullScreen");
  }
  if (context.manifest.slug === "contentful") {
    context.url.searchParams.set("response_type", "token");
  }
  if (context.manifest.slug === "7shifts") {
    context.url.searchParams.delete("response_type");
    context.url.searchParams.delete("redirect_uri");
    context.url.searchParams.delete("scope");
  }
  if (context.manifest.slug === "clickup") {
    context.url.searchParams.delete("response_type");
  }
  if (context.manifest.slug === "intercom") {
    context.url.searchParams.delete("response_type");
    context.url.searchParams.delete("scope");
  }
  if (context.manifest.slug === "help-scout") {
    context.url.searchParams.delete("response_type");
    context.url.searchParams.delete("redirect_uri");
    context.url.searchParams.delete("scope");
  }
  if (context.manifest.slug === "teamwork") {
    context.url.searchParams.delete("response_type");
    context.url.searchParams.delete("scope");
  }
  if (context.manifest.slug === "egnyte") {
    context.url.searchParams.delete("response_type");
    context.url.searchParams.delete("state");
    context.url.searchParams.set("mobile", "0");
  }
  if (context.manifest.slug === "vercel") {
    context.url.searchParams.delete("client_id");
    context.url.searchParams.delete("response_type");
    context.url.searchParams.delete("redirect_uri");
    context.url.searchParams.delete("scope");
  }
  if (context.manifest.slug === "quip" && context.clientSecret) {
    // Quip's documented authorization endpoint requires the customer-owned API-key secret.
    context.url.searchParams.set("client_secret", context.clientSecret);
  }
  if (
    [
      "zoho",
      "zoho-desk",
      "zoho-mail",
      "zoho-workdrive",
      "zoho-books",
      "zoho-invoice",
      "zoho-expense",
      "zoho-projects",
      "zoho-people",
      "zoho-campaigns",
      "zoho-analytics",
    ].includes(context.manifest.slug)
  ) {
    context.url.searchParams.set("access_type", "offline");
    context.url.searchParams.set("prompt", "consent");
  }
  if (context.manifest.slug === "firebase") {
    context.url.searchParams.set("access_type", "offline");
    context.url.searchParams.set("prompt", "consent");
  }
  if (context.manifest.slug === "gmail") {
    context.url.searchParams.set("access_type", "offline");
    context.url.searchParams.set("prompt", "consent");
  }
  if (context.manifest.slug === "google-calendar") {
    context.url.searchParams.set("access_type", "offline");
    context.url.searchParams.set("prompt", "consent");
  }
  if (RELAY_GOOGLE_OAUTH_SLUGS.has(context.manifest.slug)) {
    context.url.searchParams.set("access_type", "offline");
    context.url.searchParams.set("include_granted_scopes", "false");
    context.url.searchParams.set("prompt", "consent select_account");
  }
  if (context.manifest.slug === "supabase") {
    context.url.searchParams.set(
      "organization_slug",
      context.supabaseOrganizationSlug!,
    );
  }
  if (context.manifest.slug === "signeasy") {
    context.url.searchParams.set("audience", "https://api-ext.signeasy.com/");
  }
  if (context.manifest.slug === "myob") {
    context.url.searchParams.set("prompt", "consent");
  }
  if (context.manifest.slug === "jane-app") {
    context.url.searchParams.set("resource", context.janeClinicOrigin!);
    context.url.searchParams.set("prompt", "consent");
  }
  if (["dropbox", "dropbox-paper"].includes(context.manifest.slug)) {
    context.url.searchParams.set("token_access_type", "offline");
  }
  if (["line", "slite", "hubstaff"].includes(context.manifest.slug)) {
    context.url.searchParams.set("nonce", context.providerNonce);
  }
  if (
    [
      "slite",
      "otter-ai",
      "fireflies-ai",
      "bonsai",
      "fathom",
      "grain",
      "whimsical",
      "cognito-forms",
      "jotform",
      "craft",
      "xmind",
      "adobe-analytics",
      "cloudinary",
      "remember-the-milk",
    ].includes(context.manifest.slug)
  ) {
    context.url.searchParams.set(
      "resource",
      context.manifest.slug === "otter-ai"
        ? "https://mcp.otter.ai/"
        : context.manifest.slug === "fireflies-ai"
          ? "https://api.fireflies.ai/mcp"
          : context.manifest.slug === "bonsai"
            ? "https://mcp.hellobonsai.com"
            : context.manifest.slug === "fathom"
              ? "https://api.fathom.ai/mcp"
              : context.manifest.slug === "grain"
                ? "https://api.grain.com"
                : context.manifest.slug === "whimsical"
                  ? "https://mcp.whimsical.com"
                  : context.manifest.slug === "cognito-forms"
                    ? COGNITO_FORMS_MCP_RESOURCE
                    : context.manifest.slug === "jotform"
                      ? JOTFORM_MCP_RESOURCE
                      : context.manifest.slug === "craft"
                        ? CRAFT_MCP_RESOURCE
                        : context.manifest.slug === "xmind"
                          ? "https://app.xmind.com/api/mcp"
                          : context.manifest.slug === "adobe-analytics"
                            ? "https://aa-mcp.adobe.io/mcp"
                            : context.manifest.slug === "cloudinary"
                              ? "https://asset-management.mcp.cloudinary.com"
                              : context.manifest.slug === "remember-the-milk"
                                ? "https://www.rememberthemilk.com/mcp"
                                : "https://api.slite.com/mcp",
    );
  }
  if (
    [
      "confluence",
      "jira",
      "jira-service-management",
      "atlassian-compass",
    ].includes(context.manifest.slug)
  ) {
    context.url.searchParams.set("audience", "api.atlassian.com");
    context.url.searchParams.set("prompt", "consent");
    if (["jira", "jira-service-management"].includes(context.manifest.slug))
      context.url.searchParams.set(
        "use_resource_level_granular_scopes",
        "true",
      );
  }
  if (context.manifest.slug === "notion") {
    context.url.searchParams.set("owner", "user");
  }
  if (context.manifest.slug === "linear") {
    context.url.searchParams.set("actor", "user");
    context.url.searchParams.set("prompt", "consent");
  }
  if (context.manifest.auth.oauth?.pkce !== false) {
    context.url.searchParams.set(
      "code_challenge",
      service.base64UrlSha256(context.codeVerifier),
    );
    context.url.searchParams.set("code_challenge_method", "S256");
  }
  if (context.manifest.auth.oauth?.authority?.provider === "microsoft") {
    context.url.searchParams.set("response_mode", "query");
  }

  await service.auditLogService.record({
    actorType: "user",
    actorId: context.userId,
    workspaceId: context.workspaceId,
    eventType: `marketplace.${context.manifest.slug}.oauth.started`,
    resourceType: "marketplace_app",
    resourceId: context.manifest.slug,
    metadata: {
      scopes: context.scopes,
      accessOptionId: context.selectedAccessOption?.id ?? null,
      selectedCapabilities: context.selectedCapabilities,
      redirectUri: context.redirectUri,
      authorityMode: context.authority.mode,
    },
  });
  const authorizationUrl =
    context.manifest.slug === "github"
      ? service.githubInstallationUrl(context.state)
      : context.url.toString();
  return {
    authorizationUrl,
    callbackUrl: context.redirectUri,
    requiredScopes: context.requiredScopes,
    optionalScopes: context.optionalScopes,
    expiresAt: new Date(
      Date.now() + (context.manifest.slug === "zoho-mail" ? 2 : 10) * 60 * 1000,
    ).toISOString(),
  };
}

export async function runOAuthStartPhases(
  service: MarketplaceConnectorOAuthService,
  context: {
    workspaceId: string;
    userId: string;
    appSlug: string;
    input: Parameters<MarketplaceConnectorOAuthService["startOAuth"]>[3];
  },
) {
  const phase1 = await runOAuthStartPhase1(service, context);
  const phase2 = await runOAuthStartPhase2(service, phase1);
  const phase3 = await runOAuthStartPhase3(service, phase2);
  const phase4 = await runOAuthStartPhase4(service, phase3);
  const phase5 = await runOAuthStartPhase5(service, phase4);
  return runOAuthStartPhase6(service, phase5);
}
