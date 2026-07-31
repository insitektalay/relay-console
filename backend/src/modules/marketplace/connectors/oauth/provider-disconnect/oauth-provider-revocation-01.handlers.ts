import type {
  OAuthProviderRevocationHandler,
  OAuthProviderRevocationHandlerMap,
} from "./oauth-provider-disconnect-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import { BadRequestException } from "@nestjs/common";
import { MastodonApiError } from "../../mastodon/mastodon-api.adapter";

const OAuthProviderRevocation001: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    const origin = this.stringOrNull(
      connection.metadata?.mastodonInstanceOrigin,
    );
    const clientId = this.stringOrNull(stored.clientId);
    const clientSecret = this.stringOrNull(stored.clientSecret);
    const accessToken = this.stringOrNull(stored.accessToken);
    if (!origin || !clientId || !clientSecret || !accessToken)
      throw new BadRequestException(
        "Mastodon disconnect requires its exact instance and encrypted OAuth bundle",
      );
    try {
      await this.mastodonApi.revoke(
        origin,
        clientId,
        clientSecret,
        accessToken,
      );
    } catch (error) {
      if (error instanceof MastodonApiError)
        throw new BadRequestException(error.message);
      throw error;
    }
  };

const OAuthProviderRevocation002: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.disableAircallIntegration(stored);
  };

const OAuthProviderRevocation003: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeAdobeAcrobatSignSession(stored, connection);
  };

const OAuthProviderRevocation004: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeSignRequestSession(stored);
  };

const OAuthProviderRevocation005: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeSigneasySession(stored);
  };

const OAuthProviderRevocation006: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeRightSignatureSession(stored);
  };

const OAuthProviderRevocation007: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeRingCentralSession(stored);
  };

const OAuthProviderRevocation008: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.deauthorizeDialpad(stored);
  };

const OAuthProviderRevocation009: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeLineSession(stored);
  };

const OAuthProviderRevocation010: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeSlackSession(stored);
  };

const OAuthProviderRevocation011: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeSmartsheetSession(stored, connection);
  };

const OAuthProviderRevocation012: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeTodoistSession(stored);
  };

const OAuthProviderRevocation013: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeGitHubSession(stored);
  };

const OAuthProviderRevocation014: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeGitLabSession(stored);
  };

const OAuthProviderRevocation015: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeLinearSession(stored);
  };

const OAuthProviderRevocation016: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeAsanaSession(stored);
  };

const OAuthProviderRevocation017: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeMondaySession(stored);
  };

const OAuthProviderRevocation018: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeClioManageSession(stored);
  };

const OAuthProviderRevocation019: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeClioGrowSession(stored);
  };

const OAuthProviderRevocation020: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    const apiKey = this.stringOrNull(stored.clientId);
    const token = this.stringOrNull(stored.accessToken);
    if (apiKey && token) await this.trelloApi.revoke({ apiKey, token });
  };

const OAuthProviderRevocation021: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeZohoMailSession(stored, connection);
  };

const OAuthProviderRevocation022: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeZohoCrmSession(stored, connection);
  };

const OAuthProviderRevocation023: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeZohoCrmSession(stored, connection);
  };

const OAuthProviderRevocation024: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeZohoCrmSession(stored, connection);
  };

const OAuthProviderRevocation025: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeZohoPeopleSession(stored, connection);
  };

const OAuthProviderRevocation026: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeZohoCampaignsSession(stored, connection);
  };

const OAuthProviderRevocation027: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeZohoAnalyticsSession(stored, connection);
  };

const OAuthProviderRevocation028: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeZohoWorkDriveSession(stored, connection);
  };

const OAuthProviderRevocation029: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeQuipSession(stored);
  };

const OAuthProviderRevocation030: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeVimeoSession(stored);
  };

const OAuthProviderRevocation031: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeFrameIoSession(stored);
  };

const OAuthProviderRevocation032: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeLucidSession(stored, connection);
  };

