import { MODULE_METADATA } from "@nestjs/common/constants";
import { MarketplaceModule } from "./marketplace.module";
import { JotformApiAdapter } from "./connectors/jotform/jotform-api.adapter";
import { FormstackApiAdapter } from "./connectors/formstack/formstack-api.adapter";
import { SurveyMonkeyApiAdapter } from "./connectors/surveymonkey/surveymonkey-api.adapter";
import { FilloutApiAdapter } from "./connectors/fillout/fillout-api.adapter";
import { TallyApiAdapter } from "./connectors/tally/tally-api.adapter";
import { MailchimpApiAdapter } from "./connectors/mailchimp/mailchimp-api.adapter";
import { KlaviyoApiAdapter } from "./connectors/klaviyo/klaviyo-api.adapter";
import { ConvertKitApiAdapter } from "./connectors/convertkit/convertkit-api.adapter";
import { CampaignMonitorApiAdapter } from "./connectors/campaign-monitor/campaign-monitor-api.adapter";
import { ConstantContactApiAdapter } from "./connectors/constant-contact/constant-contact-api.adapter";
import { ActiveCampaignApiAdapter } from "./connectors/activecampaign/activecampaign-api.adapter";
import { CustomerIoApiAdapter } from "./connectors/customer-io/customer-io-api.adapter";
import { BrazeApiAdapter } from "./connectors/braze/braze-api.adapter";
import { SegmentApiAdapter } from "./connectors/segment/segment-api.adapter";
import { MixpanelApiAdapter } from "./connectors/mixpanel/mixpanel-api.adapter";
import { AmplitudeApiAdapter } from "./connectors/amplitude/amplitude-api.adapter";
import { PendoApiAdapter } from "./connectors/pendo/pendo-api.adapter";
import { PostHogApiAdapter } from "./connectors/posthog/posthog-api.adapter";
import { SentryApiAdapter } from "./connectors/sentry/sentry-api.adapter";
import { LinkedInApiAdapter } from "./connectors/linkedin/linkedin-api.adapter";
import { Bitrix24ApiAdapter } from "./connectors/bitrix24/bitrix24-api.adapter";
import { AgileCrmApiAdapter } from "./connectors/agile-crm/agile-crm-api.adapter";
import { StreakApiAdapter } from "./connectors/streak/streak-api.adapter";
import { LessAnnoyingCrmApiAdapter } from "./connectors/less-annoying-crm/less-annoying-crm-api.adapter";
import { NutshellApiAdapter } from "./connectors/nutshell/nutshell-api.adapter";
import { TeamleaderApiAdapter } from "./connectors/teamleader/teamleader-api.adapter";
import { ScoroApiAdapter } from "./connectors/scoro/scoro-api.adapter";
import { OdooApiAdapter } from "./connectors/odoo/odoo-api.adapter";
import { NetSuiteApiAdapter } from "./connectors/netsuite/netsuite-api.adapter";
import { SageAccountingApiAdapter } from "./connectors/sage-accounting/sage-accounting-api.adapter";
import { SageIntacctApiAdapter } from "./connectors/sage-intacct/sage-intacct-api.adapter";
import { MyobApiAdapter } from "./connectors/myob/myob-api.adapter";
import { KashFlowSoapAdapter } from "./connectors/kashflow/kashflow-soap.adapter";
import { ZohoBooksApiAdapter } from "./connectors/zoho-books/zoho-books-api.adapter";
import { ZohoInvoiceApiAdapter } from "./connectors/zoho-invoice/zoho-invoice-api.adapter";
import { ZohoExpenseApiAdapter } from "./connectors/zoho-expense/zoho-expense-api.adapter";
import { ZohoDeskApiAdapter } from "./connectors/zoho-desk/zoho-desk-api.adapter";
import { ZohoProjectsApiAdapter } from "./connectors/zoho-projects/zoho-projects-api.adapter";

describe("MarketplaceModule", () => {
  it("registers every usable Batch 2 execution adapter", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      MarketplaceModule,
    ) as unknown[];
    const providerTokens = providers.map((provider) =>
      typeof provider === "object" && provider !== null && "provide" in provider
        ? (provider as { provide: unknown }).provide
        : provider,
    );

    expect(providerTokens).toEqual(
      expect.arrayContaining([
        JotformApiAdapter,
        FormstackApiAdapter,
        SurveyMonkeyApiAdapter,
        FilloutApiAdapter,
        TallyApiAdapter,
        MailchimpApiAdapter,
        KlaviyoApiAdapter,
        ConvertKitApiAdapter,
        CampaignMonitorApiAdapter,
        ConstantContactApiAdapter,
        ActiveCampaignApiAdapter,
        CustomerIoApiAdapter,
        BrazeApiAdapter,
        SegmentApiAdapter,
        MixpanelApiAdapter,
        AmplitudeApiAdapter,
        PendoApiAdapter,
        PostHogApiAdapter,
        SentryApiAdapter,
      ]),
    );
  });

  it("constructs the LinkedIn adapter through a factory instead of Nest function injection", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      MarketplaceModule,
    ) as unknown[];
    const provider = providers.find(
      (candidate) =>
        typeof candidate === "object" &&
        candidate !== null &&
        "provide" in candidate &&
        (candidate as { provide: unknown }).provide === LinkedInApiAdapter,
    ) as { useFactory?: () => unknown } | undefined;

    expect(provider?.useFactory?.()).toBeInstanceOf(LinkedInApiAdapter);
  });

  it("constructs Batch 15 adapters through factories instead of Nest function injection", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      MarketplaceModule,
    ) as unknown[];
    const adapterTypes = [
      Bitrix24ApiAdapter,
      AgileCrmApiAdapter,
      StreakApiAdapter,
      LessAnnoyingCrmApiAdapter,
      NutshellApiAdapter,
      TeamleaderApiAdapter,
      ScoroApiAdapter,
      OdooApiAdapter,
      NetSuiteApiAdapter,
      SageAccountingApiAdapter,
      SageIntacctApiAdapter,
      MyobApiAdapter,
      KashFlowSoapAdapter,
      ZohoBooksApiAdapter,
      ZohoInvoiceApiAdapter,
      ZohoExpenseApiAdapter,
      ZohoDeskApiAdapter,
      ZohoProjectsApiAdapter,
    ];

    for (const adapterType of adapterTypes) {
      const provider = providers.find(
        (candidate) =>
          typeof candidate === "object" &&
          candidate !== null &&
          "provide" in candidate &&
          (candidate as { provide: unknown }).provide === adapterType,
      ) as { useFactory?: () => unknown } | undefined;
      expect(provider?.useFactory?.()).toBeInstanceOf(adapterType);
    }
  });
});