const OAuthProviderRevocation033: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeOtterAiSession(stored, connection);
  };

const OAuthProviderRevocation034: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeFirefliesAiSession(stored, connection);
  };

const OAuthProviderRevocation035: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeRememberTheMilkSession(stored, connection);
  };

const OAuthProviderRevocation036: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeSunsamaSession(stored, connection);
  };

const OAuthProviderRevocation037: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeWhimsicalSession(stored, connection);
  };

const OAuthProviderRevocation038: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeMindMeisterSession(stored);
  };

const OAuthProviderRevocation039: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeMeisterTaskSession(stored);
  };

const OAuthProviderRevocation040: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeDropboxPaperSession(stored);
  };

const OAuthProviderRevocation041: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeBoxSession(stored);
  };

const OAuthProviderRevocation042: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeMiroSession(stored);
  };

const OAuthProviderRevocation043: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeCanvaSession(stored);
  };

const OAuthProviderRevocation044: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeWebflowSession(stored);
  };

const OAuthProviderRevocation045: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokePCloudSession(stored, connection);
  };

const OAuthProviderRevocation046: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeProductboardSession(stored);
  };

const OAuthProviderRevocation047: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.disconnectAcuitySchedulingSession(stored);
  };

const OAuthProviderRevocation048: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeSquareAppointmentsSession(stored);
  };

const OAuthProviderRevocation049: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeJaneAppSession(stored);
  };

const OAuthProviderRevocation050: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeTimelyTimeTrackingSession(stored);
  };

const OAuthProviderRevocation051: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeXeroSession(stored, connection);
  };

const OAuthProviderRevocation052: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeQuickBooksSession(stored);
  };

const OAuthProviderRevocation053: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeFreshBooksSession(stored);
  };

const OAuthProviderRevocation054: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeWaveSession(stored);
  };

const OAuthProviderRevocation055: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeSalesforceSession(stored, connection);
  };

const OAuthProviderRevocation056: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeHubSpotSession(stored);
  };

const OAuthProviderRevocation057: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeCloseSession(stored);
  };

const OAuthProviderRevocation058: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeZendeskSession(stored, connection);
  };

const OAuthProviderRevocation059: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeIntercomSession(stored, connection);
  };

const OAuthProviderRevocation060: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeDocusignSession(stored);
  };

const OAuthProviderRevocation061: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeFilloutSession(stored);
  };

const OAuthProviderRevocation062: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, connection) {
    await this.revokeKlaviyoSession(stored, connection);
  };

const OAuthProviderRevocation063: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeDigitalOceanSession(stored);
  };

const OAuthProviderRevocation064: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeFirebaseSession(stored);
  };

const OAuthProviderRevocation065: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeSupabaseSession(stored);
  };

const OAuthProviderRevocation066: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeBeehiivSession(stored);
  };

const OAuthProviderRevocation067: OAuthProviderRevocationHandler =
  async function (this: MarketplaceConnectorOAuthService, stored, _connection) {
    await this.revokeRestreamSession(stored);
  };

export const OAuthProviderRevocationHandlers01: OAuthProviderRevocationHandlerMap =
  Object.freeze({
    mastodon: OAuthProviderRevocation001,
    aircall: OAuthProviderRevocation002,
    "adobe-acrobat-sign": OAuthProviderRevocation003,
    signrequest: OAuthProviderRevocation004,
    signeasy: OAuthProviderRevocation005,
    rightsignature: OAuthProviderRevocation006,
    ringcentral: OAuthProviderRevocation007,
    dialpad: OAuthProviderRevocation008,
    line: OAuthProviderRevocation009,
    slack: OAuthProviderRevocation010,
    smartsheet: OAuthProviderRevocation011,
    todoist: OAuthProviderRevocation012,
    github: OAuthProviderRevocation013,
    gitlab: OAuthProviderRevocation014,
    linear: OAuthProviderRevocation015,
    asana: OAuthProviderRevocation016,
    "monday-com": OAuthProviderRevocation017,
    "clio-manage": OAuthProviderRevocation018,
    "clio-grow": OAuthProviderRevocation019,
    trello: OAuthProviderRevocation020,
    "zoho-mail": OAuthProviderRevocation021,
    zoho: OAuthProviderRevocation022,
    "zoho-desk": OAuthProviderRevocation023,
    "zoho-projects": OAuthProviderRevocation024,
    "zoho-people": OAuthProviderRevocation025,
    "zoho-campaigns": OAuthProviderRevocation026,
    "zoho-analytics": OAuthProviderRevocation027,
    "zoho-workdrive": OAuthProviderRevocation028,
    quip: OAuthProviderRevocation029,
    vimeo: OAuthProviderRevocation030,
    "frame-io": OAuthProviderRevocation031,
    lucidspark: OAuthProviderRevocation032,
    lucidchart: OAuthProviderRevocation032,
    "otter-ai": OAuthProviderRevocation033,
    "fireflies-ai": OAuthProviderRevocation034,
    "remember-the-milk": OAuthProviderRevocation035,
    sunsama: OAuthProviderRevocation036,
    whimsical: OAuthProviderRevocation037,
    mindmeister: OAuthProviderRevocation038,
    meistertask: OAuthProviderRevocation039,
    dropbox: OAuthProviderRevocation040,
    "dropbox-paper": OAuthProviderRevocation040,
    box: OAuthProviderRevocation041,
    miro: OAuthProviderRevocation042,
    canva: OAuthProviderRevocation043,
    webflow: OAuthProviderRevocation044,
    pcloud: OAuthProviderRevocation045,
    productboard: OAuthProviderRevocation046,
    "acuity-scheduling": OAuthProviderRevocation047,
    "square-appointments": OAuthProviderRevocation048,
    "jane-app": OAuthProviderRevocation049,
    "timely-time-tracking": OAuthProviderRevocation050,
    xero: OAuthProviderRevocation051,
    quickbooks: OAuthProviderRevocation052,
    freshbooks: OAuthProviderRevocation053,
    wave: OAuthProviderRevocation054,
    salesforce: OAuthProviderRevocation055,
    hubspot: OAuthProviderRevocation056,
    close: OAuthProviderRevocation057,
    zendesk: OAuthProviderRevocation058,
    intercom: OAuthProviderRevocation059,
    docusign: OAuthProviderRevocation060,
    fillout: OAuthProviderRevocation061,
    klaviyo: OAuthProviderRevocation062,
    "klaviyo-sms": OAuthProviderRevocation062,
    digitalocean: OAuthProviderRevocation063,
    firebase: OAuthProviderRevocation064,
    gmail: OAuthProviderRevocation064,
    "google-calendar": OAuthProviderRevocation064,
    "google-vault": OAuthProviderRevocation064,
    "google-drive": OAuthProviderRevocation064,
    "google-docs": OAuthProviderRevocation064,
    "google-sheets": OAuthProviderRevocation064,
    "google-slides": OAuthProviderRevocation064,
    "google-forms": OAuthProviderRevocation064,
    "google-tasks": OAuthProviderRevocation064,
    "google-contacts": OAuthProviderRevocation064,
    "google-photos": OAuthProviderRevocation064,
    "google-meet": OAuthProviderRevocation064,
    "google-chat": OAuthProviderRevocation064,
    "google-ads": OAuthProviderRevocation064,
    "google-analytics": OAuthProviderRevocation064,
    "google-search-console": OAuthProviderRevocation064,
    "google-business-profile": OAuthProviderRevocation064,
    "google-merchant-center": OAuthProviderRevocation064,
    youtube: OAuthProviderRevocation064,
    "google-classroom": OAuthProviderRevocation064,
    supabase: OAuthProviderRevocation065,
    beehiiv: OAuthProviderRevocation066,
    restream: OAuthProviderRevocation067,
  });
