import { MarketplaceConnectionEntity } from "../../../entities";
import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { EncryptionService } from "../../security/encryption.service";
import { MarketplaceConnectorExecutionService } from "./connector-execution.service";
import { MarketplaceConnectorCredentialService } from "./connector-credential.service";
import { MarketplaceConnectorOAuthService } from "./connector-oauth.service";
import { MarketplaceConnectorRegistry } from "./connector-registry";
import { buildConnectorExecutionApprovalContext } from "./execution/connector-execution-approval-context";

jest.mock("../marketplace-release-policy", () => {
  const actual = jest.requireActual("../marketplace-release-policy");
  return {
    ...actual,
    assertMarketplaceReleaseConnectEligible: jest.fn(() => ({
      connectEligible: true,
      liveVerified: true,
    })),
  };
});
import {
  ONEDRIVE_CONNECTOR_MANIFEST,
  ONEDRIVE_SCOPES,
} from "./onedrive/onedrive.connector";
import {
  SHAREPOINT_CONNECTOR_MANIFEST,
  SHAREPOINT_SCOPES,
} from "./sharepoint/sharepoint.connector";
import {
  MICROSOFT_PLANNER_CONNECTOR_MANIFEST,
  MICROSOFT_PLANNER_SCOPES,
} from "./microsoft-planner/microsoft-planner.connector";
import {
  MICROSOFT_TO_DO_CONNECTOR_MANIFEST,
  MICROSOFT_TO_DO_SCOPES,
} from "./microsoft-to-do/microsoft-to-do.connector";
import {
  MICROSOFT_LISTS_CONNECTOR_MANIFEST,
  MICROSOFT_LISTS_SCOPES,
} from "./microsoft-lists/microsoft-lists.connector";
import {
  ONENOTE_CONNECTOR_MANIFEST,
  ONENOTE_SCOPES,
} from "./onenote/onenote.connector";
import {
  MICROSOFT_BOOKINGS_CONNECTOR_MANIFEST,
  MICROSOFT_BOOKINGS_SCOPES,
} from "./microsoft-bookings/microsoft-bookings.connector";
import {
  MICROSOFT_POWER_BI_CONNECTOR_MANIFEST,
  MICROSOFT_POWER_BI_SCOPES,
} from "./microsoft-power-bi/microsoft-power-bi.connector";
import {
  MICROSOFT_DYNAMICS_365_CONNECTOR_MANIFEST,
  MICROSOFT_DYNAMICS_365_SCOPES,
} from "./microsoft-dynamics-365/microsoft-dynamics-365.connector";
import {
  MICROSOFT_VIVA_ENGAGE_CONNECTOR_MANIFEST,
  MICROSOFT_VIVA_ENGAGE_SCOPES,
} from "./microsoft-viva-engage/microsoft-viva-engage.connector";
import { ZOOM_CONNECTOR_MANIFEST, ZOOM_SCOPES } from "./zoom/zoom.connector";
import {
  DISCORD_BOT_PERMISSIONS,
  DISCORD_CONNECTOR_MANIFEST,
} from "./discord/discord.connector";
import { MARKETPLACE_CATALOG } from "../catalog/marketplace-catalog";
import { RESOURCE_GURU_CONNECTOR_MANIFEST } from "./resource-guru/resource-guru.connector";
import { RUNN_CONNECTOR_MANIFEST } from "./runn/runn.connector";
import { EVERHOUR_CONNECTOR_MANIFEST } from "./everhour/everhour.connector";
import { TIMELY_TIME_TRACKING_CONNECTOR_MANIFEST } from "./timely-time-tracking/timely-time-tracking.connector";
import { RESCUETIME_CONNECTOR_MANIFEST } from "./rescuetime/rescuetime.connector";
import { TIME_DOCTOR_CONNECTOR_MANIFEST } from "./time-doctor/time-doctor.connector";
import { HUBSTAFF_CONNECTOR_MANIFEST } from "./hubstaff/hubstaff.connector";
import { QUICKBOOKS_TIME_CONNECTOR_MANIFEST } from "./quickbooks-time/quickbooks-time.connector";
import { REPLICON_CONNECTOR_MANIFEST } from "./replicon/replicon.connector";
import { ACTITIME_CONNECTOR_MANIFEST } from "./actitime/actitime.connector";
import { TRACKINGTIME_CONNECTOR_MANIFEST } from "./trackingtime/trackingtime.connector";
import { MY_HOURS_CONNECTOR_MANIFEST } from "./my-hours/my-hours.connector";
import { PAPERFORM_CONNECTOR_MANIFEST } from "./paperform/paperform.connector";
import { JOTFORM_CONNECTOR_MANIFEST } from "./jotform/jotform.connector";
import {
  JOTFORM_MCP_REGISTRATION_URL,
  JOTFORM_MCP_RESOURCE,
} from "./jotform/jotform-mcp.adapter";
import { FORMSTACK_CONNECTOR_MANIFEST } from "./formstack/formstack.connector";
import {
  SURVEYMONKEY_CONNECTOR_MANIFEST,
  SURVEYMONKEY_SCOPES,
} from "./surveymonkey/surveymonkey.connector";
import { FILLOUT_CONNECTOR_MANIFEST } from "./fillout/fillout.connector";
import { TALLY_CONNECTOR_MANIFEST } from "./tally/tally.connector";
import { MAILCHIMP_CONNECTOR_MANIFEST } from "./mailchimp/mailchimp.connector";
import { MAILCHIMP_SURVEYS_CONNECTOR_MANIFEST } from "./mailchimp-surveys/mailchimp-surveys.connector";
import {
  KLAVIYO_API_REVISION,
  KLAVIYO_CONNECTOR_MANIFEST,
  KLAVIYO_SCOPES,
} from "./klaviyo/klaviyo.connector";
import {
  CONVERTKIT_CONNECTOR_MANIFEST,
  CONVERTKIT_SCOPES,
} from "./convertkit/convertkit.connector";
import {
  CAMPAIGN_MONITOR_CONNECTOR_MANIFEST,
  CAMPAIGN_MONITOR_SCOPES,
} from "./campaign-monitor/campaign-monitor.connector";
import {
  CONSTANT_CONTACT_CONNECTOR_MANIFEST,
  CONSTANT_CONTACT_SCOPES,
} from "./constant-contact/constant-contact.connector";
import { ACTIVECAMPAIGN_CONNECTOR_MANIFEST } from "./activecampaign/activecampaign.connector";
import { CUSTOMER_IO_CONNECTOR_MANIFEST } from "./customer-io/customer-io.connector";
import {
  BRAZE_CONNECTOR_MANIFEST,
  BRAZE_PERMISSIONS,
} from "./braze/braze.connector";
import { SEGMENT_CONNECTOR_MANIFEST } from "./segment/segment.connector";
import { MIXPANEL_CONNECTOR_MANIFEST } from "./mixpanel/mixpanel.connector";
import { AMPLITUDE_CONNECTOR_MANIFEST } from "./amplitude/amplitude.connector";
import { PENDO_CONNECTOR_MANIFEST } from "./pendo/pendo.connector";
import {
  POSTHOG_CONNECTOR_MANIFEST,
  POSTHOG_SCOPES,
} from "./posthog/posthog.connector";
import {
  SENTRY_CONNECTOR_MANIFEST,
  SENTRY_SCOPES,
} from "./sentry/sentry.connector";
import { WUFOO_CONNECTOR_MANIFEST } from "./wufoo/wufoo.connector";
import { GRAVITY_FORMS_CONNECTOR_MANIFEST } from "./gravity-forms/gravity-forms.connector";
import { NINJA_FORMS_CONNECTOR_MANIFEST } from "./ninja-forms/ninja-forms.connector";
import { WPFORMS_CONNECTOR_MANIFEST } from "./wpforms/wpforms.connector";
import { ALCHEMER_CONNECTOR_MANIFEST } from "./alchemer/alchemer.connector";
import { QUALTRICS_CONNECTOR_MANIFEST } from "./qualtrics/qualtrics.connector";
import { ASKNICELY_CONNECTOR_MANIFEST } from "./asknicely/asknicely.connector";
import { DELIGHTED_CONNECTOR_MANIFEST } from "./delighted/delighted.connector";
import { REFINER_CONNECTOR_MANIFEST } from "./refiner/refiner.connector";
import { HOTJAR_CONNECTOR_MANIFEST } from "./hotjar/hotjar.connector";
import { USERTESTING_CONNECTOR_MANIFEST } from "./usertesting/usertesting.connector";
import { MAZE_CONNECTOR_MANIFEST } from "./maze/maze.connector";
import { LOOKBACK_CONNECTOR_MANIFEST } from "./lookback/lookback.connector";
import { USER_INTERVIEWS_CONNECTOR_MANIFEST } from "./user-interviews/user-interviews.connector";
import { RESPONDENT_CONNECTOR_MANIFEST } from "./respondent/respondent.connector";
import { DOVETAIL_CONNECTOR_MANIFEST } from "./dovetail/dovetail.connector";
import { SPRIG_CONNECTOR_MANIFEST } from "./sprig/sprig.connector";
import { AIRTABLE_FORMS_CONNECTOR_MANIFEST } from "./airtable-forms/airtable-forms.connector";
import { DOCUSIGN_CLM_CONNECTOR_MANIFEST } from "./docusign-clm/docusign-clm.connector";
import { REWARDFUL_CONNECTOR_MANIFEST } from "./rewardful/rewardful.connector";
import {
  FIRSTPROMOTER_CONNECTOR_MANIFEST,
  FIRSTPROMOTER_SCOPES,
} from "./firstpromoter/firstpromoter.connector";
import {
  APOLLO_IO_CONNECTOR_MANIFEST,
  APOLLO_IO_SCOPES,
} from "./apollo-io/apollo-io.connector";
import {
  OUTREACH_CONNECTOR_MANIFEST,
  OUTREACH_SCOPES,
} from "./outreach/outreach.connector";
import {
  SALESLOFT_CONNECTOR_MANIFEST,
  SALESLOFT_SCOPES,
} from "./salesloft/salesloft.connector";
import { GONG_CONNECTOR_MANIFEST, GONG_SCOPES } from "./gong/gong.connector";
import { CHORUS_AI_CONNECTOR_MANIFEST } from "./chorus-ai/chorus-ai.connector";
import { CLARI_CONNECTOR_MANIFEST } from "./clari/clari.connector";
import { PEOPLE_AI_CONNECTOR_MANIFEST } from "./people-ai/people-ai.connector";
import { COGNISM_CONNECTOR_MANIFEST } from "./cognism/cognism.connector";
import { ZOOMINFO_CONNECTOR_MANIFEST } from "./zoominfo/zoominfo.connector";
import { CLEARBIT_CONNECTOR_MANIFEST } from "./clearbit/clearbit.connector";
import { LEADFEEDER_CONNECTOR_MANIFEST } from "./leadfeeder/leadfeeder.connector";
import { UNBOUNCE_CONNECTOR_MANIFEST } from "./unbounce/unbounce.connector";
import { INSTAPAGE_CONNECTOR_MANIFEST } from "./instapage/instapage.connector";
import { OPTIMIZELY_CONNECTOR_MANIFEST } from "./optimizely/optimizely.connector";
import { VWO_CONNECTOR_MANIFEST } from "./vwo/vwo.connector";
import { AB_TASTY_CONNECTOR_MANIFEST } from "./ab-tasty/ab-tasty.connector";
import { FULLSTORY_CONNECTOR_MANIFEST } from "./fullstory/fullstory.connector";
import { MICROSOFT_DYNAMICS_365_SALES_CONNECTOR_MANIFEST } from "./microsoft-dynamics-365-sales/microsoft-dynamics-365-sales.connector";
import { MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_CONNECTOR_MANIFEST } from "./microsoft-dynamics-365-customer-service/microsoft-dynamics-365-customer-service.connector";
import { MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_CONNECTOR_MANIFEST } from "./microsoft-dynamics-365-business-central/microsoft-dynamics-365-business-central.connector";
import { MICROSOFT_ENTRA_ID_CONNECTOR_MANIFEST } from "./microsoft-entra-id/microsoft-entra-id.connector";
import { YAMMER_CONNECTOR_MANIFEST } from "./yammer/yammer.connector";
import { VIVA_LEARNING_CONNECTOR_MANIFEST } from "./viva-learning/viva-learning.connector";
import {
  ADOBE_ANALYTICS_CONNECTOR_MANIFEST,
  ADOBE_ANALYTICS_SCOPES,
} from "./adobe-analytics/adobe-analytics.connector";
import { ADOBE_MARKETO_ENGAGE_CONNECTOR_MANIFEST } from "./adobe-marketo-engage/adobe-marketo-engage.connector";
import { ADOBE_TARGET_CONNECTOR_MANIFEST } from "./adobe-target/adobe-target.connector";
import { OSANO_CONNECTOR_MANIFEST } from "./osano/osano.connector";
import { SECUREFRAME_CONNECTOR_MANIFEST } from "./secureframe/secureframe.connector";
import { VANTA_CONNECTOR_MANIFEST } from "./vanta/vanta.connector";
import { DRATA_CONNECTOR_MANIFEST } from "./drata/drata.connector";
import { SPRINTO_CONNECTOR_MANIFEST } from "./sprinto/sprinto.connector";
import { HYPERPROOF_CONNECTOR_MANIFEST } from "./hyperproof/hyperproof.connector";
import { WORKIVA_CONNECTOR_MANIFEST } from "./workiva/workiva.connector";
import { CARTA_CONNECTOR_MANIFEST } from "./carta/carta.connector";
import { SHAREWORKS_CONNECTOR_MANIFEST } from "./shareworks/shareworks.connector";
import { LEDGY_CONNECTOR_MANIFEST } from "./ledgy/ledgy.connector";
import {
  DataForSeoApiAdapter,
  DataForSeoApiError,
} from "./dataforseo/dataforseo-api.adapter";
import { DATAFORSEO_CONNECTOR_MANIFEST } from "./dataforseo/dataforseo.connector";
import { EXA_CONNECTOR_MANIFEST } from "./exa/exa.connector";
import { MAILGUN_CONNECTOR_MANIFEST } from "./mailgun/mailgun.connector";
import { SENDGRID_CONNECTOR_MANIFEST } from "./sendgrid/sendgrid.connector";
import { POSTMARK_CONNECTOR_MANIFEST } from "./postmark/postmark.connector";
import { RESEND_CONNECTOR_MANIFEST } from "./resend/resend.connector";
import { SPARKPOST_CONNECTOR_MANIFEST } from "./sparkpost/sparkpost.connector";
import { BREVO_CONNECTOR_MANIFEST } from "./brevo/brevo.connector";
import { SINCH_MAILJET_CONNECTOR_MANIFEST } from "./sinch-mailjet/sinch-mailjet.connector";
import { EVERNOTE_CONNECTOR_MANIFEST } from "./evernote/evernote.connector";
import { FUSEBASE_CONNECTOR_MANIFEST } from "./fusebase/fusebase.connector";
import { ATLASSIAN_ROVO_CONNECTOR_MANIFEST } from "./atlassian-rovo/atlassian-rovo.connector";
import { OPSGENIE_CLOUD_CONNECTOR_MANIFEST } from "./opsgenie-cloud/opsgenie-cloud.connector";
import { STATUSPAGE_CLOUD_CONNECTOR_MANIFEST } from "./statuspage-cloud/statuspage-cloud.connector";
import { MEM_CONNECTOR_MANIFEST } from "./mem/mem.connector";
import { INOREADER_CONNECTOR_MANIFEST } from "./inoreader/inoreader.connector";
import { GURU_CONNECTOR_MANIFEST } from "./guru/guru.connector";
import { SLITE_CONNECTOR_MANIFEST } from "./slite/slite.connector";
import { SLAB_CONNECTOR_MANIFEST } from "./slab/slab.connector";
import { HEALTHIE_CONNECTOR_MANIFEST } from "./healthie/healthie.connector";
import { CONFLUENCE_CONNECTOR_MANIFEST } from "./confluence/confluence.connector";
import {
  PRODUCTBOARD_CONNECTOR_MANIFEST,
  PRODUCTBOARD_REQUIRED_SCOPES,
} from "./productboard/productboard.connector";
import { AHA_CONNECTOR_MANIFEST } from "./aha/aha.connector";
import { ROADMUNK_CONNECTOR_MANIFEST } from "./roadmunk/roadmunk.connector";
import { SHORTCUT_CONNECTOR_MANIFEST } from "./shortcut/shortcut.connector";
import { HIVE_CONNECTOR_MANIFEST } from "./hive/hive.connector";
import {
  NIFTY_CONNECTOR_MANIFEST,
  NIFTY_REQUIRED_SCOPES,
} from "./nifty/nifty.connector";
import { PAYMO_CONNECTOR_MANIFEST } from "./paymo/paymo.connector";
import { PROOFHUB_CONNECTOR_MANIFEST } from "./proofhub/proofhub.connector";
import {
  MEISTERTASK_CONNECTOR_MANIFEST,
  MEISTERTASK_SCOPES,
} from "./meistertask/meistertask.connector";
import { NOZBE_CONNECTOR_MANIFEST } from "./nozbe/nozbe.connector";
import { HABITICA_CONNECTOR_MANIFEST } from "./habitica/habitica.connector";
import { AMAZING_MARVIN_CONNECTOR_MANIFEST } from "./amazing-marvin/amazing-marvin.connector";
import {
  AKIFLOW_CONNECTOR_MANIFEST,
  AKIFLOW_SCOPES,
} from "./akiflow/akiflow.connector";
import {
  SUNSAMA_CONNECTOR_MANIFEST,
  SUNSAMA_SCOPES,
} from "./sunsama/sunsama.connector";
import { MOTION_CONNECTOR_MANIFEST } from "./motion/motion.connector";
import { RECLAIM_AI_CONNECTOR_MANIFEST } from "./reclaim-ai/reclaim-ai.connector";
import { SAVVYCAL_CONNECTOR_MANIFEST } from "./savvycal/savvycal.connector";
import { YOUCANBOOKME_CONNECTOR_MANIFEST } from "./youcanbookme/youcanbookme.connector";
import {
  SQUARE_APPOINTMENTS_CONNECTOR_MANIFEST,
  SQUARE_APPOINTMENTS_SCOPES,
} from "./square-appointments/square-appointments.connector";
import {
  ANY_DO_CONNECTOR_MANIFEST,
  ANY_DO_SCOPES,
} from "./any-do/any-do.connector";
import {
  REMEMBER_THE_MILK_CONNECTOR_MANIFEST,
  REMEMBER_THE_MILK_SCOPES,
} from "./remember-the-milk/remember-the-milk.connector";
import { QUIP_CONNECTOR_MANIFEST } from "./quip/quip.connector";
import { NUCLINO_CONNECTOR_MANIFEST } from "./nuclino/nuclino.connector";
import { DOCUMENT360_CONNECTOR_MANIFEST } from "./document360/document360.connector";
import { ARCHBEE_CONNECTOR_MANIFEST } from "./archbee/archbee.connector";
import { TETTRA_CONNECTOR_MANIFEST } from "./tettra/tettra.connector";
import { KNOWLEDGEOWL_CONNECTOR_MANIFEST } from "./knowledgeowl/knowledgeowl.connector";
import { FRESHDESK_CONNECTOR_MANIFEST } from "./freshdesk/freshdesk.connector";
import { VIDYARD_CONNECTOR_MANIFEST } from "./vidyard/vidyard.connector";
import {
  VIMEO_CONNECTOR_MANIFEST,
  VIMEO_SCOPES,
} from "./vimeo/vimeo.connector";
import {
  WISTIA_CONNECTOR_MANIFEST,
  WISTIA_SCOPES,
} from "./wistia/wistia.connector";
import {
  FRAME_IO_CONNECTOR_MANIFEST,
  FRAME_IO_SCOPES,
} from "./frame-io/frame-io.connector";
import { DESCRIPT_CONNECTOR_MANIFEST } from "./descript/descript.connector";
import { REV_CONNECTOR_MANIFEST } from "./rev/rev.connector";
import { BUZZSPROUT_CONNECTOR_MANIFEST } from "./buzzsprout/buzzsprout.connector";
import { CAPTIVATE_FM_CONNECTOR_MANIFEST } from "./captivate-fm/captivate-fm.connector";
import { TRANSISTOR_FM_CONNECTOR_MANIFEST } from "./transistor-fm/transistor-fm.connector";
import { RIVERSIDE_FM_CONNECTOR_MANIFEST } from "./riverside-fm/riverside-fm.connector";
import {
  RESTREAM_CONNECTOR_MANIFEST,
  RESTREAM_SCOPES,
} from "./restream/restream.connector";
import { OTTER_AI_CONNECTOR_MANIFEST } from "./otter-ai/otter-ai.connector";
import { FIREFLIES_AI_CONNECTOR_MANIFEST } from "./fireflies-ai/fireflies-ai.connector";
import { FATHOM_CONNECTOR_MANIFEST } from "./fathom/fathom.connector";
import { TL_DV_CONNECTOR_MANIFEST } from "./tl-dv/tl-dv.connector";
import { GRAIN_CONNECTOR_MANIFEST } from "./grain/grain.connector";
import {
  WHIMSICAL_CONNECTOR_MANIFEST,
  WHIMSICAL_SCOPES,
} from "./whimsical/whimsical.connector";
import {
  COGNITO_FORMS_CONNECTOR_MANIFEST,
  COGNITO_FORMS_SCOPES,
} from "./cognito-forms/cognito-forms.connector";
import {
  COGNITO_FORMS_MCP_CLIENT_ID,
  COGNITO_FORMS_MCP_RESOURCE,
} from "./cognito-forms/cognito-forms-mcp.adapter";
import { DRAW_IO_CONNECTOR_MANIFEST } from "./draw-io/draw-io.connector";
import {
  MINDMEISTER_CONNECTOR_MANIFEST,
  MINDMEISTER_SCOPES,
} from "./mindmeister/mindmeister.connector";
import {
  XMIND_CONNECTOR_MANIFEST,
  XMIND_SCOPES,
} from "./xmind/xmind.connector";
import { PADLET_CONNECTOR_MANIFEST } from "./padlet/padlet.connector";
import {
  DROPBOX_PAPER_CONNECTOR_MANIFEST,
  DROPBOX_PAPER_SCOPES,
} from "./dropbox-paper/dropbox-paper.connector";
import {
  DROPBOX_CONNECTOR_MANIFEST,
  DROPBOX_SCOPES,
} from "./dropbox/dropbox.connector";
import { BOX_CONNECTOR_MANIFEST, BOX_SCOPES } from "./box/box.connector";
import {
  MURAL_CONNECTOR_MANIFEST,
  MURAL_SCOPES,
} from "./mural/mural.connector";
import {
  FIGJAM_CONNECTOR_MANIFEST,
  FIGJAM_SCOPES,
} from "./figjam/figjam.connector";
import {
  FIGMA_CONNECTOR_MANIFEST,
  FIGMA_SCOPES,
} from "./figma/figma.connector";
import { MIRO_CONNECTOR_MANIFEST, MIRO_SCOPES } from "./miro/miro.connector";
import {
  CANVA_CONNECTOR_MANIFEST,
  CANVA_SCOPES,
} from "./canva/canva.connector";
import {
  WEBFLOW_CONNECTOR_MANIFEST,
  WEBFLOW_SCOPES,
} from "./webflow/webflow.connector";
import {
  WORDPRESS_COM_CONNECTOR_MANIFEST,
  WORDPRESS_COM_SCOPES,
} from "./wordpress-com/wordpress-com.connector";
import { GHOST_CONNECTOR_MANIFEST } from "./ghost/ghost.connector";
import { CONTENTFUL_CONNECTOR_MANIFEST } from "./contentful/contentful.connector";
import { SANITY_CONNECTOR_MANIFEST } from "./sanity/sanity.connector";
import { STRAPI_CLOUD_CONNECTOR_MANIFEST } from "./strapi-cloud/strapi-cloud.connector";
import {
  SHOPIFY_CONNECTOR_MANIFEST,
  SHOPIFY_SCOPES,
} from "./shopify/shopify.connector";
import { WOOCOMMERCE_CONNECTOR_MANIFEST } from "./woocommerce/woocommerce.connector";
import {
  STRIPE_APP_PERMISSIONS,
  STRIPE_CONNECTOR_MANIFEST,
} from "./stripe/stripe.connector";
import { PAYPAL_CONNECTOR_MANIFEST } from "./paypal/paypal.connector";
import { KAJABI_COMMUNITIES_CONNECTOR_MANIFEST } from "./kajabi-communities/kajabi-communities.connector";
import { CIRCLE_CONNECTOR_MANIFEST } from "./circle/circle.connector";
import { MIGHTY_NETWORKS_CONNECTOR_MANIFEST } from "./mighty-networks/mighty-networks.connector";
import { DISCOURSE_CONNECTOR_MANIFEST } from "./discourse/discourse.connector";
import { VANILLA_FORUMS_CONNECTOR_MANIFEST } from "./vanilla-forums/vanilla-forums.connector";
import { BETTERMODE_CONNECTOR_MANIFEST } from "./bettermode/bettermode.connector";
import { HIGHER_LOGIC_CONNECTOR_MANIFEST } from "./higher-logic/higher-logic.connector";
import { HIVEBRITE_CONNECTOR_MANIFEST } from "./hivebrite/hivebrite.connector";
import { XERO_CONNECTOR_MANIFEST, XERO_SCOPES } from "./xero/xero.connector";
import {
  QUICKBOOKS_CONNECTOR_MANIFEST,
  QUICKBOOKS_SCOPES,
} from "./quickbooks/quickbooks.connector";
import {
  FRESHBOOKS_CONNECTOR_MANIFEST,
  FRESHBOOKS_SCOPES,
} from "./freshbooks/freshbooks.connector";
import { WAVE_CONNECTOR_MANIFEST, WAVE_SCOPES } from "./wave/wave.connector";
import {
  FREEAGENT_CONNECTOR_MANIFEST,
  FREEAGENT_SCOPES,
} from "./freeagent/freeagent.connector";
import {
  SALESFORCE_CONNECTOR_MANIFEST,
  SALESFORCE_SCOPES,
} from "./salesforce/salesforce.connector";
import {
  HUBSPOT_CONNECTOR_MANIFEST,
  HUBSPOT_SCOPES,
} from "./hubspot/hubspot.connector";
import {
  PIPEDRIVE_CONNECTOR_MANIFEST,
  PIPEDRIVE_SCOPES,
} from "./pipedrive/pipedrive.connector";
import { ZOHO_CONNECTOR_MANIFEST, ZOHO_SCOPES } from "./zoho/zoho.connector";
import {
  ZOHO_DESK_CONNECTOR_MANIFEST,
  ZOHO_DESK_SCOPES,
} from "./zoho-desk/zoho-desk.connector";
import {
  ZOHO_PROJECTS_CONNECTOR_MANIFEST,
  ZOHO_PROJECTS_SCOPES,
} from "./zoho-projects/zoho-projects.connector";
import { CLAY_CONNECTOR_MANIFEST } from "./clay/clay.connector";
import { CLAYGENT_CONNECTOR_MANIFEST } from "./claygent/claygent.connector";
import { PHANTOMBUSTER_CONNECTOR_MANIFEST } from "./phantombuster/phantombuster.connector";
import { TEXAU_CONNECTOR_MANIFEST } from "./texau/texau.connector";
import { EVABOOT_CONNECTOR_MANIFEST } from "./evaboot/evaboot.connector";
import { LEMLIST_CONNECTOR_MANIFEST } from "./lemlist/lemlist.connector";
import { MAILSHAKE_CONNECTOR_MANIFEST } from "./mailshake/mailshake.connector";
import { WOODPECKER_CONNECTOR_MANIFEST } from "./woodpecker/woodpecker.connector";
import { REPLY_IO_CONNECTOR_MANIFEST } from "./reply-io/reply-io.connector";
import { MIXMAX_CONNECTOR_MANIFEST } from "./mixmax/mixmax.connector";
import { CIRRUS_INSIGHT_CONNECTOR_MANIFEST } from "./cirrus-insight/cirrus-insight.connector";
import { SPOTIO_CONNECTOR_MANIFEST } from "./spotio/spotio.connector";
import {
  COPPER_CONNECTOR_MANIFEST,
  COPPER_SCOPES,
} from "./copper/copper.connector";
import {
  CLOSE_CONNECTOR_MANIFEST,
  CLOSE_SCOPES,
} from "./close/close.connector";
import {
  ZENDESK_CONNECTOR_MANIFEST,
  ZENDESK_SCOPES,
} from "./zendesk/zendesk.connector";
import {
  INTERCOM_CONNECTOR_MANIFEST,
  INTERCOM_SCOPES,
} from "./intercom/intercom.connector";
import {
  LUCIDSPARK_CONNECTOR_MANIFEST,
  LUCIDSPARK_SCOPES,
} from "./lucidspark/lucidspark.connector";
import {
  LUCIDCHART_CONNECTOR_MANIFEST,
  LUCIDCHART_SCOPES,
} from "./lucidchart/lucidchart.connector";
import { SCRIBE_CONNECTOR_MANIFEST } from "./scribe/scribe.connector";
import { ExaApiAdapter, ExaApiError } from "./exa/exa-api.adapter";
import {
  LINKEDIN_CONNECTOR_MANIFEST,
  LINKEDIN_SCOPES,
} from "./linkedin/linkedin.connector";
import { OUTLOOK_CONNECTOR_MANIFEST } from "./outlook/outlook.connector";
import { MICROSOFT_TEAMS_CONNECTOR_MANIFEST } from "./microsoft-teams/microsoft-teams.connector";
import {
  NEXTDOOR_CONNECTOR_MANIFEST,
  NEXTDOOR_SCOPES,
} from "./nextdoor/nextdoor.connector";
import {
  NextdoorApiAdapter,
  NextdoorApiError,
} from "./nextdoor/nextdoor-api.adapter";
import { MEETUP_CONNECTOR_MANIFEST } from "./meetup/meetup.connector";
import { MeetupApiAdapter, MeetupApiError } from "./meetup/meetup-api.adapter";
import { EVENTBRITE_CONNECTOR_MANIFEST } from "./eventbrite/eventbrite.connector";
import {
  EventbriteApiAdapter,
  EventbriteApiError,
} from "./eventbrite/eventbrite-api.adapter";
import { LUMA_CONNECTOR_MANIFEST } from "./luma/luma.connector";
import { LumaApiAdapter, LumaApiError } from "./luma/luma-api.adapter";
import { HOPIN_CONNECTOR_MANIFEST } from "./hopin/hopin.connector";
import { HopinApiAdapter, HopinApiError } from "./hopin/hopin-api.adapter";
import {
  TWIST_CONNECTOR_MANIFEST,
  TWIST_REQUIRED_SCOPES,
} from "./twist/twist.connector";
import { TwistApiAdapter, TwistApiError } from "./twist/twist-api.adapter";
import {
  ZOHO_MAIL_CONNECTOR_MANIFEST,
  ZOHO_MAIL_REQUIRED_SCOPES,
} from "./zoho-mail/zoho-mail.connector";
import { ZOHO_WORKDRIVE_CONNECTOR_MANIFEST } from "./zoho-workdrive/zoho-workdrive.connector";
import {
  ZOHO_WORKDRIVE_ADMIN_OPERATION_IDS,
  ZOHO_WORKDRIVE_CONTENT_WRITE_OPERATION_IDS,
  ZOHO_WORKDRIVE_OPERATIONS,
  ZOHO_WORKDRIVE_READ_OPERATION_IDS,
  ZOHO_WORKDRIVE_REQUIRED_SCOPES,
} from "./zoho-workdrive/zoho-workdrive-operation-registry";
import {
  ZohoMailApiAdapter,
  ZohoMailApiError,
} from "./zoho-mail/zoho-mail-api.adapter";
import {
  WEBEX_CONNECTOR_MANIFEST,
  WEBEX_SCOPES,
} from "./webex/webex.connector";
import { WebexApiAdapter, WebexApiError } from "./webex/webex-api.adapter";
import { GOTO_MEETING_CONNECTOR_MANIFEST } from "./goto-meeting/goto-meeting.connector";
import {
  GoToMeetingApiAdapter,
  GoToMeetingApiError,
} from "./goto-meeting/goto-meeting-api.adapter";
import {
  RINGCENTRAL_CONNECTOR_MANIFEST,
  RINGCENTRAL_PERMISSIONS,
} from "./ringcentral/ringcentral.connector";
import {
  RingCentralApiAdapter,
  RingCentralApiError,
} from "./ringcentral/ringcentral-api.adapter";
import {
  DIALPAD_CONNECTOR_MANIFEST,
  DIALPAD_SCOPES,
} from "./dialpad/dialpad.connector";
import {
  DialpadApiAdapter,
  DialpadApiError,
} from "./dialpad/dialpad-api.adapter";
import {
  AIRCALL_CONNECTOR_MANIFEST,
  AIRCALL_SCOPES,
} from "./aircall/aircall.connector";
import {
  AircallApiAdapter,
  AircallApiError,
} from "./aircall/aircall-api.adapter";
import { OPENPHONE_CONNECTOR_MANIFEST } from "./openphone/openphone.connector";
import {
  OpenPhoneApiAdapter,
  OpenPhoneApiError,
} from "./openphone/openphone-api.adapter";
import { TWILIO_CONNECTOR_MANIFEST } from "./twilio/twilio.connector";
import { TwilioApiAdapter, TwilioApiError } from "./twilio/twilio-api.adapter";
import { VONAGE_CONNECTOR_MANIFEST } from "./vonage/vonage.connector";
import { VonageApiAdapter, VonageApiError } from "./vonage/vonage-api.adapter";
import { MESSAGEBIRD_CONNECTOR_MANIFEST } from "./messagebird/messagebird.connector";
import {
  MessageBirdApiAdapter,
  MessageBirdApiError,
} from "./messagebird/messagebird-api.adapter";
import { FRED_CONNECTOR_MANIFEST } from "./fred/fred.connector";
import { FredApiAdapter, FredApiError } from "./fred/fred-api.adapter";
import { APOLLO_GRAPHQL_STUDIO_CONNECTOR_MANIFEST } from "./apollo-graphql-studio/apollo-graphql-studio.connector";
import {
  ApolloGraphOsApiAdapter,
  ApolloGraphOsApiError,
} from "./apollo-graphql-studio/apollo-graphos-api.adapter";
import { HUNTER_IO_CONNECTOR_MANIFEST } from "./hunter-io/hunter-io.connector";
import {
  HunterApiAdapter,
  HunterApiError,
} from "./hunter-io/hunter-api.adapter";
import { SNOV_IO_CONNECTOR_MANIFEST } from "./snov-io/snov-io.connector";
import { SnovApiAdapter, SnovApiError } from "./snov-io/snov-api.adapter";
import { LUSHA_CONNECTOR_MANIFEST } from "./lusha/lusha.connector";
import { LushaApiAdapter, LushaApiError } from "./lusha/lusha-api.adapter";
import { LEADIQ_CONNECTOR_MANIFEST } from "./leadiq/leadiq.connector";
import { LeadIqApiAdapter, LeadIqApiError } from "./leadiq/leadiq-api.adapter";
import { SEAMLESS_AI_CONNECTOR_MANIFEST } from "./seamless-ai/seamless-ai.connector";
import {
  SeamlessAiApiAdapter,
  SeamlessAiApiError,
} from "./seamless-ai/seamless-ai-api.adapter";
import { ROCKETREACH_CONNECTOR_MANIFEST } from "./rocketreach/rocketreach.connector";
import {
  RocketReachApiAdapter,
  RocketReachApiError,
} from "./rocketreach/rocketreach-api.adapter";
import { UPLEAD_CONNECTOR_MANIFEST } from "./uplead/uplead.connector";
import { UpLeadApiAdapter, UpLeadApiError } from "./uplead/uplead-api.adapter";
import { WIZA_CONNECTOR_MANIFEST } from "./wiza/wiza.connector";
import { WizaApiAdapter, WizaApiError } from "./wiza/wiza-api.adapter";
import { LINE_CONNECTOR_MANIFEST, LINE_SCOPES } from "./line/line.connector";
import {
  OutlookGraphAdapter,
  OutlookGraphError,
} from "./outlook/outlook-graph.adapter";

function repo<T>(overrides: Partial<Record<keyof any, jest.Mock>> = {}) {
  const mockRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    delete: jest.fn(async () => ({ affected: 0 })),
    createQueryBuilder: jest.fn(),
    ...overrides,
  } as any;
  if (!("find" in overrides)) {
    mockRepo.find.mockImplementation(async (...args: unknown[]) => {
      const result = await mockRepo.findOne(...args);
      return result ? [result] : [];
    });
  }
  return mockRepo;
}

function outlookConnection(input: Partial<MarketplaceConnectionEntity> = {}) {
  return {
    id: "conn_outlook",
    workspaceId: "workspace_1",
    appSlug: "outlook",
    displayName: "Outlook",
    environment: "default",
    authType: "oauth2_pkce_user",
    executionAuthority: "railway",
    credentialNames: [],
    selectedCapabilities: [
      "mail_folders_list",
      "inbox_messages_list",
      "unread_messages_list",
      "message_get",
    ],
    status: "ready",
    metadata: {
      primaryMailboxAddress: "owner@example.com",
      displayName: "Owner",
      grantedScopes: ["offline_access", "Mail.Read"],
    },
    ...input,
  } as MarketplaceConnectionEntity;
}

function microsoftTeamsConnection(
  input: Partial<MarketplaceConnectionEntity> = {},
) {
  return {
    id: "conn_microsoft_teams",
    workspaceId: "workspace_1",
    appSlug: "microsoft-teams",
    displayName: "Microsoft Teams",
    environment: "default",
    authType: "oauth2_pkce_user",
    credentialNames: [],
    selectedCapabilities: [
      "joined_teams_list",
      "team_get",
      "channels_list",
      "channel_get",
    ],
    status: "ready",
    metadata: {
      grantedScopes: [
        "Team.ReadBasic.All",
        "Channel.ReadBasic.All",
        "offline_access",
      ],
      delegatedOnly: true,
      workSchoolOnly: true,
    },
    ...input,
  } as MarketplaceConnectionEntity;
}

function exaConnection(input: Partial<MarketplaceConnectionEntity> = {}) {
  return {
    id: "conn_exa",
    workspaceId: "workspace_1",
    appSlug: "exa-search",
    displayName: "Exa",
    environment: "default",
    authType: "api_key",
    executionAuthority: "railway",
    credentialNames: ["EXA_API_KEY"],
    selectedCapabilities: [
      "search",
      "contents",
      "similar",
      "answer",
      "research",
    ],
    status: "ready",
    metadata: {
      provider: "exa-search",
      keyStatus: "stored",
      enabledCapabilities: [
        "search",
        "contents",
        "similar",
        "answer",
        "research",
      ],
    },
    ...input,
  } as MarketplaceConnectionEntity;
}

function dataforseoConnection(
  input: Partial<MarketplaceConnectionEntity> = {},
) {
  return {
    id: "conn_dataforseo",
    workspaceId: "workspace_1",
    appSlug: "dataforseo",
    displayName: "DataForSEO",
    environment: "default",
    authType: "api_key",
    executionAuthority: "railway",
    credentialNames: ["DATAFORSEO_API_LOGIN", "DATAFORSEO_API_PASSWORD"],
    selectedCapabilities: [
      "serp_search",
      "rank_verification",
      "backlink_summary",
      "backlink_lookup",
      "backlink_verification",
      "page_inspection",
    ],
    status: "ready",
    metadata: {
      provider: "dataforseo",
      keyStatus: "stored",
      enabledCapabilities: [
        "serp_search",
        "rank_verification",
        "backlink_summary",
        "backlink_lookup",
        "backlink_verification",
        "page_inspection",
      ],
    },
    ...input,
  } as MarketplaceConnectionEntity;
}

function linkedInConnection(input: Partial<MarketplaceConnectionEntity> = {}) {
  return {
    id: "conn_linkedin",
    workspaceId: "workspace_1",
    appSlug: "linkedin",
    displayName: "LinkedIn",
    environment: "default",
    authType: "oauth2_authorization_code",
    executionAuthority: "railway",
    credentialNames: ["LINKEDIN_OAUTH_TOKEN_BUNDLE", "LINKEDIN_CLIENT_SECRET"],
    selectedCapabilities: ["identity", "draft", "publish"],
    status: "ready",
    metadata: {
      provider: "linkedin",
      tokenStatus: "valid",
      memberId: "abc123",
      memberUrn: "urn:li:person:abc123",
      displayName: "Ada Lovelace",
      grantedScopes: LINKEDIN_SCOPES,
    },
    ...input,
  } as MarketplaceConnectionEntity;
}

function oauthService(config: Record<string, string | undefined> = {}) {
  return new MarketplaceConnectorOAuthService(
    new MarketplaceConnectorRegistry(),
    {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      decryptEncrypted: jest.fn(),
      applyEncrypted: jest.fn(),
    } as any,
    { record: jest.fn() } as any,
    { resolveToolRequestsFromConnection: jest.fn() } as any,
    { get: jest.fn((key: string) => config[key]) } as any,
    { getMe: jest.fn() } as any,
    repo(),
    repo(),
  ) as any;
}

function connectorOAuthHarness(
  config: Record<string, string | undefined> = {},
) {
  const configService = {
    get: jest.fn((key: string) => {
      if (Object.prototype.hasOwnProperty.call(config, key)) return config[key];
      if (key === "APP_ENCRYPTION_KEY")
        return "1234567890123456789012345678901!";
      if (key === "CLAWCHAT_RAILWAY_ORIGIN") {
        return "https://clawchat-production-f92c.up.railway.app";
      }
      if (key === "PUBLIC_API_ORIGIN") return "https://api.relayconsole.work";
      if (key === "CLAWCHAT_WEB_ORIGIN") return "https://clawchat.team";
      return undefined;
    }),
  };
  const encryptionService = new EncryptionService(configService as any);
  const credentials = new MarketplaceConnectorCredentialService(
    encryptionService,
  );
  const auditLogService = { record: jest.fn(async () => null) };
  const toolRequestService = {
    resolveToolRequestsFromConnection: jest.fn(async () => null),
  };
  const outlookGraph = { getMe: jest.fn() };
  const connectionRepo = repo({
    save: jest.fn(async (value) => ({
      id: value.id ?? "conn_outlook",
      createdAt: value.createdAt ?? new Date("2026-05-13T10:00:00.000Z"),
      updatedAt: value.updatedAt ?? new Date("2026-05-13T10:00:00.000Z"),
      ...value,
    })),
  });
  const oauthStateRepo = repo();
  const service = new MarketplaceConnectorOAuthService(
    new MarketplaceConnectorRegistry(),
    credentials,
    auditLogService as any,
    toolRequestService as any,
    configService as any,
    outlookGraph as any,
    connectionRepo,
    oauthStateRepo,
  ) as any;
  return {
    service,
    credentials,
    auditLogService,
    toolRequestService,
    outlookGraph,
    connectionRepo,
    oauthStateRepo,
  };
}

function encryptedConnectorVerifierFields(
  credentials: MarketplaceConnectorCredentialService,
  codeVerifier: string,
) {
  const encrypted = credentials.encrypt({ codeVerifier });
  return {
    legacyCodeVerifier: null,
    codeVerifierCiphertext: encrypted.ciphertext,
    codeVerifierIv: encrypted.iv,
    codeVerifierAuthTag: encrypted.authTag,
    codeVerifierKeyVersion: encrypted.keyVersion,
  };
}

const MARKETPLACE_BETA_ENV_KEYS = [
  "CLAWCHAT_MARKETPLACE_BETA_MODE",
  "CLAWCHAT_MARKETPLACE_ALLOWED_APPS",
  "CLAWCHAT_MARKETPLACE_BLOCKED_APPS",
] as const;

function captureMarketplaceBetaEnv() {
  return Object.fromEntries(
    MARKETPLACE_BETA_ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as Record<(typeof MARKETPLACE_BETA_ENV_KEYS)[number], string | undefined>;
}

function restoreMarketplaceBetaEnv(
  original: Record<
    (typeof MARKETPLACE_BETA_ENV_KEYS)[number],
    string | undefined
  >,
) {
  for (const key of MARKETPLACE_BETA_ENV_KEYS) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
}

describe("Marketplace Connector Standard v1", () => {
  const originalBetaEnv = captureMarketplaceBetaEnv();

  afterEach(() => {
    restoreMarketplaceBetaEnv(originalBetaEnv);
    jest.restoreAllMocks();
  });

  it("fails closed when the connector OAuth public backend origin is not configured", () => {
    const service = oauthService();

    expect(() => service.getBackendOrigin()).toThrow(
      "Marketplace OAuth public backend origin is not configured",
    );
  });

  it("registers Runn as a customer-token connector over the complete pinned API", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("runn");
    expect(manifest).toBe(RUNN_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "RUNN_API_TOKEN",
      "RUNN_API_ORIGIN",
    ]);
    expect(registry.getTool("runn", "runn_read")?.name).toBe("runn.read");
    expect(registry.getTool("runn", "runn_manage")?.approvalRequired).toBe(
      true,
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "runn")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.runn.io/",
        description: expect.stringContaining("capacity planning"),
      }),
    );
  });

  it("registers Everhour as a customer-key connector over the complete pinned API", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("everhour");
    expect(manifest).toBe(EVERHOUR_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema[0]?.name).toBe("EVERHOUR_API_KEY");
    expect(registry.getTool("everhour", "everhour_read")?.name).toBe(
      "everhour.read",
    );
    expect(
      registry.getTool("everhour", "everhour_manage")?.approvalRequired,
    ).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "everhour")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://everhour.com/",
        description: expect.stringContaining("time-tracking"),
      }),
    );
  });

  it("registers Time Doctor as a customer-token connector over the safe supported API", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("time-doctor");
    expect(manifest).toBe(TIME_DOCTOR_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema[0]?.name).toBe(
      "TIME_DOCTOR_JWT_TOKEN",
    );
    expect(registry.getTool("time-doctor", "time_doctor_read")?.name).toBe(
      "timeDoctor.read",
    );
    expect(
      registry.getTool("time-doctor", "time_doctor_manage")?.approvalRequired,
    ).toBe(true);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "time-doctor"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.timedoctor.com/",
        description: expect.stringContaining("workforce analytics"),
      }),
    );
  });

  it("registers QuickBooks Time as a customer-token connector over the complete v1 API", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("quickbooks-time");
    expect(manifest).toBe(QUICKBOOKS_TIME_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema[0]?.name).toBe(
      "QUICKBOOKS_TIME_ACCESS_TOKEN",
    );
    expect(
      registry.getTool("quickbooks-time", "quickbooks_time_read")?.name,
    ).toBe("quickBooksTime.read");
    expect(
      registry.getTool("quickbooks-time", "quickbooks_time_manage")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "quickbooks-time"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://quickbooks.intuit.com/time-tracking/",
        description: expect.stringContaining("time-tracking"),
      }),
    );
  });

  it("registers Replicon as a tenant-token connector over the public REST reference", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("replicon");
    expect(manifest).toBe(REPLICON_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "REPLICON_COMPANY_KEY",
      "REPLICON_ACCESS_TOKEN",
    ]);
    expect(registry.getTool("replicon", "replicon_read")?.name).toBe(
      "replicon.read",
    );
    expect(
      registry.getTool("replicon", "replicon_manage")?.approvalRequired,
    ).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "replicon")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.replicon.com/",
        description: expect.stringContaining("time-management"),
      }),
    );
  });

  it("registers actiTIME as an encrypted customer Basic-auth connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("actitime");
    expect(manifest).toBe(ACTITIME_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "ACTITIME_INSTALLATION_URL",
      "ACTITIME_USERNAME",
      "ACTITIME_PASSWORD",
    ]);
    expect(registry.getTool("actitime", "actitime_read")?.name).toBe(
      "actiTime.read",
    );
    expect(
      registry.getTool("actitime", "actitime_manage")?.approvalRequired,
    ).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "actitime")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.actitime.com/",
        description: expect.stringContaining("time-tracking"),
      }),
    );
  });

  it("registers TrackingTime as an encrypted App Password hosted-MCP connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("trackingtime");
    expect(manifest).toBe(TRACKINGTIME_CONNECTOR_MANIFEST);
    expect(manifest?.connectorType).toBe("mcp_backed");
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "TRACKINGTIME_APP_PASSWORD",
    ]);
    expect(registry.getTool("trackingtime", "trackingtime_read")?.name).toBe(
      "trackingTime.read",
    );
    expect(
      registry.getTool("trackingtime", "trackingtime_manage")?.approvalRequired,
    ).toBe(true);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "trackingtime"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://trackingtime.co/",
        description: expect.stringContaining("time-tracking"),
      }),
    );
  });

  it("registers My Hours as an encrypted user-bound API-key connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("my-hours");
    expect(manifest).toBe(MY_HOURS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "MY_HOURS_API_KEY",
    ]);
    expect(registry.getTool("my-hours", "my_hours_read")?.name).toBe(
      "myHours.read",
    );
    expect(
      registry.getTool("my-hours", "my_hours_manage")?.approvalRequired,
    ).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "my-hours")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://myhours.com/",
        description: expect.stringContaining("time-tracking"),
      }),
    );
  });

  it("registers Paperform as an encrypted customer API-key connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("paperform");
    expect(manifest).toBe(PAPERFORM_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "PAPERFORM_API_KEY",
      "PAPERFORM_API_REGION",
    ]);
    expect(registry.getTool("paperform", "paperform_read")?.name).toBe(
      "paperform.read",
    );
    expect(
      registry.getTool("paperform", "paperform_manage")?.approvalRequired,
    ).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "paperform")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://paperform.co/",
        description: expect.stringContaining("online form builder"),
      }),
    );
  });

  it("registers Jotform as Relay-owned OAuth MCP with legacy API-key compatibility", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("jotform");
    expect(manifest).toBe(JOTFORM_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("oauth2_authorization_code");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "JOTFORM_API_KEY",
      "JOTFORM_API_REGION",
    ]);
    expect(registry.getTool("jotform", "jotform_read")?.name).toBe(
      "jotform.read",
    );
    expect(
      registry.getTool("jotform", "jotform_manage")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.capabilities.find(({ id }) => id === "jotform_manage"),
    ).toEqual(expect.objectContaining({ defaultEnabled: false }));
    expect(manifest?.auth.oauth?.accessOptions).toEqual([
      expect.objectContaining({
        id: "read_only",
        scopes: ["readOnly"],
        capabilityIds: ["jotform_read"],
        defaultSelected: true,
      }),
      expect.objectContaining({
        id: "read_write",
        scopes: ["full"],
        capabilityIds: ["jotform_read", "jotform_manage"],
        defaultSelected: false,
      }),
    ]);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "jotform")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.jotform.com/",
        accountCreationUrl: "https://www.jotform.com/signup/",
        connectionTypes: ["oauth_connector", "customer_owned_api_key"],
        description: expect.stringContaining("form and workflow platform"),
      }),
    );

    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ client_id: "relay-jotform-public" }), {
        status: 201,
      }),
    );
    const { service, oauthStateRepo, connectionRepo } = connectorOAuthHarness(
      {},
    );
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "jotform",
      {
        returnTo:
          "relayconsole://marketplace/oauth?workspace_id=workspace_1&marketplace_app=jotform",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(fetchMock.mock.calls[0][0]).toBe(JOTFORM_MCP_REGISTRATION_URL);
    expect(url.origin + url.pathname).toBe(
      "https://oauth2.jotform.com/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("relay-jotform-public");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/jotform/callback",
    );
    expect(url.searchParams.get("scope")).toBe("readOnly");
    expect(url.searchParams.get("resource")).toBe(JOTFORM_MCP_RESOURCE);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");

    const savedState = oauthStateRepo.save.mock.calls[0][0];
    savedState.id = "oauth_state_jotform";
    oauthStateRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => savedState),
    });
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "jotform-access",
            refresh_token: "jotform-refresh",
            token_type: "Bearer",
            expires_in: 3600,
            scope: "readOnly full",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { capabilities: { tools: {} } },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              tools: [
                "search",
                "get_submissions",
                "fetch",
                "create_form",
                "edit_form",
                "assign_form",
                "analyze_submissions",
              ].map((name) => ({
                name,
                inputSchema: { type: "object" },
              })),
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            result: {
              content: [{ type: "text", text: "No forms found." }],
              isError: false,
            },
          }),
          { status: 200 },
        ),
      );
    const completed = await service.completeOAuth("jotform", {
      state: url.searchParams.get("state")!,
      code: "jotform-code",
    });
    expect(completed.returnTo).toBe(
      "relayconsole://marketplace/oauth?workspace_id=workspace_1&marketplace_app=jotform",
    );
    const callbackURL = new URL(
      await service.buildCallbackRedirect("jotform", {
        status: "connected",
        connectionId: completed.connection.id,
        returnTo: completed.returnTo,
      }),
    );
    expect(callbackURL.protocol).toBe("relayconsole:");
    expect(callbackURL.searchParams.get("connector_oauth")).toBe("jotform");
    expect(callbackURL.searchParams.get("status")).toBe("connected");
    expect(callbackURL.searchParams.get("connectionId")).toBe(
      completed.connection.id,
    );
    expect(callbackURL.searchParams.get("marketplace_connection_id")).toBe(
      completed.connection.id,
    );
    const tokenBody = String(fetchMock.mock.calls[1][1]?.body);
    expect(fetchMock.mock.calls[1][0]).toBe("https://oauth2.jotform.com/token");
    expect(tokenBody).toContain("client_id=relay-jotform-public");
    expect(tokenBody).toContain(
      `resource=${encodeURIComponent(JOTFORM_MCP_RESOURCE)}`,
    );
    expect(tokenBody).not.toContain("client_secret");
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        appSlug: "jotform",
        authType: "oauth2_pkce_user",
        selectedCapabilities: ["jotform_read"],
        metadata: expect.objectContaining({
          provider: "jotform",
          mcpVerified: true,
          documentedToolsVerified: true,
          writeToolCount: 0,
          grantedScopes: ["readOnly"],
        }),
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ client_id: "relay-jotform-public-write" }),
        {
          status: 201,
        },
      ),
    );
    const writeResult = await service.startOAuth(
      "workspace_1",
      "user_1",
      "jotform",
      {
        accessOptionId: "read_write",
        selectedCapabilities: ["jotform_read", "jotform_manage"],
      },
    );
    expect(
      new URL(writeResult.authorizationUrl).searchParams.get("scope"),
    ).toBe("full");
    expect(oauthStateRepo.save.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        scopes: ["full"],
        selectedCapabilities: ["jotform_read", "jotform_manage"],
      }),
    );
  });

  it("disconnects a Jotform public-client connection locally without unsupported revocation", async () => {
    const { service, credentials, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "conn_jotform",
      workspaceId: "workspace_1",
      appSlug: "jotform",
      displayName: "Jotform connection",
      environment: "default",
      authType: "oauth2_pkce_user",
      credentialNames: ["JOTFORM_OAUTH_TOKEN_BUNDLE"],
      selectedCapabilities: ["jotform_read"],
      status: "ready",
      metadata: { provider: "jotform", tokenStatus: "valid" },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date("2026-07-31T10:00:00.000Z"),
      updatedAt: new Date("2026-07-31T10:00:00.000Z"),
      ...credentials.encrypt({
        clientId: "relay-jotform-public",
        accessToken: "jotform-access",
        refreshToken: "jotform-refresh",
      }),
    } as any;
    connection.secretCiphertext = connection.ciphertext;
    connection.secretIv = connection.iv;
    connection.secretAuthTag = connection.authTag;
    connection.secretKeyVersion = connection.keyVersion;
    connectionRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => connection),
    });
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));

    const view = await service.disconnect(
      "workspace_1",
      "user_1",
      "jotform",
      "conn_jotform",
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(credentials.decrypt(connectionRepo.save.mock.calls[0][0])).toEqual({
      clientId: "relay-jotform-public",
    });
    expect(view).toEqual(
      expect.objectContaining({
        status: "needs_credentials",
        metadata: expect.objectContaining({ tokenStatus: "disconnected" }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.jotform.oauth.disconnected",
        metadata: {
          localDisconnectOnly: true,
          providerRevoked: false,
        },
      }),
    );
  });

  it("registers Formstack as an encrypted user-bound PAT connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("formstack");
    expect(manifest).toBe(FORMSTACK_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("pat");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "FORMSTACK_PERSONAL_ACCESS_TOKEN",
    ]);
    expect(registry.getTool("formstack", "formstack_read")?.name).toBe(
      "formstack.read",
    );
    expect(
      registry.getTool("formstack", "formstack_manage")?.approvalRequired,
    ).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "formstack")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.formstack.com/",
        description: expect.stringContaining("productivity platform"),
      }),
    );
  });

  it("registers SurveyMonkey as regional Public App OAuth with three metadata reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("surveymonkey");
    expect(manifest).toBe(SURVEYMONKEY_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://api.surveymonkey.com/oauth/authorize",
        tokenUrl: "https://api.surveymonkey.com/oauth/token",
        requiredScopes: SURVEYMONKEY_SCOPES,
        pkce: false,
        supportsRefresh: false,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "surveymonkey_survey_list_recent",
      "surveymonkey_response_list",
      "surveymonkey_response_get",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "surveymonkey"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.surveymonkey.com/",
        approvalProfile: "surveymonkey_safe",
      }),
    );
  });

  it("starts SurveyMonkey OAuth with only metadata scopes and no persisted Relay secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      SURVEYMONKEY_CLIENT_ID: "relay-surveymonkey-client",
      SURVEYMONKEY_CLIENT_SECRET: "relay-surveymonkey-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "surveymonkey",
      {
        selectedCapabilities: [
          "survey_list_recent",
          "response_list",
          "response_get",
        ],
      },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://api.surveymonkey.com/oauth/authorize",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-surveymonkey-client",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(
      SURVEYMONKEY_SCOPES.join(" "),
    );
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/surveymonkey/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-surveymonkey-secret");
  });

  it("uses SurveyMonkey form exchange and validates the token-returned regional origin", async () => {
    const { service } = connectorOAuthHarness({
      SURVEYMONKEY_CLIENT_ID: "relay-surveymonkey-client",
      SURVEYMONKEY_CLIENT_SECRET: "relay-surveymonkey-secret",
    });
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "access",
          access_url: "https://api.eu.surveymonkey.com",
          scope: SURVEYMONKEY_SCOPES.join(" "),
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "123456789", username: "relay-user" }),
      } as any);

    await (service as any).exchangeToken("surveymonkey", {
      grant_type: "authorization_code",
      code: "code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/surveymonkey/callback",
      client_id: "relay-surveymonkey-client",
      client_secret: "relay-surveymonkey-secret",
    });
    const profile = await (service as any).fetchProviderProfile(
      "surveymonkey",
      "access",
      { surveyMonkeyAccessUrl: "https://api.eu.surveymonkey.com" },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.surveymonkey.com/oauth/token",
    );
    const [, exchangeInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const form = new URLSearchParams(String(exchangeInit.body));
    expect(form.get("client_secret")).toBe("relay-surveymonkey-secret");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.eu.surveymonkey.com/v3/users/me",
    );
    expect(profile).toEqual(
      expect.objectContaining({
        surveyMonkeyAccessUrl: "https://api.eu.surveymonkey.com",
        surveyMonkeyUserId: "123456789",
      }),
    );
    await expect(
      (service as any).fetchProviderProfile("surveymonkey", "access", {
        surveyMonkeyAccessUrl: "https://example.com",
      }),
    ).rejects.toThrow("official regional access URL");
    fetchMock.mockRestore();
  });

  it("registers Fillout as provider-origin-bound OAuth with three metadata reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("fillout");
    expect(manifest).toBe(FILLOUT_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://build.fillout.com/authorize/oauth",
        tokenUrl: "https://server.fillout.com/public/oauth/accessToken",
        requiredScopes: [],
        pkce: false,
        supportsRefresh: false,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "fillout_form_list",
      "fillout_form_get_metadata_summary",
      "fillout_submission_list_recent",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "fillout")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.fillout.com/",
        approvalProfile: "fillout_safe",
      }),
    );
  });

  it("starts Fillout OAuth without invented scopes or persisted Relay secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      FILLOUT_CLIENT_ID: "relay-fillout-client",
      FILLOUT_CLIENT_SECRET: "relay-fillout-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "fillout",
      {
        selectedCapabilities: ["form_list", "form_metadata", "submission_list"],
      },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://build.fillout.com/authorize/oauth",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-fillout-client",
    );
    expect(authorizeUrl.searchParams.has("scope")).toBe(false);
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/fillout/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.scopes).toEqual([]);
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-fillout-secret");
  });

  it("validates Fillout's returned EU origin and uses the documented invalidation header", async () => {
    const { service } = connectorOAuthHarness({
      FILLOUT_CLIENT_ID: "relay-fillout-client",
      FILLOUT_CLIENT_SECRET: "relay-fillout-secret",
    });
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any)
      .mockResolvedValueOnce({ ok: true } as any);
    const profile = await (service as any).fetchProviderProfile(
      "fillout",
      "fillout-access",
      { filloutBaseUrl: "https://eu-api.fillout.com" },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://eu-api.fillout.com/v1/api/forms",
    );
    expect(profile).toEqual({
      filloutBaseUrl: "https://eu-api.fillout.com",
      filloutVisibleFormCount: 0,
    });
    await (service as any).revokeFilloutSession({
      accessToken: "fillout-access",
    });
    const [invalidateUrl, invalidateInit] = fetchMock.mock
      .calls[1] as unknown as [string, RequestInit];
    expect(invalidateUrl).toBe(
      "https://server.fillout.com/public/oauth/invalidate",
    );
    expect(invalidateInit).toMatchObject({
      method: "DELETE",
      headers: expect.objectContaining({
        Authentication: "Bearer fillout-access",
      }),
    });
    await expect(
      (service as any).fetchProviderProfile("fillout", "fillout-access", {
        filloutBaseUrl: "https://example.com",
      }),
    ).rejects.toThrow("official API base URL");
    fetchMock.mockRestore();
  });

  it("registers Tally as a customer-owned broad user-key connector with three reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("tally");
    expect(manifest).toBe(TALLY_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "TALLY_API_KEY",
          secret: true,
          required: true,
        }),
      ],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "tally_form_list",
      "tally_form_get",
      "tally_submission_list",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "tally")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://tally.so/",
        approvalProfile: "tally_safe",
        riskLevel: "critical",
        connectionTypes: expect.arrayContaining([
          "customer_owned_api_key",
          "exact_current_user_binding",
          "all_user_resources_authority",
        ]),
      }),
    );
  });

  it("registers Mailchimp as metadata-data-center-bound OAuth with three reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("mailchimp");
    expect(manifest).toBe(MAILCHIMP_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://login.mailchimp.com/oauth2/authorize",
        tokenUrl: "https://login.mailchimp.com/oauth2/token",
        requiredScopes: [],
        pkce: false,
        supportsRefresh: false,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "mailchimp_account_get",
      "mailchimp_audience_list",
      "mailchimp_campaign_list_recent_sent",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "mailchimp")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://mailchimp.com/",
        approvalProfile: "mailchimp_safe",
        riskLevel: "high",
      }),
    );
  });

  it("starts Mailchimp OAuth without invented scopes or a persisted Relay secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MAILCHIMP_CLIENT_ID: "relay-mailchimp-client",
      MAILCHIMP_CLIENT_SECRET: "relay-mailchimp-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "mailchimp",
      {
        selectedCapabilities: [
          "account_metadata",
          "audience_metadata",
          "campaign_metadata",
        ],
      },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://login.mailchimp.com/oauth2/authorize",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-mailchimp-client",
    );
    expect(authorizeUrl.searchParams.has("scope")).toBe(false);
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/mailchimp/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.scopes).toEqual([]);
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-mailchimp-secret");
  });

  it("uses Mailchimp form exchange and validates metadata-derived data-center and account binding", async () => {
    const { service } = connectorOAuthHarness({
      MAILCHIMP_CLIENT_ID: "relay-mailchimp-client",
      MAILCHIMP_CLIENT_SECRET: "relay-mailchimp-secret",
    });
    const accountId = "0123456789abcdef0123456789abcdef";
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "mailchimp-access" }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dc: "us21",
          api_endpoint: "https://us21.api.mailchimp.com",
          login_url: "private-login-url",
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          account_id: accountId,
          account_name: "Relay Marketing",
          role: "admin",
          member_since: "2024-01-01T00:00:00Z",
          email: "private@example.com",
        }),
      } as any);

    await (service as any).exchangeToken("mailchimp", {
      grant_type: "authorization_code",
      code: "code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/mailchimp/callback",
      client_id: "relay-mailchimp-client",
      client_secret: "relay-mailchimp-secret",
    });
    const profile = await (service as any).fetchProviderProfile(
      "mailchimp",
      "mailchimp-access",
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://login.mailchimp.com/oauth2/token",
    );
    const [, exchangeInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const form = new URLSearchParams(String(exchangeInit.body));
    expect(form.get("client_secret")).toBe("relay-mailchimp-secret");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://login.mailchimp.com/oauth2/metadata",
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: "OAuth mailchimp-access",
      }),
    });
    expect(fetchMock.mock.calls[2][0]).toBe(
      "https://us21.api.mailchimp.com/3.0/?fields=account_id%2Caccount_name%2Crole%2Cmember_since",
    );
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: "Bearer mailchimp-access",
      }),
    });
    expect(profile).toEqual({
      mailchimpDataCenter: "us21",
      mailchimpApiOrigin: "https://us21.api.mailchimp.com",
      mailchimpAccountId: accountId,
      mailchimpAccountName: "Relay Marketing",
      mailchimpAuthorizingUserRole: "admin",
      mailchimpMemberSince: "2024-01-01T00:00:00Z",
    });
    expect(JSON.stringify(profile)).not.toContain("private");
    fetchMock.mockRestore();
  });

  it("starts Mailchimp Surveys with distinct Railway OAuth credentials and reuses the exact metadata account binding", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MAILCHIMP_SURVEYS_CLIENT_ID: "relay-surveys-client",
      MAILCHIMP_SURVEYS_CLIENT_SECRET: "relay-surveys-secret",
    });
    expect(new MarketplaceConnectorRegistry().get("mailchimp-surveys")).toBe(
      MAILCHIMP_SURVEYS_CONNECTOR_MANIFEST,
    );
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "mailchimp-surveys",
      { selectedCapabilities: ["catalog", "reports"] },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-surveys-client",
    );
    expect(authorizeUrl.searchParams.has("scope")).toBe(false);
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/mailchimp-surveys/callback",
    );
    expect(
      oauthStateRepo.save.mock.calls[0][0].clientSecretCiphertext,
    ).toBeNull();

    const accountId = "fedcba9876543210fedcba9876543210";
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dc: "us9",
          api_endpoint: "https://us9.api.mailchimp.com",
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          account_id: accountId,
          account_name: "Survey Account",
          role: "owner",
        }),
      } as any);
    const profile = await (service as any).fetchProviderProfile(
      "mailchimp-surveys",
      "surveys-access",
    );
    expect(profile).toEqual(
      expect.objectContaining({
        mailchimpDataCenter: "us9",
        mailchimpApiOrigin: "https://us9.api.mailchimp.com",
        mailchimpAccountId: accountId,
      }),
    );
  });

  it("registers and starts Klaviyo SMS with exact PKCE scopes and an isolated Relay OAuth app", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("klaviyo-sms");
    const requiredScopes = [
      "accounts:read",
      "sender-config:read",
      "sender-config:write",
    ];
    expect(manifest?.auth.oauth).toMatchObject({
      authorizationUrl: "https://www.klaviyo.com/oauth/authorize",
      tokenUrl: "https://a.klaviyo.com/oauth/token",
      refreshUrl: "https://a.klaviyo.com/oauth/token",
      revocationUrl: "https://a.klaviyo.com/oauth/revoke",
      requiredScopes,
      pkce: true,
      supportsRefresh: true,
    });
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "klaviyoSms.read",
      "klaviyoSms.provision",
    ]);
    expect(manifest?.tools[1].approvalRequired).toBe(true);

    const { service, oauthStateRepo } = connectorOAuthHarness({
      KLAVIYO_SMS_CLIENT_ID: "relay-klaviyo-sms-client",
      KLAVIYO_SMS_CLIENT_SECRET: "relay-klaviyo-sms-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "klaviyo-sms",
      { selectedCapabilities: ["readiness"] },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-klaviyo-sms-client",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(
      requiredScopes.join(" "),
    );
    expect(authorizeUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/klaviyo-sms/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.scopes).toEqual(requiredScopes);
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-klaviyo-sms-secret");
  });

  it("registers Klaviyo as PKCE OAuth with rotating tokens and three sparse reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("klaviyo");
    expect(manifest).toBe(KLAVIYO_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://www.klaviyo.com/oauth/authorize",
        tokenUrl: "https://a.klaviyo.com/oauth/token",
        refreshUrl: "https://a.klaviyo.com/oauth/token",
        revocationUrl: "https://a.klaviyo.com/oauth/revoke",
        requiredScopes: KLAVIYO_SCOPES,
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "klaviyo_account_get",
      "klaviyo_list_list_recent",
      "klaviyo_campaign_list_recent_email",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "klaviyo")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.klaviyo.com/",
        approvalProfile: "klaviyo_safe",
        riskLevel: "high",
      }),
    );
  });

  it("starts Klaviyo OAuth with exact scopes, PKCE S256, and no persisted Relay secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      KLAVIYO_CLIENT_ID: "relay-klaviyo-client",
      KLAVIYO_CLIENT_SECRET: "relay-klaviyo-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "klaviyo",
      {
        selectedCapabilities: [
          "account_metadata",
          "list_metadata",
          "campaign_metadata",
        ],
      },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://www.klaviyo.com/oauth/authorize",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-klaviyo-client",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(
      KLAVIYO_SCOPES.join(" "),
    );
    expect(authorizeUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorizeUrl.searchParams.get("code_challenge")).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/klaviyo/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.scopes).toEqual(KLAVIYO_SCOPES);
    expect(state.codeVerifierCiphertext).toBeTruthy();
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-klaviyo-secret");
  });

  it("uses Klaviyo Basic-auth form exchange, sparse Account validation, and revocation", async () => {
    const { service } = connectorOAuthHarness({
      KLAVIYO_CLIENT_ID: "relay-klaviyo-client",
      KLAVIYO_CLIENT_SECRET: "relay-klaviyo-secret",
    });
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "klaviyo-access",
          refresh_token: "klaviyo-refresh",
          expires_in: 3600,
          scope: KLAVIYO_SCOPES.join(" "),
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              type: "account",
              id: "AbC123",
              attributes: {
                name: "Relay Commerce",
                timezone: "Europe/London",
                currency: "GBP",
                contact_information: { email: "private@example.com" },
              },
            },
          ],
        }),
      } as any)
      .mockResolvedValueOnce({ ok: true } as any);

    await (service as any).exchangeToken("klaviyo", {
      grant_type: "authorization_code",
      code: "code",
      code_verifier: "v".repeat(43),
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/klaviyo/callback",
      client_id: "relay-klaviyo-client",
      client_secret: "relay-klaviyo-secret",
    });
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(tokenUrl).toBe("https://a.klaviyo.com/oauth/token");
    expect(tokenInit.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("relay-klaviyo-client:relay-klaviyo-secret").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const tokenForm = new URLSearchParams(String(tokenInit.body));
    expect(tokenForm.get("client_id")).toBeNull();
    expect(tokenForm.get("client_secret")).toBeNull();
    expect(tokenForm.get("code_verifier")).toBe("v".repeat(43));

    const profile = await (service as any).fetchProviderProfile(
      "klaviyo",
      "klaviyo-access",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://a.klaviyo.com/api/accounts?fields%5Baccount%5D=name%2Ctimezone%2Ccurrency",
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: "Bearer klaviyo-access",
        revision: KLAVIYO_API_REVISION,
      }),
    });
    expect(profile).toEqual({
      klaviyoAccountId: "AbC123",
      klaviyoAccountName: "Relay Commerce",
      klaviyoAccountTimezone: "Europe/London",
      klaviyoAccountCurrency: "GBP",
    });
    expect(JSON.stringify(profile)).not.toContain("private");

    await (service as any).revokeKlaviyoSession(
      { refreshToken: "klaviyo-refresh" },
      { metadata: { clientId: "relay-klaviyo-client" } },
    );
    const [revokeUrl, revokeInit] = fetchMock.mock.calls[2] as unknown as [
      string,
      RequestInit,
    ];
    expect(revokeUrl).toBe("https://a.klaviyo.com/oauth/revoke");
    expect(revokeInit.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("relay-klaviyo-client:relay-klaviyo-secret").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const revokeForm = new URLSearchParams(String(revokeInit.body));
    expect(revokeForm.get("token")).toBe("klaviyo-refresh");
    expect(revokeForm.get("token_type_hint")).toBe("refresh_token");
    fetchMock.mockRestore();
  });

  it("registers Kit OAuth with a rotating pair and three privacy-minimized reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("convertkit");
    expect(manifest).toBe(CONVERTKIT_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://api.kit.com/v4/oauth/authorize",
        tokenUrl: "https://api.kit.com/v4/oauth/token",
        refreshUrl: "https://api.kit.com/v4/oauth/token",
        requiredScopes: CONVERTKIT_SCOPES,
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "convertkit_account_get",
      "convertkit_form_list_active",
      "convertkit_broadcast_list_recent",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "convertkit"),
    ).toEqual(
      expect.objectContaining({
        name: "Kit",
        providerWebsiteUrl: "https://kit.com/",
        approvalProfile: "convertkit_safe",
        riskLevel: "high",
      }),
    );
  });

  it("starts Kit confidential OAuth with exact public scope and no persisted Relay secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      CONVERTKIT_CLIENT_ID: "relay-kit-client",
      CONVERTKIT_CLIENT_SECRET: "relay-kit-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "convertkit",
      {
        selectedCapabilities: [
          "account_metadata",
          "form_metadata",
          "broadcast_metadata",
        ],
      },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://api.kit.com/v4/oauth/authorize",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe("relay-kit-client");
    expect(authorizeUrl.searchParams.get("scope")).toBe("public");
    expect(authorizeUrl.searchParams.get("code_challenge")).toBeNull();
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/convertkit/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.scopes).toEqual(["public"]);
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-kit-secret");
  });

  it("uses Kit JSON exchange and refresh bodies and strips private account identity", async () => {
    const { service } = connectorOAuthHarness({
      CONVERTKIT_CLIENT_ID: "relay-kit-client",
      CONVERTKIT_CLIENT_SECRET: "relay-kit-secret",
    });
    const tokenPair = {
      access_token: "kit-access",
      refresh_token: "kit-refresh",
      expires_in: 7200,
      scope: "public",
      created_at: 1710271006,
    };
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => tokenPair,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...tokenPair, refresh_token: "kit-rotated" }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { email: "private-user@example.com" },
          account: {
            id: 29,
            name: "Relay Creators",
            plan_type: "creator",
            primary_email_address: "private-account@example.com",
            created_at: "2025-01-01T00:00:00Z",
            timezone: {
              name: "Europe/London",
              friendly_name: "private timezone",
            },
          },
        }),
      } as any);

    await (service as any).exchangeToken("convertkit", {
      grant_type: "authorization_code",
      code: "code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/convertkit/callback",
      client_id: "relay-kit-client",
      client_secret: "relay-kit-secret",
    });
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(tokenUrl).toBe("https://api.kit.com/v4/oauth/token");
    expect(tokenInit.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(tokenInit.body))).toMatchObject({
      client_id: "relay-kit-client",
      client_secret: "relay-kit-secret",
      grant_type: "authorization_code",
    });

    await (service as any).exchangeToken("convertkit", {
      grant_type: "refresh_token",
      refresh_token: "kit-refresh",
      client_id: "relay-kit-client",
      client_secret: "relay-kit-secret",
    });
    const [, refreshInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    const refreshBody = JSON.parse(String(refreshInit.body));
    expect(refreshBody).toEqual({
      grant_type: "refresh_token",
      refresh_token: "kit-refresh",
      client_id: "relay-kit-client",
    });

    const profile = await (service as any).fetchProviderProfile(
      "convertkit",
      "kit-access",
    );
    expect(fetchMock.mock.calls[2][0]).toBe("https://api.kit.com/v4/account");
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer kit-access" }),
    });
    expect(profile).toEqual({
      convertKitAccountId: "29",
      convertKitAccountName: "Relay Creators",
      convertKitPlanType: "creator",
      convertKitCreatedAt: "2025-01-01T00:00:00Z",
      convertKitTimezoneName: "Europe/London",
    });
    expect(JSON.stringify(profile)).not.toContain("private");
    fetchMock.mockRestore();
  });

  it("registers Campaign Monitor ViewReports OAuth with three bounded reporting reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("campaign-monitor");
    expect(manifest).toBe(CAMPAIGN_MONITOR_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://api.createsend.com/oauth",
        tokenUrl: "https://api.createsend.com/oauth/token",
        refreshUrl: "https://api.createsend.com/oauth/token",
        requiredScopes: CAMPAIGN_MONITOR_SCOPES,
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "campaign_monitor_client_get",
      "campaign_monitor_campaign_list_recent_sent",
      "campaign_monitor_campaign_summary_get",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "campaign-monitor"),
    ).toEqual(
      expect.objectContaining({
        approvalProfile: "campaign_monitor_safe",
        riskLevel: "high",
      }),
    );
  });

  it("starts Campaign Monitor web-server OAuth with exactly ViewReports", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      CAMPAIGN_MONITOR_CLIENT_ID: "relay-campaign-monitor-client",
      CAMPAIGN_MONITOR_CLIENT_SECRET: "relay-campaign-monitor-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "campaign-monitor",
      {
        selectedCapabilities: [
          "client_metadata",
          "campaign_metadata",
          "campaign_summary",
        ],
      },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://api.createsend.com/oauth",
    );
    expect(authorizeUrl.searchParams.get("type")).toBe("web_server");
    expect(authorizeUrl.searchParams.get("scope")).toBe("ViewReports");
    expect(authorizeUrl.searchParams.get("code_challenge")).toBeNull();
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/campaign-monitor/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.scopes).toEqual(["ViewReports"]);
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain(
      "relay-campaign-monitor-secret",
    );
  });

  it("uses Campaign Monitor form token rotation and binds one visible Client", async () => {
    const { service } = connectorOAuthHarness({
      CAMPAIGN_MONITOR_CLIENT_ID: "relay-campaign-monitor-client",
      CAMPAIGN_MONITOR_CLIENT_SECRET: "relay-campaign-monitor-secret",
    });
    const tokenPair = {
      access_token: "campaign-monitor-access",
      refresh_token: "campaign-monitor-refresh",
      expires_in: 1_209_600,
    };
    const selectedClientId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => tokenPair,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...tokenPair,
          refresh_token: "campaign-monitor-rotated",
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            ClientID: selectedClientId,
            Name: "Relay Client",
            Private: "private",
          },
        ],
      } as any);

    await (service as any).exchangeToken("campaign-monitor", {
      grant_type: "authorization_code",
      code: "code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/campaign-monitor/callback",
      client_id: "relay-campaign-monitor-client",
      client_secret: "relay-campaign-monitor-secret",
    });
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(tokenUrl).toBe("https://api.createsend.com/oauth/token");
    expect(tokenInit.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const tokenForm = new URLSearchParams(String(tokenInit.body));
    expect(tokenForm.get("client_id")).toBe("relay-campaign-monitor-client");
    expect(tokenForm.get("client_secret")).toBe(
      "relay-campaign-monitor-secret",
    );

    await (service as any).exchangeToken("campaign-monitor", {
      grant_type: "refresh_token",
      refresh_token: "campaign-monitor-refresh",
      client_id: "relay-campaign-monitor-client",
      client_secret: "relay-campaign-monitor-secret",
    });
    const [, refreshInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    const refreshForm = new URLSearchParams(String(refreshInit.body));
    expect(Object.fromEntries(refreshForm)).toEqual({
      grant_type: "refresh_token",
      refresh_token: "campaign-monitor-refresh",
    });

    const profile = await (service as any).fetchProviderProfile(
      "campaign-monitor",
      "campaign-monitor-access",
    );
    expect(fetchMock.mock.calls[2][0]).toBe(
      "https://api.createsend.com/api/v3.3/clients.json",
    );
    expect(profile).toEqual({
      campaignMonitorClientId: selectedClientId,
      campaignMonitorClientName: "Relay Client",
      campaignMonitorVisibleClientCount: 1,
    });
    expect(JSON.stringify(profile)).not.toContain("private");
    fetchMock.mockRestore();
  });

  it("registers and starts Constant Contact OAuth with exact scopes and harmless reads", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("constant-contact");
    expect(manifest).toBe(CONSTANT_CONTACT_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      authorizationUrl:
        "https://authz.constantcontact.com/oauth2/default/v1/authorize",
      tokenUrl: "https://authz.constantcontact.com/oauth2/default/v1/token",
      refreshUrl: "https://authz.constantcontact.com/oauth2/default/v1/token",
      requiredScopes: CONSTANT_CONTACT_SCOPES,
      pkce: false,
      supportsRefresh: true,
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "constant_contact_account_get",
      "constant_contact_campaign_list_recent",
      "constant_contact_campaign_summary_list_recent",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    const { service, oauthStateRepo } = connectorOAuthHarness({
      CONSTANT_CONTACT_CLIENT_ID: "relay-cc-client",
      CONSTANT_CONTACT_CLIENT_SECRET: "relay-cc-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "constant-contact",
      {
        selectedCapabilities: [
          "account_metadata",
          "campaign_metadata",
          "campaign_summary",
        ],
      },
    );
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://authz.constantcontact.com/oauth2/default/v1/authorize",
    );
    expect(url.searchParams.get("scope")).toBe(
      CONSTANT_CONTACT_SCOPES.join(" "),
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/constant-contact/callback",
    );
    expect(url.searchParams.get("code_challenge")).toBeNull();
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.scopes).toEqual(CONSTANT_CONTACT_SCOPES);
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-cc-secret");
  });

  it("uses Constant Contact Basic token rotation and validates Account privileges", async () => {
    const { service } = connectorOAuthHarness({
      CONSTANT_CONTACT_CLIENT_ID: "relay-cc-client",
      CONSTANT_CONTACT_CLIENT_SECRET: "relay-cc-secret",
    });
    const token = {
      access_token: "cc-access",
      refresh_token: "cc-refresh",
      expires_in: 86_400,
      scope: CONSTANT_CONTACT_SCOPES.join(" "),
    };
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({ ok: true, json: async () => token } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...token, refresh_token: "cc-rotated" }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          encoded_account_id: "p07e1l8cdif9dl",
          organization_name: "Relay News",
          contact_email: "private@example.com",
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { privilege_name: "account:read" },
          { privilege_name: "campaign:read" },
          { privilege_name: "ui:campaign:metrics" },
          { privilege_name: "contacts:read" },
        ],
      } as any);
    await (service as any).exchangeToken("constant-contact", {
      grant_type: "authorization_code",
      code: "code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/constant-contact/callback",
      client_id: "relay-cc-client",
      client_secret: "relay-cc-secret",
    });
    const [, initial] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(initial.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("relay-cc-client:relay-cc-secret").toString("base64")}`,
    });
    expect(
      new URLSearchParams(String(initial.body)).get("client_secret"),
    ).toBeNull();
    await (service as any).exchangeToken("constant-contact", {
      grant_type: "refresh_token",
      refresh_token: "cc-refresh",
      client_id: "relay-cc-client",
      client_secret: "relay-cc-secret",
    });
    const [, refresh] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(
      Object.fromEntries(new URLSearchParams(String(refresh.body))),
    ).toEqual({ grant_type: "refresh_token", refresh_token: "cc-refresh" });
    const profile = await (service as any).fetchProviderProfile(
      "constant-contact",
      "cc-access",
    );
    expect(profile).toEqual({
      constantContactAccountId: "p07e1l8cdif9dl",
      constantContactOrganizationName: "Relay News",
      constantContactPrivileges: [
        "account:read",
        "campaign:read",
        "ui:campaign:metrics",
      ],
    });
    expect(JSON.stringify(profile)).not.toContain("private");
    fetchMock.mockRestore();
  });

  it("registers ActiveCampaign as a customer-owned user-key connector with three bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("activecampaign");
    expect(manifest).toBe(ACTIVECAMPAIGN_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "ACTIVECAMPAIGN_API_URL",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "ACTIVECAMPAIGN_API_TOKEN",
          secret: true,
          required: true,
        }),
      ],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "activecampaign_account_binding_get",
      "activecampaign_list_list_recent",
      "activecampaign_campaign_list_recent",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "activecampaign"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.activecampaign.com/",
        approvalProfile: "activecampaign_safe",
        riskLevel: "critical",
        connectionTypes: expect.arrayContaining([
          "customer_owned_user_api_key",
          "customer_supplied_account_api_origin",
          "exact_token_bound_user_validation",
        ]),
      }),
    );
  });

  it("registers Customer.io as an exact Workspace-bound App API connector with three bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("customer-io");
    expect(manifest).toBe(CUSTOMER_IO_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "CUSTOMER_IO_APP_API_ORIGIN",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "CUSTOMER_IO_WORKSPACE_ID",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "CUSTOMER_IO_APP_API_KEY",
          secret: true,
          required: true,
        }),
      ],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "customer_io_workspace_binding_get",
      "customer_io_campaign_list",
      "customer_io_broadcast_list",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "customer-io"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://customer.io/",
        approvalProfile: "customer_io_safe",
        riskLevel: "critical",
        connectionTypes: expect.arrayContaining([
          "customer_owned_workspace_app_api_key",
          "customer_supplied_region",
          "exact_workspace_id_validation",
        ]),
      }),
    );
  });

  it("registers Braze as a regional, exactly permission-scoped workspace key connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("braze");
    expect(manifest).toBe(BRAZE_CONNECTOR_MANIFEST);
    expect(BRAZE_PERMISSIONS).toEqual([
      "campaigns.list",
      "campaigns.data_series",
      "canvas.list",
    ]);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "BRAZE_REST_ENDPOINT",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "BRAZE_REST_API_KEY",
          secret: true,
          required: true,
        }),
      ],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "braze_campaign_list_recent",
      "braze_canvas_list_recent",
      "braze_campaign_analytics_get",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "braze")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.braze.com/",
        approvalProfile: "braze_safe",
        riskLevel: "high",
        connectionTypes: expect.arrayContaining([
          "customer_owned_workspace_rest_api_key",
          "exact_endpoint_permission_scope",
        ]),
      }),
    );
  });

  it("registers Segment as an exact Workspace-bound Public API token connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("segment");
    expect(manifest).toBe(SEGMENT_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "SEGMENT_PUBLIC_API_ORIGIN",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "SEGMENT_WORKSPACE_ID",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "SEGMENT_PUBLIC_API_TOKEN",
          secret: true,
          required: true,
        }),
      ],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "segment_workspace_binding_get",
      "segment_source_list",
      "segment_destination_list",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "segment")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://segment.com/",
        approvalProfile: "segment_safe",
        riskLevel: "critical",
        connectionTypes: expect.arrayContaining([
          "customer_owned_workspace_public_api_token",
          "exact_workspace_id_validation",
        ]),
      }),
    );
  });

  it("registers Mixpanel as an exact Project-bound Service Account connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("mixpanel");
    expect(manifest).toBe(MIXPANEL_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "MIXPANEL_API_ORIGIN",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "MIXPANEL_PROJECT_ID",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "MIXPANEL_SERVICE_ACCOUNT_USERNAME",
          secret: true,
          required: true,
        }),
        expect.objectContaining({
          name: "MIXPANEL_SERVICE_ACCOUNT_SECRET",
          secret: true,
          required: true,
        }),
      ],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "mixpanel_project_binding_get",
      "mixpanel_cohort_list",
      "mixpanel_annotation_list",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "mixpanel")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://mixpanel.com/",
        approvalProfile: "mixpanel_safe",
        riskLevel: "critical",
        connectionTypes: expect.arrayContaining([
          "customer_owned_service_account",
          "exact_project_id_validation",
        ]),
      }),
    );
  });

  it("registers Amplitude as an exact Project-bound API/Secret Key connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("amplitude");
    expect(manifest).toBe(AMPLITUDE_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "AMPLITUDE_DASHBOARD_REST_ORIGIN",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "AMPLITUDE_PROJECT_API_KEY",
          secret: true,
          required: true,
        }),
        expect.objectContaining({
          name: "AMPLITUDE_PROJECT_SECRET_KEY",
          secret: true,
          required: true,
        }),
      ],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "amplitude_project_binding_get",
      "amplitude_daily_users_get",
      "amplitude_average_session_length_get",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "amplitude")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://amplitude.com/",
        approvalProfile: "amplitude_safe",
        riskLevel: "critical",
        connectionTypes: expect.arrayContaining([
          "customer_owned_project_api_secret_key_pair",
          "exact_project_key_binding",
        ]),
      }),
    );
  });

  it("registers Pendo as an Application-bounded read-only Integration Key connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("pendo");
    expect(manifest).toBe(PENDO_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "PENDO_ENGAGE_API_ORIGIN",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "PENDO_APPLICATION_ID",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "PENDO_INTEGRATION_KEY",
          secret: true,
          required: true,
        }),
      ],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "pendo_application_binding_get",
      "pendo_definition_list",
      "pendo_adoption_get",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "pendo")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.pendo.io/",
        approvalProfile: "pendo_safe",
        riskLevel: "critical",
        connectionTypes: expect.arrayContaining([
          "customer_owned_subscription_wide_read_only_integration_key",
          "exact_application_id_request_boundary",
        ]),
      }),
    );
  });

  it("upgrades PostHog in place to Relay-owned CIMD OAuth and seven curated reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("posthog");
    expect(manifest).toBe(POSTHOG_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://oauth.posthog.com/oauth/authorize/",
        tokenUrl: "https://oauth.posthog.com/oauth/token/",
        revocationUrl: "https://oauth.posthog.com/oauth/revoke/",
        requiredScopes: [...POSTHOG_SCOPES],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        expect.objectContaining({
          name: "RELAY_POSTHOG_OAUTH_CLIENT_METADATA_URL",
          secret: false,
          required: true,
        }),
        expect.objectContaining({ name: "POSTHOG_API_ORIGIN" }),
        expect.objectContaining({ name: "POSTHOG_ORGANIZATION_ID" }),
        expect.objectContaining({ name: "POSTHOG_PROJECT_ID" }),
      ],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "posthog_projects_list",
      "posthog_dashboards_list",
      "posthog_dashboard_read",
      "posthog_insights_list",
      "posthog_insight_read",
      "posthog_query_bounded",
      "posthog_schema_read",
    ]);
    expect(
      manifest?.tools.find(
        (tool) => tool.functionName === "posthog_query_bounded",
      )?.approvalRequired,
    ).toBe(true);
    expect(
      MARKETPLACE_CATALOG.filter((app) => app.slug === "posthog"),
    ).toHaveLength(1);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "posthog")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://posthog.com/",
        approvalProfile: "posthog_safe",
        riskLevel: "critical",
        connectionTypes: expect.arrayContaining([
          "relay_owned_cimd_oauth",
          "exact_organization_and_project_binding",
        ]),
      }),
    );
  });

  it("upgrades Sentry in place to public device OAuth and six curated wrappers", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("sentry");
    expect(manifest).toBe(SENTRY_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "custom",
      oauth: {
        authorizationUrl: "https://sentry.io/oauth/device/",
        tokenUrl: "https://sentry.io/oauth/token/",
        refreshUrl: "https://sentry.io/oauth/token/",
        requiredScopes: [...SENTRY_SCOPES],
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [
        expect.objectContaining({
          name: "RELAY_SENTRY_OAUTH_CLIENT_ID",
          required: true,
          secret: false,
        }),
        expect.objectContaining({
          name: "SENTRY_ORGANIZATION",
          required: true,
          secret: false,
        }),
      ],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "sentry_projects_list",
      "sentry_issues_search",
      "sentry_issue_read",
      "sentry_event_read",
      "sentry_issue_update_prepare",
      "sentry_issue_update",
    ]);
    expect(
      manifest?.tools.find(
        (tool) => tool.functionName === "sentry_issue_update",
      )?.approvalRequired,
    ).toBe(true);
    expect(
      MARKETPLACE_CATALOG.filter((app) => app.slug === "sentry"),
    ).toHaveLength(1);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "sentry")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://sentry.io/",
        approvalProfile: "sentry_safe",
        riskLevel: "critical",
        connectionTypes: expect.arrayContaining([
          "relay_owned_device_oauth",
          "organization_scoped_consent",
        ]),
      }),
    );
  });

  it("starts Sentry device OAuth without persisting or returning the raw device code", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      RELAY_SENTRY_OAUTH_CLIENT_ID: "relay-sentry-client",
    });
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        device_code: "provider-device-secret",
        user_code: "ABCD-EFGH",
        verification_uri: "https://sentry.io/oauth/device/",
        verification_uri_complete:
          "https://sentry.io/oauth/device/?user_code=ABCD-EFGH",
        expires_in: 600,
        interval: 5,
      }),
    } as any);

    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "sentry",
      {},
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sentry.io/oauth/device/code/",
      expect.objectContaining({ method: "POST", redirect: "error" }),
    );
    expect(result).toMatchObject({
      flow: "device_authorization",
      userCode: "ABCD-EFGH",
      verificationUri: "https://sentry.io/oauth/device/",
      interval: 5,
      requiredScopes: [...SENTRY_SCOPES],
    });
    expect(result.deviceFlowToken).not.toContain("provider-device-secret");
    expect(oauthStateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        appSlug: "sentry",
        providerSessionCiphertext: null,
        providerSessionIv: null,
        providerSessionAuthTag: null,
        providerSessionKeyVersion: null,
      }),
    );
    expect(JSON.stringify(oauthStateRepo.save.mock.calls)).not.toContain(
      "provider-device-secret",
    );
    jest.restoreAllMocks();
  });

  it("registers Resource Guru as Relay-owned OAuth over the pinned official API", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("resource-guru");

    expect(manifest).toBe(RESOURCE_GURU_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://api.resourceguruapp.com/oauth/authorize",
        tokenUrl: "https://api.resourceguruapp.com/oauth/token",
        requiredScopes: [],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("resource-guru", "resource_guru_read")?.name).toBe(
      "resource-guru.read",
    );
    expect(
      registry.getTool("resource-guru", "resource_guru_manage")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "resource-guru"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://resourceguruapp.com/",
        availability: "available",
        description: expect.stringContaining(
          "resource scheduling and capacity-planning software",
        ),
      }),
    );
  });

  it("starts Resource Guru OAuth from Railway variables without persisting the client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      RESOURCE_GURU_CLIENT_ID: "railway-resource-guru-client",
      RESOURCE_GURU_CLIENT_SECRET: "railway-resource-guru-secret",
    });

    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "resource-guru",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=resource-guru",
      },
    );

    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://api.resourceguruapp.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe(
      "railway-resource-guru-client",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/resource-guru/callback",
    );
    expect(url.searchParams.has("scope")).toBe(false);
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeNull();
    expect(savedState.clientSecretIv).toBeNull();
    expect(JSON.stringify(savedState)).not.toContain(
      "railway-resource-guru-secret",
    );
  });

  it("registers Timely as Relay-owned OAuth over the pinned official API", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("timely-time-tracking");

    expect(manifest).toBe(TIMELY_TIME_TRACKING_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://api.timelyapp.com/1.1/oauth/authorize",
        tokenUrl: "https://api.timelyapp.com/1.1/oauth/token",
        requiredScopes: ["manage"],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(
      registry.getTool("timely-time-tracking", "timely_time_tracking_read")
        ?.name,
    ).toBe("timely-time-tracking.read");
    expect(
      registry.getTool("timely-time-tracking", "timely_time_tracking_manage")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "timely-time-tracking"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.timely.com/",
        availability: "available",
        description: expect.stringContaining("automatic time-tracking"),
      }),
    );
  });

  it("starts Timely OAuth from Railway variables without persisting the client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      TIMELY_TIME_TRACKING_CLIENT_ID: "railway-timely-client",
      TIMELY_TIME_TRACKING_CLIENT_SECRET: "railway-timely-secret",
    });

    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "timely-time-tracking",
      {
        returnTo:
          "https://relayconsole.work/app?marketplace_app=timely-time-tracking",
      },
    );

    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://api.timelyapp.com/1.1/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("railway-timely-client");
    expect(url.searchParams.get("scope")).toBe("manage");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/timely-time-tracking/callback",
    );
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeNull();
    expect(savedState.clientSecretIv).toBeNull();
    expect(JSON.stringify(savedState)).not.toContain("railway-timely-secret");
  });

  it("registers RescueTime as provider-approved Relay-owned OAuth over both official APIs", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("rescuetime");

    expect(manifest).toBe(RESCUETIME_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://www.rescuetime.com/oauth/authorize",
        tokenUrl: "https://www.rescuetime.com/oauth/token",
        requiredScopes: [
          "time_data",
          "category_data",
          "productivity_data",
          "alert_data",
          "highlight_data",
          "focustime_data",
        ],
        pkce: false,
        supportsRefresh: false,
      }),
    );
    expect(registry.getTool("rescuetime", "rescuetime_read")?.name).toBe(
      "rescuetime.read",
    );
    expect(
      registry.getTool("rescuetime", "rescuetime_manage")?.approvalRequired,
    ).toBe(true);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "rescuetime"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.rescuetime.com/",
        availability: "available",
        description: expect.stringContaining("automatically records time"),
      }),
    );
  });

  it("starts RescueTime OAuth from Railway variables without persisting the client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      RESCUETIME_CLIENT_ID: "railway-rescuetime-client",
      RESCUETIME_CLIENT_SECRET: "railway-rescuetime-secret",
    });

    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "rescuetime",
      { returnTo: "https://relayconsole.work/app?marketplace_app=rescuetime" },
    );

    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://www.rescuetime.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("railway-rescuetime-client");
    expect(url.searchParams.get("scope")).toBe(
      "time_data category_data productivity_data alert_data highlight_data focustime_data",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/rescuetime/callback",
    );
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeNull();
    expect(savedState.clientSecretIv).toBeNull();
    expect(JSON.stringify(savedState)).not.toContain(
      "railway-rescuetime-secret",
    );
  });

  it("registers Hubstaff as Relay-owned OIDC OAuth over the pinned v2 API", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("hubstaff");
    expect(manifest).toBe(HUBSTAFF_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://account.hubstaff.com/authorizations/new",
        tokenUrl: "https://account.hubstaff.com/access_tokens",
        requiredScopes: [
          "openid",
          "profile",
          "email",
          "hubstaff:read",
          "hubstaff:write",
        ],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("hubstaff", "hubstaff_read")?.name).toBe(
      "hubstaff.read",
    );
    expect(
      registry.getTool("hubstaff", "hubstaff_manage")?.approvalRequired,
    ).toBe(true);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "hubstaff")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://hubstaff.com/",
        availability: "available",
        description: expect.stringContaining("workforce-management software"),
      }),
    );
  });

  it("starts Hubstaff OAuth with Railway credentials, PKCE, nonce, and the exact callback", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      HUBSTAFF_CLIENT_ID: "railway-hubstaff-client",
      HUBSTAFF_CLIENT_SECRET: "railway-hubstaff-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "hubstaff",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=hubstaff",
      },
    );
    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://account.hubstaff.com/authorizations/new",
    );
    expect(url.searchParams.get("client_id")).toBe("railway-hubstaff-client");
    expect(url.searchParams.get("scope")).toBe(
      "openid profile email hubstaff:read hubstaff:write",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/hubstaff/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("nonce")).toBeTruthy();
    expect(savedState.codeVerifierCiphertext).toBeTruthy();
    expect(savedState.providerSessionCiphertext).toBeTruthy();
    expect(savedState.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(savedState)).not.toContain("railway-hubstaff-secret");
  });

  it("registers Outlook as an exact delegated read-only connector", () => {
    const registry = new MarketplaceConnectorRegistry();

    expect(registry.get("outlook")?.connectorType).toBe("native_clawchat");
    expect(OUTLOOK_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes).toEqual([
      "openid",
      "profile",
      "offline_access",
      "https://graph.microsoft.com/Mail.Read",
    ]);
    expect(
      OUTLOOK_CONNECTOR_MANIFEST.capabilities.map(
        (capability) => capability.id,
      ),
    ).toEqual([
      "mail_folders_list",
      "inbox_messages_list",
      "unread_messages_list",
      "message_get",
    ]);
    expect(
      registry.getTool("outlook", "outlook_inbox_messages_list")?.name,
    ).toBe("outlook.listInboxMessages");
    expect(registry.getTool("outlook", "outlook_mail_folders_list")?.name).toBe(
      "outlook.listMailFolders",
    );
    expect(
      registry.getTool("outlook", "outlook_unread_messages_list")?.name,
    ).toBe("outlook.listUnreadMessages");
    expect(registry.getTool("outlook", "outlook_message_get")?.name).toBe(
      "outlook.getMessage",
    );
    expect(
      registry.getTool("outlook", "outlook_send_approved_email"),
    ).toBeNull();
  });

  it("starts Microsoft Teams work-account OAuth from Railway with exact scopes", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "railway-microsoft-client",
      MICROSOFT_CLIENT_SECRET: "railway-microsoft-secret",
    });

    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "microsoft-teams",
      { returnTo: "/marketplace?app=microsoft-teams" },
    );
    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];

    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("railway-microsoft-client");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual(
      MICROSOFT_TEAMS_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes,
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(savedState.clientSecretCiphertext).toBeTruthy();
    expect(JSON.stringify(savedState)).not.toContain(
      "railway-microsoft-secret",
    );
  });

  it("registers OneDrive with exactly four own-drive metadata wrappers", () => {
    const manifest = new MarketplaceConnectorRegistry().get("onedrive");
    expect(manifest).toBe(ONEDRIVE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      requiredScopes: ONEDRIVE_SCOPES,
      pkce: true,
      supportsRefresh: true,
      authority: { provider: "microsoft", defaultMode: "multi_tenant_common" },
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "onedrive_drive_get",
      "onedrive_root_children_list",
      "onedrive_folder_children_list",
      "onedrive_item_get",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "onedrive_safe",
      "dangerously_skip_permissions",
    ]);
  });

  it("starts Relay-owned OneDrive OAuth with exact scope, PKCE, and no persisted client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "relay-microsoft-client",
      MICROSOFT_CLIENT_SECRET: "relay-microsoft-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "onedrive",
      { selectedCapabilities: ["drive_read", "item_read"] },
    );
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("relay-microsoft-client");
    expect(url.searchParams.get("scope")).toBe(ONEDRIVE_SCOPES.join(" "));
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/onedrive/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.codeVerifierCiphertext).toBeTruthy();
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-microsoft-secret");
  });

  it("registers SharePoint with exactly four selected-site metadata wrappers", () => {
    const manifest = new MarketplaceConnectorRegistry().get("sharepoint");
    expect(manifest).toBe(SHAREPOINT_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      requiredScopes: SHAREPOINT_SCOPES,
      pkce: true,
      supportsRefresh: true,
      authority: { provider: "microsoft", defaultMode: "multi_tenant_org" },
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "sharepoint_site_get",
      "sharepoint_lists_list",
      "sharepoint_drives_list",
      "sharepoint_default_library_root_list",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "sharepoint_safe",
      "dangerously_skip_permissions",
    ]);
  });

  it("starts selected-site SharePoint OAuth with exact scope, PKCE, and encrypted site state", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "relay-microsoft-client",
      MICROSOFT_CLIENT_SECRET: "relay-microsoft-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "sharepoint",
      {
        providerDomain: "https://contoso.sharepoint.com/sites/product",
        selectedCapabilities: ["site_read", "site_structure_read"],
      },
    );
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("relay-microsoft-client");
    expect(url.searchParams.get("scope")).toBe(SHAREPOINT_SCOPES.join(" "));
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/sharepoint/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.providerSessionCiphertext).toBeTruthy();
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("contoso.sharepoint.com");
    expect(JSON.stringify(state)).not.toContain("relay-microsoft-secret");
  });

  it("registers Microsoft Planner with exactly four bounded delegated reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get(
      "microsoft-planner",
    );
    expect(manifest).toBe(MICROSOFT_PLANNER_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      requiredScopes: MICROSOFT_PLANNER_SCOPES,
      pkce: true,
      supportsRefresh: true,
      authority: { provider: "microsoft", defaultMode: "multi_tenant_org" },
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "microsoft_planner_assigned_tasks_list",
      "microsoft_planner_task_get",
      "microsoft_planner_plan_get",
      "microsoft_planner_plan_tasks_list",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "microsoft_planner_safe",
      "dangerously_skip_permissions",
    ]);
  });

  it("starts Relay-owned Planner OAuth with exact Tasks.Read, PKCE, and no persisted client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "relay-microsoft-client",
      MICROSOFT_CLIENT_SECRET: "relay-microsoft-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "microsoft-planner",
      { selectedCapabilities: ["assigned_tasks", "explicit_task_plan_read"] },
    );
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("relay-microsoft-client");
    expect(url.searchParams.get("scope")).toBe(
      MICROSOFT_PLANNER_SCOPES.join(" "),
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/microsoft-planner/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-microsoft-secret");
  });

  it("registers Microsoft To Do with exactly four bounded delegated reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("microsoft-to-do");
    expect(manifest).toBe(MICROSOFT_TO_DO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      requiredScopes: MICROSOFT_TO_DO_SCOPES,
      pkce: true,
      supportsRefresh: true,
      authority: { provider: "microsoft", defaultMode: "multi_tenant_common" },
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "microsoft_todo_task_lists_list",
      "microsoft_todo_task_list_get",
      "microsoft_todo_tasks_list",
      "microsoft_todo_task_get",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "microsoft_todo_safe",
      "dangerously_skip_permissions",
    ]);
  });

  it("starts Relay-owned Microsoft To Do OAuth with exact Tasks.Read, common authority, PKCE, and no persisted client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "relay-microsoft-client",
      MICROSOFT_CLIENT_SECRET: "relay-microsoft-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "microsoft-to-do",
      { selectedCapabilities: ["task_lists", "task_metadata"] },
    );
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("relay-microsoft-client");
    expect(url.searchParams.get("scope")).toBe(
      MICROSOFT_TO_DO_SCOPES.join(" "),
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/microsoft-to-do/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-microsoft-secret");
  });

  it("registers Microsoft Lists with exactly four selected-list approved-field reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("microsoft-lists");
    expect(manifest).toBe(MICROSOFT_LISTS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      requiredScopes: MICROSOFT_LISTS_SCOPES,
      pkce: true,
      supportsRefresh: true,
      authority: { provider: "microsoft", defaultMode: "multi_tenant_org" },
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "microsoft_lists_list_get",
      "microsoft_lists_columns_list",
      "microsoft_lists_items_list",
      "microsoft_lists_item_get",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "microsoft_lists_safe",
      "dangerously_skip_permissions",
    ]);
  });

  it("starts selected-list Microsoft Lists OAuth with exact scope, encrypted binding, PKCE, and no persisted client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "relay-microsoft-client",
      MICROSOFT_CLIENT_SECRET: "relay-microsoft-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "microsoft-lists",
      {
        selectedCapabilities: ["selected_list_metadata", "approved_list_items"],
        selectedSiteId: "contoso.sharepoint.com,site-collection,site-web",
        selectedListId: "list-001",
        selectedListWebUrl:
          "https://contoso.sharepoint.com/sites/product/Lists/Launch",
        selectedListDisplayName: "Launch Tracker",
        allowedFieldNames: ["Title", "Status"],
      },
    );
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("relay-microsoft-client");
    expect(url.searchParams.get("scope")).toBe(
      MICROSOFT_LISTS_SCOPES.join(" "),
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/microsoft-lists/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.providerSessionCiphertext).toBeTruthy();
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("Launch Tracker");
    expect(JSON.stringify(state)).not.toContain("relay-microsoft-secret");
  });

  it("registers OneNote with exactly four signed-in-user metadata reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("onenote");
    expect(manifest).toBe(ONENOTE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      requiredScopes: ONENOTE_SCOPES,
      pkce: true,
      supportsRefresh: true,
      authority: { provider: "microsoft", defaultMode: "multi_tenant_common" },
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "onenote_notebooks_list",
      "onenote_notebook_sections_list",
      "onenote_section_pages_list",
      "onenote_page_get",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "onenote_safe",
      "dangerously_skip_permissions",
    ]);
  });

  it("starts OneNote OAuth with exact delegated scope, common authority, PKCE, and no persisted client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "relay-microsoft-client",
      MICROSOFT_CLIENT_SECRET: "relay-microsoft-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "onenote",
      { selectedCapabilities: ["notebook_structure", "page_metadata"] },
    );
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("relay-microsoft-client");
    expect(url.searchParams.get("scope")).toBe(ONENOTE_SCOPES.join(" "));
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/onenote/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-microsoft-secret");
  });

  it("registers Microsoft Bookings with exactly four selected-business privacy-scrubbed reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get(
      "microsoft-bookings",
    );
    expect(manifest).toBe(MICROSOFT_BOOKINGS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      requiredScopes: MICROSOFT_BOOKINGS_SCOPES,
      pkce: true,
      supportsRefresh: true,
      authority: { provider: "microsoft", defaultMode: "multi_tenant_org" },
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "microsoft_bookings_business_get",
      "microsoft_bookings_services_list",
      "microsoft_bookings_service_get",
      "microsoft_bookings_calendar_view",
    ]);
    expect(manifest?.tools.every((tool) => !tool.approvalRequired)).toBe(true);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "microsoft_bookings_safe",
      "dangerously_skip_permissions",
    ]);
  });

  it("starts selected-business Microsoft Bookings OAuth with exact scope, encrypted binding, PKCE, and no persisted client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "relay-microsoft-client",
      MICROSOFT_CLIENT_SECRET: "relay-microsoft-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "microsoft-bookings",
      {
        selectedCapabilities: ["business_services", "calendar_view"],
        selectedBusinessId: "contoso@contoso.com",
        selectedBusinessDisplayName: "Contoso Consultations",
      },
    );
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("scope")).toBe(
      MICROSOFT_BOOKINGS_SCOPES.join(" "),
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/microsoft-bookings/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.providerSessionCiphertext).toBeTruthy();
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("Contoso Consultations");
    expect(JSON.stringify(state)).not.toContain("relay-microsoft-secret");
  });

  it("registers Microsoft Power BI with exactly four selected-workspace metadata reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get(
      "microsoft-power-bi",
    );
    expect(manifest).toBe(MICROSOFT_POWER_BI_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      requiredScopes: MICROSOFT_POWER_BI_SCOPES,
      pkce: true,
      supportsRefresh: true,
      authority: { provider: "microsoft", defaultMode: "multi_tenant_org" },
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "microsoft_power_bi_workspace_get",
      "microsoft_power_bi_reports_list",
      "microsoft_power_bi_semantic_models_list",
      "microsoft_power_bi_semantic_model_get",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "microsoft_power_bi_safe",
      "dangerously_skip_permissions",
    ]);
  });
  it("starts selected-workspace Microsoft Power BI OAuth with exact scopes, encrypted binding, PKCE, and no persisted client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "relay-microsoft-client",
      MICROSOFT_CLIENT_SECRET: "relay-microsoft-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "microsoft-power-bi",
      {
        selectedCapabilities: ["workspace_reports", "semantic_models"],
        selectedWorkspaceId: "f089354e-8366-4e18-aea3-4cb4a3a50b48",
        selectedWorkspaceName: "Executive Analytics",
      },
    );
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("scope")).toBe(
      MICROSOFT_POWER_BI_SCOPES.join(" "),
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/microsoft-power-bi/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.providerSessionCiphertext).toBeTruthy();
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("Executive Analytics");
    expect(JSON.stringify(state)).not.toContain("relay-microsoft-secret");
  });

  it("registers Microsoft Dynamics 365 with exactly four selected-environment GET reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get(
      "microsoft-dynamics-365",
    );
    expect(manifest).toBe(MICROSOFT_DYNAMICS_365_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      requiredScopes: MICROSOFT_DYNAMICS_365_SCOPES,
      pkce: true,
      supportsRefresh: true,
      authority: { provider: "microsoft", defaultMode: "multi_tenant_org" },
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "microsoft_dynamics_365_organization_get",
      "microsoft_dynamics_365_accounts_list",
      "microsoft_dynamics_365_account_get",
      "microsoft_dynamics_365_opportunities_list",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "microsoft_dynamics_365_safe",
      "dangerously_skip_permissions",
    ]);
  });

  it("keeps Microsoft Loop visible but unavailable without inventing an API", () => {
    const registry = new MarketplaceConnectorRegistry();
    const catalog = MARKETPLACE_CATALOG.find(
      (item) => item.slug === "microsoft-loop",
    );
    expect(registry.get("microsoft-loop")).toBeNull();
    expect(catalog).toMatchObject({
      availability: "unsupported",
      connectionTypes: ["no_supported_direct_account_interface"],
      credentialRequirements: [],
      capabilities: [],
      allowedActions: [],
      approvalRequiredActions: [],
    });
    expect(catalog?.blockedActions.map((action) => action.id)).toEqual([
      "microsoft_loop_connect_account",
      "microsoft_loop_workspace_page_component_api",
      "microsoft_loop_driveitem_or_private_endpoint_workaround",
    ]);
    expect(catalog?.approvalProfiles).toEqual([
      expect.objectContaining({
        id: "microsoft_loop_unavailable",
        allowedActions: [],
        approvalRequiredActions: [],
      }),
    ]);
    expect(catalog?.runtimeSupport).toEqual([
      expect.objectContaining({
        format: "openclaw",
        installSupport: "unsupported",
      }),
      expect.objectContaining({
        format: "hermes",
        installSupport: "unsupported",
      }),
    ]);
  });

  it("keeps OpenCart Self-Hosted unavailable without exposing commerce mutations", () => {
    const registry = new MarketplaceConnectorRegistry();
    const catalog = MARKETPLACE_CATALOG.find(
      (item) => item.slug === "opencart-self-hosted",
    );
    expect(registry.get("opencart-self-hosted")).toBeNull();
    expect(catalog).toMatchObject({
      availability: "unsupported",
      connectionTypes: ["no_safe_supported_read_only_core_api"],
      credentialRequirements: [],
      capabilities: [],
      allowedActions: [],
      approvalRequiredActions: [],
    });
    expect(catalog?.blockedActions.map((action) => action.id)).toEqual([
      "opencart_self_hosted_connect_core_api",
      "opencart_self_hosted_order_subscription_workflows",
      "opencart_self_hosted_extension_or_private_api",
    ]);
    expect(catalog?.approvalProfiles).toEqual([
      expect.objectContaining({
        id: "opencart_self_hosted_unavailable",
        allowedActions: [],
        approvalRequiredActions: [],
      }),
    ]);
    expect(catalog?.runtimeSupport).toEqual([
      expect.objectContaining({
        format: "openclaw",
        installSupport: "unsupported",
      }),
      expect.objectContaining({
        format: "hermes",
        installSupport: "unsupported",
      }),
    ]);
  });

  it("keeps TYPO3 unavailable without assuming an optional API extension", () => {
    const registry = new MarketplaceConnectorRegistry();
    const catalog = MARKETPLACE_CATALOG.find((item) => item.slug === "typo3");
    expect(registry.get("typo3")).toBeNull();
    expect(catalog).toMatchObject({
      availability: "unsupported",
      connectionTypes: ["no_uniform_supported_core_remote_content_api"],
      credentialRequirements: [],
      capabilities: [],
      allowedActions: [],
      approvalRequiredActions: [],
    });
    expect(catalog?.blockedActions.map((action) => action.id)).toEqual([
      "typo3_connect_core_api",
      "typo3_assume_extension_api",
      "typo3_private_or_scraped_access",
    ]);
    expect(catalog?.approvalProfiles).toEqual([
      expect.objectContaining({
        id: "typo3_unavailable",
        allowedActions: [],
        approvalRequiredActions: [],
      }),
    ]);
    expect(catalog?.runtimeSupport).toEqual([
      expect.objectContaining({
        format: "openclaw",
        installSupport: "unsupported",
      }),
      expect.objectContaining({
        format: "hermes",
        installSupport: "unsupported",
      }),
    ]);
  });

  it("keeps ExpressionEngine unavailable without assuming an API add-on or custom template", () => {
    const registry = new MarketplaceConnectorRegistry();
    const catalog = MARKETPLACE_CATALOG.find(
      (item) => item.slug === "expressionengine",
    );
    expect(registry.get("expressionengine")).toBeNull();
    expect(catalog).toMatchObject({
      availability: "unsupported",
      connectionTypes: ["no_uniform_supported_core_remote_content_api"],
      credentialRequirements: [],
      capabilities: [],
      allowedActions: [],
      approvalRequiredActions: [],
    });
    expect(catalog?.blockedActions.map((action) => action.id)).toEqual([
      "expressionengine_connect_core_api",
      "expressionengine_assume_api_addon",
      "expressionengine_private_or_scraped_access",
    ]);
    expect(catalog?.approvalProfiles).toEqual([
      expect.objectContaining({
        id: "expressionengine_unavailable",
        allowedActions: [],
        approvalRequiredActions: [],
      }),
    ]);
    expect(catalog?.runtimeSupport).toEqual([
      expect.objectContaining({
        format: "openclaw",
        installSupport: "unsupported",
      }),
      expect.objectContaining({
        format: "hermes",
        installSupport: "unsupported",
      }),
    ]);
  });

  it("keeps retired Skype visible but unavailable without substituting Teams or ACS", () => {
    const registry = new MarketplaceConnectorRegistry();
    const catalog = MARKETPLACE_CATALOG.find((item) => item.slug === "skype");
    expect(registry.get("skype")).toBeNull();
    expect(catalog).toMatchObject({
      availability: "unsupported",
      connectionTypes: ["retired_product_no_supported_api"],
      credentialRequirements: [],
      capabilities: [],
      allowedActions: [],
      approvalRequiredActions: [],
    });
    expect(catalog?.blockedActions.map((action) => action.id)).toEqual([
      "skype_connect_retired_service",
      "skype_contacts_chats_calls_api",
      "skype_teams_acs_sfb_substitution",
      "skype_export_portal_private_automation",
    ]);
    expect(catalog?.approvalProfiles).toEqual([
      expect.objectContaining({
        id: "skype_unavailable",
        allowedActions: [],
        approvalRequiredActions: [],
      }),
    ]);
    expect(catalog?.runtimeSupport).toEqual([
      expect.objectContaining({
        format: "openclaw",
        installSupport: "unsupported",
      }),
      expect.objectContaining({
        format: "hermes",
        installSupport: "unsupported",
      }),
    ]);
  });

  it("keeps Xbox visible but unavailable without inventing a consumer API", () => {
    const registry = new MarketplaceConnectorRegistry();
    const catalog = MARKETPLACE_CATALOG.find((item) => item.slug === "xbox");
    expect(registry.get("xbox")).toBeNull();
    expect(catalog).toMatchObject({
      availability: "unsupported",
      connectionTypes: ["title_publisher_scoped_no_general_consumer_api"],
      credentialRequirements: [],
      capabilities: [],
      allowedActions: [],
      approvalRequiredActions: [],
    });
    expect(catalog?.blockedActions.map((action) => action.id)).toEqual([
      "xbox_connect_consumer_account",
      "xbox_profile_social_achievements_api",
      "xbox_title_publisher_service_substitution",
      "xbox_private_xsts_or_scraping",
    ]);
    expect(catalog?.approvalProfiles).toEqual([
      expect.objectContaining({
        id: "xbox_unavailable",
        allowedActions: [],
        approvalRequiredActions: [],
      }),
    ]);
    expect(catalog?.runtimeSupport).toEqual([
      expect.objectContaining({
        format: "openclaw",
        installSupport: "unsupported",
      }),
      expect.objectContaining({
        format: "hermes",
        installSupport: "unsupported",
      }),
    ]);
  });

  it("registers Zoom with exactly four self-user meeting metadata GET reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("zoom");
    const catalog = MARKETPLACE_CATALOG.find((item) => item.slug === "zoom");
    expect(manifest).toBe(ZOOM_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      requiredScopes: ZOOM_SCOPES,
      pkce: false,
      supportsRefresh: true,
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "zoom_scheduled_meetings_list",
      "zoom_live_meetings_list",
      "zoom_upcoming_meetings_list",
      "zoom_meeting_get",
    ]);
    expect(manifest?.tools.every((tool) => tool.action === "read")).toBe(true);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "zoom_safe",
      "dangerously_skip_permissions",
    ]);
    expect(catalog).toMatchObject({
      availability: "available",
      credentialRequirements: [],
      allowedActions: expect.arrayContaining([
        expect.objectContaining({ id: "zoom_scheduled_meetings_list" }),
        expect.objectContaining({ id: "zoom_meeting_get" }),
      ]),
      approvalRequiredActions: [],
    });
  });

  it("starts Zoom user-managed OAuth with exact granular reads and no persisted client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      ZOOM_CLIENT_ID: "relay-zoom-client",
      ZOOM_CLIENT_SECRET: "relay-zoom-secret",
    });
    const started = await service.startOAuth("workspace_1", "user_1", "zoom", {
      selectedCapabilities: [
        "scheduled_meetings",
        "upcoming_meetings",
        "meeting_get",
      ],
    });
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe("https://zoom.us/oauth/authorize");
    expect(url.searchParams.get("scope")).toBe(ZOOM_SCOPES.join(" "));
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/zoom/callback",
    );
    expect(url.searchParams.has("code_challenge")).toBe(false);
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.clientId).toBe("relay-zoom-client");
    expect(state.clientSecretCiphertext).toBeNull();
    expect(state.scopes).toEqual(ZOOM_SCOPES);
    expect(JSON.stringify(state)).not.toContain("relay-zoom-secret");
  });

  it("registers Discord with exactly four selected-guild/channel GET reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("discord");
    const catalog = MARKETPLACE_CATALOG.find((item) => item.slug === "discord");
    expect(manifest).toBe(DISCORD_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({ type: "api_key" });
    expect(DISCORD_BOT_PERMISSIONS).toBe("66560");
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "discord_bot_get",
      "discord_selected_guild_get",
      "discord_selected_guild_channels_list",
      "discord_selected_channel_messages_list",
    ]);
    expect(manifest?.tools.every((tool) => tool.action === "read")).toBe(true);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "discord_safe",
      "dangerously_skip_permissions",
    ]);
    expect(catalog).toMatchObject({
      availability: "available",
      credentialRequirements: [],
      allowedActions: expect.arrayContaining([
        expect.objectContaining({ id: "discord_bot_get" }),
        expect.objectContaining({
          id: "discord_selected_channel_messages_list",
        }),
      ]),
      approvalRequiredActions: [],
    });
  });

  it("keeps Reddit visible but unavailable until commercial AI rights and architecture are approved", () => {
    const registry = new MarketplaceConnectorRegistry();
    const catalog = MARKETPLACE_CATALOG.find((item) => item.slug === "reddit");
    expect(registry.get("reddit")).toBeNull();
    expect(catalog).toMatchObject({
      availability: "unsupported",
      connectionTypes: ["written_commercial_ai_approval_required"],
      credentialRequirements: [],
      capabilities: [],
      allowedActions: [],
      approvalRequiredActions: [],
    });
    expect(catalog?.blockedActions.map((action) => action.id)).toEqual([
      "reddit_connect_without_approved_rights",
      "reddit_data_api_content_processing",
      "reddit_devvit_external_connector_substitution",
      "reddit_search_write_moderate_message_scrape",
    ]);
    expect(catalog?.approvalProfiles).toEqual([
      expect.objectContaining({
        id: "reddit_unavailable",
        allowedActions: [],
        approvalRequiredActions: [],
      }),
    ]);
    expect(catalog?.runtimeSupport).toEqual([
      expect.objectContaining({
        format: "openclaw",
        installSupport: "unsupported",
      }),
      expect.objectContaining({
        format: "hermes",
        installSupport: "unsupported",
      }),
    ]);
  });

  it("registers Microsoft Viva Engage with exactly four selected-community GET reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get(
      "microsoft-viva-engage",
    );
    expect(manifest).toBe(MICROSOFT_VIVA_ENGAGE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      requiredScopes: MICROSOFT_VIVA_ENGAGE_SCOPES,
      pkce: true,
      supportsRefresh: true,
      authority: { provider: "microsoft", defaultMode: "multi_tenant_org" },
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "microsoft_viva_engage_network_get",
      "microsoft_viva_engage_current_user_get",
      "microsoft_viva_engage_my_communities_list",
      "microsoft_viva_engage_selected_community_messages_list",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "microsoft_viva_engage_safe",
      "dangerously_skip_permissions",
    ]);
  });

  it("starts selected-community Viva Engage OAuth with the Entra Yammer resource scope and encrypted binding", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "relay-microsoft-client",
      MICROSOFT_CLIENT_SECRET: "relay-microsoft-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "microsoft-viva-engage",
      {
        selectedCapabilities: [
          "network_current_user",
          "communities",
          "selected_community_messages",
        ],
        selectedCommunityId: "3001",
        selectedCommunityName: "Product Launch",
      },
    );
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("scope")).toBe(
      "offline_access https://www.yammer.com/.default",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/microsoft-viva-engage/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.providerSessionCiphertext).toBeTruthy();
    expect(state.clientSecretCiphertext).toBeNull();
    expect(state.scopes).toEqual([
      "offline_access",
      "https://www.yammer.com/.default",
    ]);
    expect(JSON.stringify(state)).not.toContain("Product Launch");
    expect(JSON.stringify(state)).not.toContain("relay-microsoft-secret");
  });

  it("starts selected-environment Microsoft Dynamics 365 OAuth with an exact resource scope, encrypted binding, PKCE, and no persisted client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "relay-microsoft-client",
      MICROSOFT_CLIENT_SECRET: "relay-microsoft-secret",
    });
    const environmentOrigin = "https://contoso.api.crm.dynamics.com";
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "microsoft-dynamics-365",
      {
        selectedCapabilities: ["organization_accounts", "opportunities"],
        selectedEnvironmentOrigin: environmentOrigin,
        selectedEnvironmentDisplayName: "Contoso Sales",
      },
    );
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("scope")).toBe(
      `offline_access ${environmentOrigin}/user_impersonation`,
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/microsoft-dynamics-365/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.providerSessionCiphertext).toBeTruthy();
    expect(state.clientSecretCiphertext).toBeNull();
    expect(state.scopes).toEqual([
      "offline_access",
      `${environmentOrigin}/user_impersonation`,
    ]);
    expect(JSON.stringify(state)).not.toContain("Contoso Sales");
    expect(JSON.stringify(state)).not.toContain("relay-microsoft-secret");
  });

  it("registers Inoreader as shared Relay-owned read-write OAuth", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("inoreader");

    expect(manifest).toBe(INOREADER_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://www.inoreader.com/oauth2/auth",
        tokenUrl: "https://www.inoreader.com/oauth2/token",
        requiredScopes: ["read", "write"],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("inoreader", "inoreader_full_api")?.name).toBe(
      "inoreader.request",
    );
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("starts Inoreader OAuth from Railway variables without persisting the App Key", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      INOREADER_CLIENT_ID: "railway-app-id",
      INOREADER_CLIENT_SECRET: "railway-app-key",
    });

    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "inoreader",
      { returnTo: "https://relayconsole.work/app?marketplace_app=inoreader" },
    );

    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://www.inoreader.com/oauth2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("railway-app-id");
    expect(url.searchParams.get("scope")).toBe("read write");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/inoreader/callback",
    );
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeNull();
    expect(savedState.clientSecretIv).toBeNull();
    expect(JSON.stringify(savedState)).not.toContain("railway-app-key");
  });

  it("registers Guru as shared Relay-owned read-write OAuth", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("guru");

    expect(manifest).toBe(GURU_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://api.getguru.com/oauth/authorize",
        tokenUrl: "https://api.getguru.com/oauth/token",
        requiredScopes: ["default"],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("guru", "guru_full_api")?.name).toBe(
      "guru.request",
    );
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("starts Guru OAuth from Railway variables without persisting the client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      GURU_CLIENT_ID: "railway-guru-client",
      GURU_CLIENT_SECRET: "railway-guru-secret",
    });

    const result = await service.startOAuth("workspace_1", "user_1", "guru", {
      returnTo: "https://relayconsole.work/app?marketplace_app=guru",
    });

    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://api.getguru.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("railway-guru-client");
    expect(url.searchParams.get("scope")).toBe("default");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/guru/callback",
    );
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeNull();
    expect(savedState.clientSecretIv).toBeNull();
    expect(JSON.stringify(savedState)).not.toContain("railway-guru-secret");
  });

  it("registers Slite as shared hosted-MCP OAuth with Safe and Dangerous policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("slite");

    expect(manifest).toBe(SLITE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://slite.com/api/mcp/oauth/auth",
        tokenUrl: "https://slite.com/api/mcp/oauth/token",
        requiredScopes: [
          "openid",
          "email",
          "mcp:read",
          "mcp:write",
          "offline_access",
        ],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("slite", "slite_mcp_read")?.name).toBe(
      "slite.read",
    );
    expect(registry.getTool("slite", "slite_mcp_write")?.approvalRequired).toBe(
      true,
    );
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Slab as a shared customer-token GraphQL connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("slab");

    expect(manifest).toBe(SLAB_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema).toEqual([
      expect.objectContaining({ name: "SLAB_API_TOKEN", secret: true }),
    ]);
    expect(registry.getTool("slab", "slab_graphql_query")?.name).toBe(
      "slab.query",
    );
    expect(
      registry.getTool("slab", "slab_graphql_mutation")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Healthie as a shared customer-key GraphQL connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("healthie");

    expect(manifest).toBe(HEALTHIE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema).toEqual([
      expect.objectContaining({ name: "HEALTHIE_API_KEY", secret: true }),
      expect.objectContaining({
        name: "HEALTHIE_AUTHORIZATION_SHARD",
        required: false,
        secret: true,
      }),
    ]);
    expect(registry.getTool("healthie", "healthie_graphql_query")?.name).toBe(
      "healthie.query",
    );
    expect(
      registry.getTool("healthie", "healthie_graphql_mutation")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Strategic Roadmaps as a region-bound customer-token GraphQL connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("roadmunk");

    expect(manifest).toBe(ROADMUNK_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "ROADMUNK_API_TOKEN", secret: true }),
        expect.objectContaining({ name: "ROADMUNK_REGION", secret: false }),
      ]),
    );
    expect(registry.getTool("roadmunk", "roadmunk_graphql_query")?.name).toBe(
      "roadmunk.query",
    );
    expect(
      registry.getTool("roadmunk", "roadmunk_graphql_mutation")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Shortcut as a fixed-origin customer-token REST connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("shortcut");

    expect(manifest).toBe(SHORTCUT_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema).toEqual([
      expect.objectContaining({ name: "SHORTCUT_API_TOKEN", secret: true }),
    ]);
    expect(registry.getTool("shortcut", "shortcut_api_read")?.name).toBe(
      "shortcut.read",
    );
    expect(
      registry.getTool("shortcut", "shortcut_api_write")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Hive as a fixed-origin customer-key REST connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("hive");

    expect(manifest).toBe(HIVE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema).toEqual([
      expect.objectContaining({ name: "HIVE_API_KEY", secret: true }),
      expect.objectContaining({ name: "HIVE_USER_ID", secret: false }),
    ]);
    expect(registry.getTool("hive", "hive_api_read")?.name).toBe("hive.read");
    expect(registry.getTool("hive", "hive_api_write")?.approvalRequired).toBe(
      true,
    );
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Nifty as Relay-owned OAuth with Safe and Dangerous policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("nifty");
    expect(manifest).toBe(NIFTY_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      tokenUrl: "https://openapi.niftypm.com/oauth/token",
      pkce: false,
      supportsRefresh: true,
    });
    expect(manifest?.auth.oauth?.requiredScopes).toEqual(NIFTY_REQUIRED_SCOPES);
    expect(registry.getTool("nifty", "nifty_api_read")?.name).toBe(
      "nifty.read",
    );
    expect(
      registry.getTool("nifty", "nifty_api_manage")?.approvalRequired,
    ).toBe(true);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("registers Paymo as a fixed-origin customer-key REST connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("paymo");

    expect(manifest).toBe(PAYMO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema).toEqual([
      expect.objectContaining({ name: "PAYMO_API_KEY", secret: true }),
    ]);
    expect(registry.getTool("paymo", "paymo_api_read")?.name).toBe(
      "paymo.read",
    );
    expect(
      registry.getTool("paymo", "paymo_api_manage")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers ProofHub as an account-pinned customer-key REST connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("proofhub");

    expect(manifest).toBe(PROOFHUB_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema).toEqual([
      expect.objectContaining({ name: "PROOFHUB_ACCOUNT", secret: false }),
      expect.objectContaining({ name: "PROOFHUB_API_KEY", secret: true }),
    ]);
    expect(registry.getTool("proofhub", "proofhub_api_read")?.name).toBe(
      "proofhub.read",
    );
    expect(
      registry.getTool("proofhub", "proofhub_api_manage")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers MeisterTask as Relay-owned OAuth with Safe and Dangerous policies", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("meistertask");
    expect(manifest).toBe(MEISTERTASK_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      authorizationUrl: "https://www.mindmeister.com/oauth2/authorize",
      tokenUrl: "https://www.mindmeister.com/oauth2/token",
      revocationUrl: "https://www.mindmeister.com/oauth2/revoke",
      pkce: false,
      supportsRefresh: false,
    });
    expect(manifest?.auth.oauth?.requiredScopes).toEqual(MEISTERTASK_SCOPES);
    expect(registry.getTool("meistertask", "meistertask_api_read")?.name).toBe(
      "meistertask.read",
    );
    expect(
      registry.getTool("meistertask", "meistertask_api_manage")
        ?.approvalRequired,
    ).toBe(true);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);

    const { service, oauthStateRepo } = connectorOAuthHarness({
      MEISTERTASK_CLIENT_ID: "relay-meistertask-client",
      MEISTERTASK_CLIENT_SECRET: "fixture-meistertask-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "meistertask",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=meistertask",
        selectedCapabilities: [
          "work_management_read",
          "work_management_manage",
        ],
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://www.mindmeister.com/oauth2/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("relay-meistertask-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/meistertask/callback",
    );
    expect(url.searchParams.get("scope")).toBe(MEISTERTASK_SCOPES.join(" "));
    expect(url.searchParams.has("code_challenge")).toBe(false);
    const saved = oauthStateRepo.save.mock.calls[0][0];
    expect(JSON.stringify(saved)).not.toContain("fixture-meistertask-secret");

    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "access-token" }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 42,
          name: "Ada",
          email: "ada@example.com",
        }),
      } as any);
    await service.exchangeToken("meistertask", {
      grant_type: "authorization_code",
      code: "provider-code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/meistertask/callback",
      client_id: "relay-meistertask-client",
      client_secret: "fixture-meistertask-secret",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.mindmeister.com/oauth2/token",
    );
    const tokenRequest = fetchMock.mock.calls[0][1] as any;
    expect(tokenRequest.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(tokenRequest.body.toString()).toContain(
      "client_secret=fixture-meistertask-secret",
    );
    const profile = await service.fetchProviderProfile(
      "meistertask",
      "access-token",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://www.meistertask.com/api/persons/me",
    );
    expect(
      service.buildMetadata(
        "meistertask",
        "relay-meistertask-client",
        [...MEISTERTASK_SCOPES],
        profile,
      ),
    ).toEqual(
      expect.objectContaining({
        meisterTaskPersonId: "42",
        displayName: "Ada",
        userVerified: true,
        fixedEndpointsOnly: true,
      }),
    );
  });

  it("registers Nozbe as a customer-token connector with Safe and Dangerous policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("nozbe");
    expect(manifest).toBe(NOZBE_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "NOZBE_API_TOKEN",
          secret: true,
          storedIn: "encrypted_secret",
        }),
      ],
    });
    expect(registry.getTool("nozbe", "nozbe_api_read")?.name).toBe(
      "nozbe.read",
    );
    expect(
      registry.getTool("nozbe", "nozbe_api_manage")?.approvalRequired,
    ).toBe(true);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("registers Habitica as a two-field customer-token connector with Safe and Dangerous policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("habitica");
    expect(manifest).toBe(HABITICA_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "HABITICA_USER_ID",
          secret: false,
          storedIn: "metadata",
        }),
        expect.objectContaining({
          name: "HABITICA_API_TOKEN",
          secret: true,
          storedIn: "encrypted_secret",
        }),
      ],
    });
    expect(registry.getTool("habitica", "habitica_api_read")?.name).toBe(
      "habitica.read",
    );
    expect(
      registry.getTool("habitica", "habitica_api_manage")?.approvalRequired,
    ).toBe(true);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("registers Amazing Marvin as a two-token connector with Safe and Dangerous policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("amazing-marvin");
    expect(manifest).toBe(AMAZING_MARVIN_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "AMAZING_MARVIN_API_TOKEN",
          secret: true,
          storedIn: "encrypted_secret",
        }),
        expect.objectContaining({
          name: "AMAZING_MARVIN_FULL_ACCESS_TOKEN",
          secret: true,
          storedIn: "encrypted_secret",
        }),
      ],
    });
    expect(
      registry.getTool("amazing-marvin", "amazing_marvin_api_read")?.name,
    ).toBe("amazing-marvin.read");
    expect(
      registry.getTool("amazing-marvin", "amazing_marvin_api_manage")
        ?.approvalRequired,
    ).toBe(true);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("registers Motion as a customer-key connector with Safe and Dangerous policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("motion");
    expect(manifest).toBe(MOTION_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "MOTION_API_KEY",
          secret: true,
          storedIn: "encrypted_secret",
        }),
      ],
    });
    expect(registry.getTool("motion", "motion_api_read")?.name).toBe(
      "motion.read",
    );
    expect(
      registry.getTool("motion", "motion_api_manage")?.approvalRequired,
    ).toBe(true);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("registers Reclaim.ai as a customer-key connector with Safe and Dangerous policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("reclaim-ai");
    expect(manifest).toBe(RECLAIM_AI_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "RECLAIM_AI_API_KEY",
          secret: true,
          storedIn: "encrypted_secret",
        }),
      ],
    });
    expect(registry.getTool("reclaim-ai", "reclaim_ai_api_read")?.name).toBe(
      "reclaim-ai.read",
    );
    expect(
      registry.getTool("reclaim-ai", "reclaim_ai_api_manage")?.approvalRequired,
    ).toBe(true);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("registers SavvyCal as Relay-owned OAuth with Safe and Dangerous policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("savvycal");
    expect(manifest).toBe(SAVVYCAL_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://savvycal.com/oauth/authorize",
        tokenUrl: "https://savvycal.com/oauth/token",
        requiredScopes: [],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("savvycal", "savvycal_api_read")?.name).toBe(
      "savvycal.read",
    );
    expect(
      registry.getTool("savvycal", "savvycal_api_manage")?.approvalRequired,
    ).toBe(true);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("registers YouCanBookMe as a customer-key connector with Safe and Dangerous policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("youcanbookme");
    expect(manifest).toBe(YOUCANBOOKME_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "YOUCANBOOKME_ACCOUNT_ID",
      "YOUCANBOOKME_API_KEY",
    ]);
    expect(
      registry.getTool("youcanbookme", "youcanbookme_api_read")?.name,
    ).toBe("youcanbookme.read");
    expect(
      registry.getTool("youcanbookme", "youcanbookme_api_manage")
        ?.approvalRequired,
    ).toBe(true);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("registers Akiflow as a public PKCE hosted-MCP connector", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("akiflow");
    expect(manifest).toBe(AKIFLOW_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://web.akiflow.com/oauth/authorize",
        tokenUrl: "https://web.akiflow.com/oauth/token",
        requiredScopes: [...AKIFLOW_SCOPES],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.auth.credentialSchema).toEqual([
      expect.objectContaining({
        name: "AKIFLOW_CLIENT_ID",
        secret: false,
        storedIn: "metadata",
      }),
    ]);
    expect(registry.getTool("akiflow", "akiflow_mcp_read")?.name).toBe(
      "akiflow.read",
    );
    expect(
      registry.getTool("akiflow", "akiflow_mcp_manage")?.approvalRequired,
    ).toBe(true);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
    const { service, oauthStateRepo } = connectorOAuthHarness({
      AKIFLOW_CLIENT_ID: "akiflow-public-client",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "akiflow",
      "sunsama",
      "motion",
      "reclaim-ai",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=akiflow",
      },
    );
    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://web.akiflow.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("akiflow-public-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/akiflow/callback",
    );
    expect(url.searchParams.get("scope")).toBe(AKIFLOW_SCOPES.join(" "));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeNull();
  });

  it("registers Sunsama as a public PKCE hosted-MCP connector", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("sunsama");
    expect(manifest).toBe(SUNSAMA_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://api.sunsama.com/oauth/authorize",
        tokenUrl: "https://api.sunsama.com/oauth/token",
        requiredScopes: [...SUNSAMA_SCOPES],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.auth.credentialSchema).toEqual([
      expect.objectContaining({
        name: "SUNSAMA_CLIENT_ID",
        secret: false,
        storedIn: "metadata",
      }),
    ]);
    expect(registry.getTool("sunsama", "sunsama_mcp_read")?.name).toBe(
      "sunsama.read",
    );
    expect(
      registry.getTool("sunsama", "sunsama_mcp_read_tasks_for_day")?.name,
    ).toBe("sunsama.tasksForDay");
    expect(
      registry.getTool("sunsama", "sunsama_mcp_manage")?.approvalRequired,
    ).toBe(true);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
    const { service, oauthStateRepo } = connectorOAuthHarness({
      SUNSAMA_CLIENT_ID: "sunsama-public-client",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "sunsama",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=sunsama",
      },
    );
    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://api.sunsama.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("sunsama-public-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/sunsama/callback",
    );
    expect(url.searchParams.get("scope")).toBe(SUNSAMA_SCOPES.join(" "));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("resource")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeNull();
  });

  it("starts Nifty OAuth from its app-specific URL without exposing secrets", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      NIFTY_CLIENT_ID: "relay-nifty-client",
      NIFTY_CLIENT_SECRET: "fixture-nifty-secret",
      NIFTY_AUTHORIZATION_URL:
        "https://app.niftypm.com/oauth/authorize/custom-app?scope=project%20task",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "nifty", {
      returnTo: "https://relayconsole.work/app?marketplace_app=nifty",
      selectedCapabilities: ["work_management_read", "work_management_manage"],
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://app.niftypm.com/oauth/authorize/custom-app",
    );
    expect(url.searchParams.get("scope")).toBe("project task");
    expect(url.searchParams.get("client_id")).toBe("relay-nifty-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/nifty/callback",
    );
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(url.searchParams.has("client_secret")).toBe(false);
    const saved = oauthStateRepo.save.mock.calls[0][0];
    expect(JSON.stringify(saved)).not.toContain("fixture-nifty-secret");
  });

  it("starts Square Appointments server OAuth and exchanges tokens as versioned JSON", async () => {
    const { service } = connectorOAuthHarness({
      SQUARE_APPOINTMENTS_CLIENT_ID: "square-app-id",
      SQUARE_APPOINTMENTS_CLIENT_SECRET: "square-app-secret",
    });
    const manifest = new MarketplaceConnectorRegistry().get(
      "square-appointments",
    );
    expect(manifest).toBe(SQUARE_APPOINTMENTS_CONNECTOR_MANIFEST);
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "square-appointments",
      {
        returnTo:
          "https://relayconsole.work/app?marketplace_app=square-appointments",
      },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://connect.squareup.com/oauth2/authorize",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(
      SQUARE_APPOINTMENTS_SCOPES.join(" "),
    );
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/square-appointments/callback",
    );
    expect(authorizeUrl.searchParams.has("code_challenge")).toBe(false);
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "square-access",
        refresh_token: "square-refresh",
        expires_at: "2026-08-14T10:00:00Z",
        merchant_id: "merchant-1",
      }),
    } as any);
    const token = await service.exchangeToken("square-appointments", {
      grant_type: "authorization_code",
      code: "square-code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/square-appointments/callback",
      client_id: "square-app-id",
      client_secret: "square-app-secret",
    });
    expect(token.refresh_token).toBe("square-refresh");
    const [tokenUrl, tokenOptions] = fetchMock.mock.calls[0] as any;
    expect(tokenUrl).toBe("https://connect.squareup.com/oauth2/token");
    expect(tokenOptions.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        "Square-Version": "2026-05-20",
      }),
    );
    expect(JSON.parse(tokenOptions.body)).toEqual(
      expect.objectContaining({
        grant_type: "authorization_code",
        client_id: "square-app-id",
        client_secret: "square-app-secret",
      }),
    );
  });

  it("exchanges and validates Nifty OAuth with Basic client authentication", async () => {
    const { service } = connectorOAuthHarness();
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          scope: "project task",
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "nifty-user-1",
          name: "Ada",
          email: "ada@example.com",
        }),
      } as any);
    const token = await service.exchangeToken("nifty", {
      grant_type: "authorization_code",
      code: "provider-code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/nifty/callback",
      client_id: "relay-nifty-client",
      client_secret: "fixture-nifty-secret",
    });
    expect(token.refresh_token).toBe("refresh-token");
    const tokenRequest = fetchMock.mock.calls[0];
    const tokenOptions = tokenRequest[1] as any;
    expect(tokenRequest[0]).toBe("https://openapi.niftypm.com/oauth/token");
    expect(tokenOptions.headers.Authorization).toBe(
      `Basic ${Buffer.from("relay-nifty-client:fixture-nifty-secret").toString("base64")}`,
    );
    expect(JSON.parse(tokenOptions.body)).toEqual({
      grant_type: "authorization_code",
      code: "provider-code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/nifty/callback",
    });
    const profile = await service.fetchProviderProfile("nifty", "access-token");
    const metadata = service.buildMetadata(
      "nifty",
      "relay-nifty-client",
      [...NIFTY_REQUIRED_SCOPES],
      profile,
    );
    expect(metadata).toEqual(
      expect.objectContaining({
        niftyUserId: "nifty-user-1",
        displayName: "Ada",
        userVerified: true,
        pkceS256: false,
        rawToolsEnabled: false,
      }),
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://openapi.niftypm.com/api/v1.0/users/me",
    );
  });

  it("registers Relay-owned, site-bound Confluence OAuth and policies", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("confluence");
    expect(manifest).toBe(CONFLUENCE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      authorizationUrl: "https://auth.atlassian.com/authorize",
      tokenUrl: "https://auth.atlassian.com/oauth/token",
      pkce: false,
      supportsRefresh: true,
    });
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "confluence_safe",
      "dangerously_skip_permissions",
    ]);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
    expect(
      registry.getTool("confluence", "confluence_request")?.approvalRequired,
    ).toBe(true);
  });

  it("starts Relay-owned Productboard OAuth with exact callback, scopes, and PKCE", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      PRODUCTBOARD_CLIENT_ID: "relay-productboard-client",
      PRODUCTBOARD_CLIENT_SECRET: "fixture-productboard-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "productboard",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=productboard",
        selectedCapabilities: [
          "product_management_read",
          "product_management_manage",
        ],
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://app.productboard.com/oauth2/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("relay-productboard-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/productboard/callback",
    );
    expect(url.searchParams.get("scope")).toBe(
      PRODUCTBOARD_REQUIRED_SCOPES.join(" "),
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.has("client_secret")).toBe(false);
    const saved = oauthStateRepo.save.mock.calls[0][0];
    expect(saved.clientSecretCiphertext).toEqual(expect.any(String));
    expect(JSON.stringify(saved)).not.toContain("fixture-productboard-secret");
  });

  it("binds Productboard OAuth to the selected workspace and signed-in user", async () => {
    const { service } = connectorOAuthHarness();
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        application: { uid: "app-1" },
        resource_owner: {
          name: "Guybrush Threepwood",
          email: "guybrush@example.com",
        },
        space: { name: "Melee Island", domain: "melee-island" },
        scopes: [...PRODUCTBOARD_REQUIRED_SCOPES],
      }),
    } as any);
    const profile = await service.fetchProviderProfile(
      "productboard",
      "access-token",
    );
    const metadata = service.buildMetadata(
      "productboard",
      "relay-productboard-client",
      [...PRODUCTBOARD_REQUIRED_SCOPES],
      profile,
    );
    expect(metadata).toEqual(
      expect.objectContaining({
        productboardApplicationId: "app-1",
        productboardWorkspaceId: "melee-island",
        productboardWorkspaceName: "Melee Island",
        email: "guybrush@example.com",
        workspaceBound: true,
        pkceS256: true,
        automaticPagination: false,
        rawToolsEnabled: false,
      }),
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://app.productboard.com/oauth2/token/info?access_token=access-token",
    );
  });

  it("starts Relay-owned Aha! OAuth at the account chooser without exposing its secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      AHA_CLIENT_ID: "relay-aha-client",
      AHA_CLIENT_SECRET: "fixture-aha-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "aha", {
      returnTo: "https://relayconsole.work/app?marketplace_app=aha",
      selectedCapabilities: [
        "product_management_read",
        "product_management_manage",
      ],
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://secure.aha.io/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("relay-aha-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/aha/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    const saved = oauthStateRepo.save.mock.calls[0][0];
    expect(saved.clientSecretCiphertext).toEqual(expect.any(String));
    expect(JSON.stringify(saved)).not.toContain("fixture-aha-secret");
  });

  it("binds Aha! OAuth and profile checks to the callback account", async () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("aha")).toBe(AHA_CONNECTOR_MANIFEST);
    const { service } = connectorOAuthHarness();
    const authority = service.ahaAuthorityFromCallback("acme-roadmaps");
    expect(authority).toMatchObject({
      accountSubdomain: "acme-roadmaps",
      apiOrigin: "https://acme-roadmaps.aha.io",
      tokenUrl: "https://acme-roadmaps.aha.io/oauth/token",
    });
    expect(() => service.ahaAuthorityFromCallback("acme.aha.io")).toThrow(
      "invalid account subdomain",
    );
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: "user-1",
          name: "Elaine Marley",
          email: "elaine@example.com",
        },
      }),
    } as any);
    const profile = await service.fetchProviderProfile("aha", "access-token", {
      ahaAccountSubdomain: "acme-roadmaps",
    });
    const metadata = service.buildMetadata(
      "aha",
      "relay-aha-client",
      [],
      profile,
      { ahaAccountSubdomain: "acme-roadmaps" },
    );
    expect(metadata).toEqual(
      expect.objectContaining({
        ahaAccountSubdomain: "acme-roadmaps",
        ahaApiOrigin: "https://acme-roadmaps.aha.io",
        ahaUserId: "user-1",
        email: "elaine@example.com",
        accountBound: true,
        automaticPagination: false,
        rawToolsEnabled: false,
      }),
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://acme-roadmaps.aha.io/api/v1/me",
    );
  });

  it("registers customer-owned Quip OAuth with the complete Automation scopes", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("quip");
    expect(manifest).toBe(QUIP_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth?.requiredScopes).toEqual([
      "USER_READ",
      "USER_WRITE",
      "USER_MANAGE",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "quip_safe",
      "dangerously_skip_permissions",
    ]);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
    const { service, oauthStateRepo } = connectorOAuthHarness({});
    const result = await service.startOAuth("workspace_1", "user_1", "quip", {
      clientId: "customer-id",
      clientSecret: "fixture",
      selectedCapabilities: [
        "knowledge_read",
        "knowledge_write",
        "sharing_manage",
      ],
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://platform.quip.com/1/oauth/login",
    );
    expect(url.searchParams.get("client_id")).toBe("customer-id");
    expect(url.searchParams.get("client_secret")).toBe("fixture");
    expect(url.searchParams.has("scope")).toBe(false);
    expect(url.searchParams.get("state")).toBeTruthy();
    const saved = oauthStateRepo.save.mock.calls[0][0];
    expect(saved.clientSecretCiphertext).not.toContain("fixture");
    expect(JSON.stringify(saved)).not.toContain("fixture");
  });

  it("starts Slite public PKCE OAuth from Railway with MCP resource binding", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      SLITE_CLIENT_ID: "railway-slite-public-client",
    });

    const result = await service.startOAuth("workspace_1", "user_1", "slite", {
      returnTo: "https://relayconsole.work/app?marketplace_app=slite",
    });

    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://slite.com/api/mcp/oauth/auth",
    );
    expect(url.searchParams.get("client_id")).toBe(
      "railway-slite-public-client",
    );
    expect(url.searchParams.get("scope")).toBe(
      "openid email mcp:read mcp:write offline_access",
    );
    expect(url.searchParams.get("resource")).toBe("https://api.slite.com/mcp");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/slite/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("nonce")).toBeTruthy();
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeNull();
    expect(savedState.clientSecretIv).toBeNull();
  });

  it("registers Nuclino hosted-MCP OAuth with Safe and Dangerous policies", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("nuclino");
    expect(manifest).toBe(NUCLINO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      authorizationUrl: "https://api.nuclino.com/oauth/authorize",
      tokenUrl: "https://api.nuclino.com/oauth/token",
      requiredScopes: [],
      pkce: true,
      supportsRefresh: false,
    });
    expect(registry.getTool("nuclino", "nuclino_mcp_read")?.name).toBe(
      "nuclino.read",
    );
    expect(
      registry.getTool("nuclino", "nuclino_mcp_write")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);

    const { service, oauthStateRepo } = connectorOAuthHarness({
      NUCLINO_CLIENT_ID: "railway-nuclino-public-client",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "nuclino",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=nuclino",
      },
    );
    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://api.nuclino.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe(
      "railway-nuclino-public-client",
    );
    expect(url.searchParams.has("scope")).toBe(false);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/nuclino/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeNull();
    expect(savedState.clientSecretIv).toBeNull();
  });

  it("starts Scribe confidential PKCE OAuth from Railway-held dynamic credentials", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      SCRIBE_CLIENT_ID: "railway-scribe-client",
      SCRIBE_CLIENT_SECRET: "railway-scribe-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "scribe", {
      returnTo: "https://relayconsole.work/app?marketplace_app=scribe",
    });
    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe("https://mcp.scribe.com/authorize");
    expect(url.searchParams.get("client_id")).toBe("railway-scribe-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/scribe/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeTruthy();
    expect(savedState.clientSecretIv).toBeTruthy();
  });

  it("registers Document360 as a customer-token complete v2 connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("document360");
    expect(manifest).toBe(DOCUMENT360_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "DOCUMENT360_API_TOKEN",
          secret: true,
          required: true,
        }),
        expect.objectContaining({
          name: "DOCUMENT360_API_ORIGIN",
          secret: false,
          required: false,
        }),
      ]),
    );
    expect(
      registry.getTool("document360", "document360_get_article")?.name,
    ).toBe("document360.getArticle");
    expect(
      registry.getTool("document360", "document360_full_api")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Archbee as a customer-key complete Public API connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("archbee");
    expect(manifest).toBe(ARCHBEE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ARCHBEE_DOC_SPACE_ID",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "ARCHBEE_API_KEY",
          secret: true,
          required: true,
        }),
      ]),
    );
    expect(registry.getTool("archbee", "archbee_search_documents")?.name).toBe(
      "archbee.searchDocuments",
    );
    expect(
      registry.getTool("archbee", "archbee_full_api")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Tettra as a customer-key complete published API connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("tettra");
    expect(manifest).toBe(TETTRA_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "TETTRA_TEAM_ID",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "TETTRA_API_KEY",
          secret: true,
          required: true,
        }),
      ]),
    );
    expect(registry.getTool("tettra", "tettra_search")?.name).toBe(
      "tettra.search",
    );
    expect(
      registry.getTool("tettra", "tettra_create_page")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers KnowledgeOwl as a project-bound complete External API connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("knowledgeowl");
    expect(manifest).toBe(KNOWLEDGEOWL_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "KNOWLEDGEOWL_PROJECT_ID",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "KNOWLEDGEOWL_API_KEY",
          secret: true,
          required: true,
        }),
      ]),
    );
    expect(
      registry.getTool("knowledgeowl", "knowledgeowl_get_article")?.name,
    ).toBe("knowledgeowl.getArticle");
    expect(
      registry.getTool("knowledgeowl", "knowledgeowl_full_api")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Freshdesk as an exact-tenant customer API-key connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("freshdesk");
    expect(manifest).toBe(FRESHDESK_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        expect.objectContaining({
          name: "FRESHDESK_DOMAIN",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "FRESHDESK_API_KEY",
          secret: true,
          required: true,
        }),
      ],
    });
    expect(registry.getTool("freshdesk", "freshdesk_get_ticket")?.name).toBe(
      "freshdesk.getTicket",
    );
    expect(
      registry.getTool("freshdesk", "freshdesk_full_api")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Scribe as a dynamically registered hosted-MCP OAuth connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("scribe");
    expect(manifest).toBe(SCRIBE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://mcp.scribe.com/authorize",
        tokenUrl: "https://mcp.scribe.com/token",
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "SCRIBE_CLIENT_ID",
          secret: false,
          required: true,
        }),
        expect.objectContaining({
          name: "SCRIBE_CLIENT_SECRET",
          secret: true,
          required: true,
        }),
      ]),
    );
    expect(registry.getTool("scribe", "scribe_mcp_read")?.name).toBe(
      "scribe.read",
    );
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Vidyard as a role-bound complete Dashboard API connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("vidyard");
    expect(manifest).toBe(VIDYARD_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "VIDYARD_API_TOKEN",
          secret: true,
          required: true,
        }),
      ]),
    );
    expect(registry.getTool("vidyard", "vidyard_get_video")?.name).toBe(
      "vidyard.getVideo",
    );
    expect(
      registry.getTool("vidyard", "vidyard_full_api")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Vimeo as a Relay-owned complete OAuth connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("vimeo");
    expect(manifest).toBe(VIMEO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://api.vimeo.com/oauth/authorize",
        tokenUrl: "https://api.vimeo.com/oauth/access_token",
        requiredScopes: [...VIMEO_SCOPES],
        pkce: false,
        supportsRefresh: false,
      }),
    );
    expect(registry.getTool("vimeo", "vimeo_get_video")?.name).toBe(
      "vimeo.getVideo",
    );
    expect(registry.getTool("vimeo", "vimeo_full_api")?.approvalRequired).toBe(
      true,
    );
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("starts Vimeo OAuth from Railway variables without persisting the client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      VIMEO_CLIENT_ID: "vimeo-client",
      VIMEO_CLIENT_SECRET: "vimeo-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "vimeo", {
      returnTo: "https://relayconsole.work/app?marketplace_app=vimeo",
    });
    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://api.vimeo.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("vimeo-client");
    expect(url.searchParams.get("scope")).toBe(VIMEO_SCOPES.join(" "));
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/vimeo/callback",
    );
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(savedState)).not.toContain("vimeo-secret");
  });

  it("registers Wistia as a Relay-owned refreshing OAuth connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("wistia");
    expect(manifest).toBe(WISTIA_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://app.wistia.com/oauth/authorize",
        tokenUrl: "https://api.wistia.com/oauth/token",
        requiredScopes: [...WISTIA_SCOPES],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("wistia", "wistia_search")?.name).toBe(
      "wistia.search",
    );
    expect(
      registry.getTool("wistia", "wistia_full_api")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("starts Wistia OAuth from Railway variables without exposing or persisting the client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      WISTIA_CLIENT_ID: "wistia-client",
      WISTIA_CLIENT_SECRET: "wistia-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "wistia", {
      returnTo: "https://relayconsole.work/app?marketplace_app=wistia",
    });
    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://app.wistia.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("wistia-client");
    expect(url.searchParams.has("scope")).toBe(false);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/wistia/callback",
    );
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(savedState)).not.toContain("wistia-secret");
  });

  it("registers Frame.io as a Relay-owned Adobe IMS OAuth connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("frame-io");
    expect(manifest).toBe(FRAME_IO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://ims-na1.adobelogin.com/ims/authorize/v2",
        tokenUrl: "https://ims-na1.adobelogin.com/ims/token/v3",
        requiredScopes: [...FRAME_IO_SCOPES],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("frame-io", "frame_io_search")?.name).toBe(
      "frameIo.search",
    );
    expect(
      registry.getTool("frame-io", "frame_io_full_api")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("starts Frame.io OAuth from Railway variables without exposing or persisting the client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      FRAME_IO_CLIENT_ID: "frame-client",
      FRAME_IO_CLIENT_SECRET: "frame-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "frame-io",
      { returnTo: "https://relayconsole.work/app?marketplace_app=frame-io" },
    );
    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://ims-na1.adobelogin.com/ims/authorize/v2",
    );
    expect(url.searchParams.get("client_id")).toBe("frame-client");
    expect(url.searchParams.get("scope")).toBe(FRAME_IO_SCOPES.join(" "));
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/frame-io/callback",
    );
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(savedState)).not.toContain("frame-secret");
  });

  it("registers Descript as a Drive-bound complete public API connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("descript");
    expect(manifest).toBe(DESCRIPT_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({
        type: "api_key",
        credentialSchema: expect.arrayContaining([
          expect.objectContaining({
            name: "DESCRIPT_API_TOKEN",
            secret: true,
            required: true,
          }),
        ]),
      }),
    );
    expect(registry.getTool("descript", "descript_get_project")?.name).toBe(
      "descript.getProject",
    );
    expect(
      registry.getTool("descript", "descript_full_api")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "descript_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual(
      expect.arrayContaining([
        "descript_import_media",
        "descript_agent_edit",
        "descript_publish",
        "descript_cancel_job",
        "descript_full_api",
      ]),
    );
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Rev with encrypted key-pair auth and approval-gated paid orders", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("rev");
    expect(manifest).toBe(REV_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({
        type: "api_key",
        credentialSchema: expect.arrayContaining([
          expect.objectContaining({
            name: "REV_CLIENT_API_KEY",
            secret: true,
            required: true,
          }),
          expect.objectContaining({
            name: "REV_USER_API_KEY",
            secret: true,
            required: true,
          }),
        ]),
      }),
    );
    expect(registry.getTool("rev", "rev_get_order")?.name).toBe("rev.getOrder");
    expect(registry.getTool("rev", "rev_full_api")?.approvalRequired).toBe(
      true,
    );
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "rev_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual(
      expect.arrayContaining([
        "rev_place_order",
        "rev_cancel_order",
        "rev_delete_order_data",
        "rev_create_share_link",
        "rev_full_api",
      ]),
    );
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Buzzsprout with exact-podcast binding and approval-gated episodes", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("buzzsprout");
    expect(manifest).toBe(BUZZSPROUT_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "BUZZSPROUT_API_TOKEN",
          secret: true,
          required: true,
        }),
        expect.objectContaining({
          name: "BUZZSPROUT_PODCAST_ID",
          secret: false,
          required: true,
        }),
      ]),
    );
    expect(registry.getTool("buzzsprout", "buzzsprout_podcast_get")?.name).toBe(
      "buzzsprout.getPodcast",
    );
    expect(
      registry.getTool("buzzsprout", "buzzsprout_episode_create")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "buzzsprout_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual([
      "buzzsprout_episode_list",
      "buzzsprout_episode_get",
      "buzzsprout_episode_create",
      "buzzsprout_episode_update",
    ]);
  });

  it("registers Captivate with exact-show binding and protected publishing", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("captivate-fm");
    expect(manifest).toBe(CAPTIVATE_FM_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "CAPTIVATE_API_KEY", secret: true }),
        expect.objectContaining({ name: "CAPTIVATE_USER_ID", secret: false }),
        expect.objectContaining({ name: "CAPTIVATE_SHOW_ID", secret: false }),
      ]),
    );
    expect(
      registry.getTool("captivate-fm", "captivate_episode_create")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "captivate_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual(
      expect.arrayContaining([
        "captivate_episode_read",
        "captivate_media_read",
        "captivate_analytics_read",
        "captivate_episode_create",
        "captivate_episode_update",
      ]),
    );
  });

  it("registers Transistor as exact-show read-only with protected reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("transistor-fm");
    expect(manifest).toBe(TRANSISTOR_FM_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "TRANSISTOR_API_KEY", secret: true }),
        expect.objectContaining({ name: "TRANSISTOR_SHOW_ID", secret: false }),
      ]),
    );
    expect(
      registry.getTool("transistor-fm", "transistor_episode_get")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "transistor_safe")
        ?.blockedActions.map((item) => item.id),
    ).toEqual(
      expect.arrayContaining([
        "transistor_publishing",
        "transistor_subscribers",
        "transistor_uploads_webhooks",
        "transistor_raw_api",
      ]),
    );
  });

  it("registers Riverside's complete bounded v3 Business API surface", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("riverside-fm");
    expect(manifest).toBe(RIVERSIDE_FM_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "RIVERSIDE_API_KEY", secret: true }),
      ]),
    );
    expect(manifest?.tools).toHaveLength(16);
    expect(
      registry.getTool("riverside-fm", "riverside_timeline_create")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "riverside_safe")
        ?.blockedActions.map((item) => item.id),
    ).toEqual(
      expect.arrayContaining([
        "riverside_webhook_management",
        "riverside_secret_exposure",
        "riverside_raw_api",
        "riverside_unbounded_transfer",
      ]),
    );
  });

  it("registers Restream's bounded OAuth and documented HTTP surface", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("restream");
    expect(manifest).toBe(RESTREAM_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://api.restream.io/login",
        tokenUrl: "https://api.restream.io/oauth/token",
        refreshUrl: "https://api.restream.io/oauth/token",
        revocationUrl: "https://api.restream.io/oauth/revoke",
        userInfoUrl: "https://api.restream.io/v2/user/profile",
        requiredScopes: [...RESTREAM_SCOPES],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools).toHaveLength(11);
    expect(
      registry.getTool("restream", "restream_documented_api_request")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "restream_safe")
        ?.blockedActions.map((item) => item.id),
    ).toEqual(
      expect.arrayContaining([
        "restream_secret_transport",
        "restream_live_websocket",
        "restream_credential_exposure",
        "restream_raw_or_unbounded",
      ]),
    );
  });

  it("registers Otter.ai as a public PKCE hosted-MCP connector", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("otter-ai");
    expect(manifest).toBe(OTTER_AI_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://otter.ai/oauth2/authorize",
        tokenUrl: "https://otter.ai/oauth/token",
        revocationUrl: "https://otter.ai/oauth/revoke_token",
        requiredScopes: ["profile:read", "conversations:read"],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("otter-ai", "otter_search")?.name).toBe(
      "otter.search",
    );
    expect(manifest?.tools).toHaveLength(3);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      OTTER_CLIENT_ID: "railway-otter-public-client",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "otter-ai",
      { returnTo: "https://relayconsole.work/app?marketplace_app=otter-ai" },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe("https://otter.ai/oauth2/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/otter-ai/callback",
    );
    expect(url.searchParams.get("scope")).toBe(
      "profile:read conversations:read",
    );
    expect(url.searchParams.get("resource")).toBe("https://mcp.otter.ai/");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Fireflies.ai as a public PKCE hosted-MCP connector", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("fireflies-ai");
    expect(manifest).toBe(FIREFLIES_AI_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://api.fireflies.ai/authorize",
        tokenUrl: "https://api.fireflies.ai/token",
        revocationUrl: "https://api.fireflies.ai/revoke",
        requiredScopes: ["profile", "email"],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("fireflies-ai", "fireflies_read")?.name).toBe(
      "fireflies.read",
    );
    expect(manifest?.tools).toHaveLength(2);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      FIREFLIES_CLIENT_ID: "railway-fireflies-public-client",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "fireflies-ai",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=fireflies-ai",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://api.fireflies.ai/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/fireflies-ai/callback",
    );
    expect(url.searchParams.get("scope")).toBe("profile email");
    expect(url.searchParams.get("resource")).toBe(
      "https://api.fireflies.ai/mcp",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Any.do as a confidential PKCE hosted-MCP connector", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("any-do");
    expect(manifest).toBe(ANY_DO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://mcp.any.do/authorize",
        tokenUrl: "https://mcp.any.do/token",
        requiredScopes: [...ANY_DO_SCOPES],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("any-do", "any_do_mcp_read")?.name).toBe(
      "any-do.read",
    );
    expect(manifest?.tools).toHaveLength(2);
    const { service, oauthStateRepo } = connectorOAuthHarness({
      ANY_DO_CLIENT_ID: "railway-any-do-client",
      ANY_DO_CLIENT_SECRET: "railway-any-do-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "any-do", {
      returnTo: "https://relayconsole.work/app?marketplace_app=any-do",
    });
    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe("https://mcp.any.do/authorize");
    expect(url.searchParams.get("client_id")).toBe("railway-any-do-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/any-do/callback",
    );
    expect(url.searchParams.get("scope")).toBe(ANY_DO_SCOPES.join(" "));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeTruthy();
  });

  it("registers Remember The Milk as a confidential PKCE hosted-MCP connector", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("remember-the-milk");
    expect(manifest).toBe(REMEMBER_THE_MILK_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://www.rememberthemilk.com/oauth/authorize.rtm",
        tokenUrl: "https://www.rememberthemilk.com/oauth/token.rtm",
        requiredScopes: [...REMEMBER_THE_MILK_SCOPES],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(
      registry.getTool("remember-the-milk", "remember_the_milk_mcp_read")?.name,
    ).toBe("remember-the-milk.read");
    expect(manifest?.tools).toHaveLength(2);
    const { service, oauthStateRepo } = connectorOAuthHarness({
      REMEMBER_THE_MILK_CLIENT_ID: "railway-rtm-client",
      REMEMBER_THE_MILK_CLIENT_SECRET: "railway-rtm-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "remember-the-milk",
      "habitica",
      {
        returnTo:
          "https://relayconsole.work/app?marketplace_app=remember-the-milk",
      },
    );
    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://www.rememberthemilk.com/oauth/authorize.rtm",
    );
    expect(url.searchParams.get("client_id")).toBe("railway-rtm-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/remember-the-milk/callback",
    );
    expect(url.searchParams.get("scope")).toBe(
      REMEMBER_THE_MILK_SCOPES.join(" "),
    );
    expect(url.searchParams.get("resource")).toBe(
      "https://www.rememberthemilk.com/mcp",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(savedState.clientSecretCiphertext).toBeTruthy();
  });

  it("registers Fathom as a dynamic public PKCE hosted-MCP connector", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("fathom");
    expect(manifest).toBe(FATHOM_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://fathom.video/mcp/oauth/authorize",
        tokenUrl: "https://api.fathom.ai/mcp/oauth/token",
        requiredScopes: ["mcp"],
        pkce: true,
        supportsRefresh: false,
      }),
    );
    expect(registry.getTool("fathom", "fathom_read")?.name).toBe("fathom.read");
    expect(manifest?.tools).toHaveLength(2);
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "fathom_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual(["fathom_mcp_write"]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      FATHOM_MCP_CLIENT_ID: "railway-fathom-public-client",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "fathom", {
      returnTo: "https://relayconsole.work/app?marketplace_app=fathom",
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://fathom.video/mcp/oauth/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/fathom/callback",
    );
    expect(url.searchParams.get("scope")).toBe("mcp");
    expect(url.searchParams.get("resource")).toBe("https://api.fathom.ai/mcp");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers tl;dv as a customer-key complete public API connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("tl-dv");
    expect(manifest).toBe(TL_DV_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({
        type: "api_key",
        credentialSchema: expect.arrayContaining([
          expect.objectContaining({
            name: "TL_DV_API_KEY",
            secret: true,
            required: true,
          }),
        ]),
      }),
    );
    expect(registry.getTool("tl-dv", "tl_dv_get_transcript")?.name).toBe(
      "tlDv.getTranscript",
    );
    expect(
      registry.getTool("tl-dv", "tl_dv_import_meeting")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "tl_dv_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual(["tl_dv_import_meeting", "tl_dv_full_api"]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Grain as a dynamic public PKCE hosted-MCP connector", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("grain");
    expect(manifest).toBe(GRAIN_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://grain.com/_/public-api/oauth2/authorize",
        tokenUrl: "https://api.grain.com/_/public-api/oauth2/token",
        requiredScopes: [],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("grain", "grain_read")?.name).toBe("grain.read");
    expect(manifest?.tools).toHaveLength(2);
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "grain_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual(["grain_mcp_write"]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      GRAIN_MCP_CLIENT_ID: "railway-grain-public-client",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "grain", {
      returnTo: "https://relayconsole.work/app?marketplace_app=grain",
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://grain.com/_/public-api/oauth2/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/grain/callback",
    );
    expect(url.searchParams.get("scope")).toBeNull();
    expect(url.searchParams.get("resource")).toBe("https://api.grain.com");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Whimsical as a dynamic public PKCE hosted-MCP connector", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("whimsical");
    expect(manifest).toBe(WHIMSICAL_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://api.whimsical.com/v1/oauth.authorize",
        tokenUrl: "https://api.whimsical.com/v1/oauth.token",
        revocationUrl: "https://api.whimsical.com/v1/oauth.revoke",
        requiredScopes: [...WHIMSICAL_SCOPES],
        pkce: true,
        supportsRefresh: false,
      }),
    );
    expect(registry.getTool("whimsical", "whimsical_read")?.name).toBe(
      "whimsical.read",
    );
    expect(manifest?.tools).toHaveLength(2);
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "whimsical_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual(["whimsical_mcp_write"]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      WHIMSICAL_MCP_CLIENT_ID: "railway-whimsical-public-client",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "whimsical",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=whimsical",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://api.whimsical.com/v1/oauth.authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/whimsical/callback",
    );
    expect(url.searchParams.get("scope")).toBe(WHIMSICAL_SCOPES.join(" "));
    expect(url.searchParams.get("resource")).toBe("https://mcp.whimsical.com");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Cognito Forms with its provider-published public PKCE MCP client", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("cognito-forms");
    expect(manifest).toBe(COGNITO_FORMS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://www.cognitoforms.com/api-connection",
        tokenUrl:
          "https://www.cognitoforms.com/svc/integration/oauth/access-token",
        requiredScopes: [...COGNITO_FORMS_SCOPES],
        pkce: true,
        supportsRefresh: false,
      }),
    );
    expect(registry.getTool("cognito-forms", "cognito_forms_read")?.name).toBe(
      "cognitoForms.read",
    );
    expect(manifest?.tools).toHaveLength(2);
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "cognito_forms_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual(["cognito_forms_mcp_write"]);
    const { service } = connectorOAuthHarness({});
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "cognito-forms",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=cognito-forms",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://www.cognitoforms.com/api-connection",
    );
    expect(url.searchParams.get("client_id")).toBe(COGNITO_FORMS_MCP_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/cognito-forms/callback",
    );
    expect(url.searchParams.get("scope")).toBe(COGNITO_FORMS_SCOPES.join(" "));
    expect(url.searchParams.get("resource")).toBe(COGNITO_FORMS_MCP_RESOURCE);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Wufoo as an encrypted customer API-key connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("wufoo");
    expect(manifest).toBe(WUFOO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "WUFOO_API_KEY",
      "WUFOO_SUBDOMAIN",
    ]);
    expect(registry.getTool("wufoo", "wufoo_read")?.name).toBe("wufoo.read");
    expect(registry.getTool("wufoo", "wufoo_manage")?.approvalRequired).toBe(
      true,
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "wufoo")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.wufoo.com/",
        description: expect.stringContaining("online form builder"),
      }),
    );
  });

  it("registers Gravity Forms as a site-bound read-only key connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("gravity-forms");
    expect(manifest).toBe(GRAVITY_FORMS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "GRAVITY_FORMS_SITE_URL",
      "GRAVITY_FORMS_CONSUMER_KEY",
      "GRAVITY_FORMS_CONSUMER_SECRET",
    ]);
    expect(registry.getTool("gravity-forms", "gravity_forms_read")?.name).toBe(
      "gravityForms.read",
    );
    expect(manifest?.tools).toHaveLength(1);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "gravity-forms"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.gravityforms.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Ninja Forms as a site-bound Application Password connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("ninja-forms");
    expect(manifest).toBe(NINJA_FORMS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "NINJA_FORMS_SITE_URL",
      "NINJA_FORMS_USERNAME",
      "NINJA_FORMS_APPLICATION_PASSWORD",
    ]);
    expect(registry.getTool("ninja-forms", "ninja_forms_read")?.name).toBe(
      "ninjaForms.read",
    );
    expect(manifest?.tools).toHaveLength(1);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "ninja-forms"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://ninjaforms.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers WPForms as a site-bound Application Password connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("wpforms");
    expect(manifest).toBe(WPFORMS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "WPFORMS_SITE_URL",
      "WPFORMS_USERNAME",
      "WPFORMS_APPLICATION_PASSWORD",
    ]);
    expect(registry.getTool("wpforms", "wpforms_read")?.name).toBe(
      "wpforms.read",
    );
    expect(manifest?.tools).toHaveLength(1);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "wpforms")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://wpforms.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Alchemer as a customer-owned OAuth 1.0 bundle connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("alchemer");
    expect(manifest).toBe(ALCHEMER_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "ALCHEMER_REGION",
      "ALCHEMER_OAUTH_CONSUMER_KEY",
      "ALCHEMER_OAUTH_CONSUMER_SECRET",
      "ALCHEMER_OAUTH_ACCESS_TOKEN",
      "ALCHEMER_OAUTH_ACCESS_TOKEN_SECRET",
    ]);
    expect(registry.getTool("alchemer", "alchemer_read")?.name).toBe(
      "alchemer.read",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "alchemer")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.alchemer.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Qualtrics as a data-center-bound API token connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("qualtrics");
    expect(manifest).toBe(QUALTRICS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "QUALTRICS_DATA_CENTER_ID",
      "QUALTRICS_API_TOKEN",
    ]);
    expect(registry.getTool("qualtrics", "qualtrics_read")?.name).toBe(
      "qualtrics.read",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "qualtrics")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.qualtrics.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers AskNicely as a tenant-bound API key connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("asknicely");
    expect(manifest).toBe(ASKNICELY_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "ASKNICELY_SUBDOMAIN",
      "ASKNICELY_API_KEY",
    ]);
    expect(registry.getTool("asknicely", "asknicely_read")?.name).toBe(
      "askNicely.read",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "asknicely")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.asknicely.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Delighted as a project-key Basic-auth connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("delighted");
    expect(manifest).toBe(DELIGHTED_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "DELIGHTED_API_KEY",
    ]);
    expect(registry.getTool("delighted", "delighted_read")?.name).toBe(
      "delighted.read",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "delighted")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://delighted.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Refiner as a personal-key Bearer connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("refiner");
    expect(manifest).toBe(REFINER_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "REFINER_API_KEY",
    ]);
    expect(registry.getTool("refiner", "refiner_read")?.name).toBe(
      "refiner.read",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "refiner")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://refiner.io/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Hotjar as a site-bound client-credentials connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("hotjar");
    expect(manifest).toBe(HOTJAR_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "HOTJAR_CLIENT_ID",
      "HOTJAR_CLIENT_SECRET",
      "HOTJAR_SITE_ID",
    ]);
    expect(registry.getTool("hotjar", "hotjar_read")?.name).toBe("hotjar.read");
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "hotjar")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.hotjar.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers UserTesting as a studies-read client-credentials connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("usertesting");
    expect(manifest).toBe(USERTESTING_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "USERTESTING_CLIENT_ID",
      "USERTESTING_CLIENT_SECRET",
    ]);
    expect(registry.getTool("usertesting", "usertesting_read")?.name).toBe(
      "usertesting.read",
    );
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "usertesting"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.usertesting.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Maze as a dynamic OAuth read-only hosted-MCP connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("maze");
    expect(manifest).toBe(MAZE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        userInfoUrl: "https://connect.maze.co/mcp",
        pkce: true,
      }),
    );
    expect(registry.getTool("maze", "maze_mcp_read")?.name).toBe("maze.read");
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "maze")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://maze.co/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Lookback as a dynamic OAuth hosted-MCP connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("lookback");
    expect(manifest).toBe(LOOKBACK_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        userInfoUrl: "https://mcp.lookback.io/mcp",
        requiredScopes: ["openid", "offline", "mcp"],
        pkce: true,
      }),
    );
    expect(registry.getTool("lookback", "lookback_mcp_read")?.name).toBe(
      "lookback.read",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "lookback")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.lookback.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers User Interviews as an admin-key v2 connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("user-interviews");
    expect(manifest).toBe(USER_INTERVIEWS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "USER_INTERVIEWS_API_KEY",
    ]);
    expect(
      registry.getTool("user-interviews", "user_interviews_read")?.name,
    ).toBe("user-interviews.read");
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "user-interviews"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.userinterviews.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Respondent as a production Partner API connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("respondent");
    expect(manifest).toBe(RESPONDENT_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "RESPONDENT_CLIENT_ID",
      "RESPONDENT_CLIENT_SECRET",
    ]);
    expect(registry.getTool("respondent", "respondent_read")?.name).toBe(
      "respondent.read",
    );
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "respondent"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.respondent.io/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Dovetail as a minimized personal-token REST connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("dovetail");
    expect(manifest).toBe(DOVETAIL_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "DOVETAIL_API_TOKEN",
    ]);
    expect(registry.getTool("dovetail", "dovetail_read")?.name).toBe(
      "dovetail.read",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "dovetail")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://dovetail.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Sprig as a minimized Data Export API connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("sprig");
    expect(manifest).toBe(SPRIG_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "SPRIG_API_KEY",
    ]);
    expect(registry.getTool("sprig", "sprig_read")?.name).toBe("sprig.read");
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "sprig")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://sprig.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Airtable Forms as a metadata-only OAuth connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("airtable-forms");
    expect(manifest).toBe(AIRTABLE_FORMS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        requiredScopes: ["workspacesAndBases:read"],
        pkce: true,
      }),
    );
    expect(
      registry.getTool("airtable-forms", "airtable_forms_read")?.name,
    ).toBe("airtable-forms.read");
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "airtable-forms"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.airtable.com/platform/forms",
        riskLevel: "critical",
      }),
    );
  });

  it("registers DocuSign CLM as an exact-folder OAuth connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("docusign-clm");
    expect(manifest).toBe(DOCUSIGN_CLM_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        requiredScopes: ["signature", "extended"],
        pkce: true,
      }),
    );
    expect(registry.getTool("docusign-clm", "docusign_clm_read")?.name).toBe(
      "docusign-clm.read",
    );
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "docusign-clm"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.docusign.com/products/clm",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Rewardful as a minimized reporting connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("rewardful");
    expect(manifest).toBe(REWARDFUL_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "REWARDFUL_API_SECRET",
    ]);
    expect(registry.getTool("rewardful", "rewardful_read")?.name).toBe(
      "rewardful.read",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "rewardful")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.rewardful.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers FirstPromoter as a pinned hosted-MCP analytics connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("firstpromoter");
    expect(manifest).toBe(FIRSTPROMOTER_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://mcp.firstpromoter.com/oauth/authorize",
        requiredScopes: [...FIRSTPROMOTER_SCOPES],
        pkce: true,
      }),
    );
    expect(registry.getTool("firstpromoter", "firstpromoter_read")?.name).toBe(
      "firstPromoter.read",
    );
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "firstpromoter"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://firstpromoter.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Apollo.io as a search-only PKCE OAuth connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("apollo-io");
    expect(manifest).toBe(APOLLO_IO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        requiredScopes: [...APOLLO_IO_SCOPES],
        pkce: true,
      }),
    );
    expect(registry.getTool("apollo-io", "apollo_io_read")?.name).toBe(
      "apolloIo.search",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "apollo-io")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.apollo.io/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Outreach as a bounded read-only OAuth connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("outreach");
    expect(manifest).toBe(OUTREACH_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://api.outreach.io/oauth/authorize",
        tokenUrl: "https://api.outreach.io/oauth/token",
        requiredScopes: [...OUTREACH_SCOPES],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("outreach", "outreach_read")?.name).toBe(
      "outreach.read",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "outreach")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.outreach.io/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Salesloft as a bounded read-only OAuth connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("salesloft");
    expect(manifest).toBe(SALESLOFT_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://accounts.salesloft.com/oauth/authorize",
        tokenUrl: "https://accounts.salesloft.com/oauth/token",
        requiredScopes: [...SALESLOFT_SCOPES],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("salesloft", "salesloft_read")?.name).toBe(
      "salesloft.read",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "salesloft")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.salesloft.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Gong as a bounded basic-call OAuth connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("gong");
    expect(manifest).toBe(GONG_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        requiredScopes: [...GONG_SCOPES],
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("gong", "gong_read")?.name).toBe("gong.read");
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "gong")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.gong.io/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Chorus.ai as a bounded user-token metadata connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("chorus-ai");
    expect(manifest).toBe(CHORUS_AI_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({ type: "api_key" }),
    );
    expect(registry.getTool("chorus-ai", "chorus_ai_read")?.name).toBe(
      "chorusAi.read",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "chorus-ai")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.zoominfo.com/products/chorus",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Clari as a bounded Copilot call-metadata connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("clari");
    expect(manifest).toBe(CLARI_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({ type: "api_key" }),
    );
    expect(registry.getTool("clari", "clari_read")?.name).toBe("clari.read");
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "clari")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.clari.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers People.ai as a schema-pinned Backstory MCP connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("people-ai");
    expect(manifest).toBe(PEOPLE_AI_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({ type: "api_key" }),
    );
    expect(registry.getTool("people-ai", "people_ai_read")?.name).toBe(
      "peopleAi.search",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "people-ai")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.people.ai/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Cognism as a bounded account-preview connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("cognism");
    expect(manifest).toBe(COGNISM_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({ type: "api_key" }),
    );
    expect(registry.getTool("cognism", "cognism_read")?.name).toBe(
      "cognism.searchAccounts",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "cognism")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.cognism.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers ZoomInfo as a no-credit company-search connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("zoominfo");
    expect(manifest).toBe(ZOOMINFO_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({ type: "api_key" }),
    );
    expect(registry.getTool("zoominfo", "zoominfo_read")?.name).toBe(
      "zoominfo.searchCompanies",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "zoominfo")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.zoominfo.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Clearbit as a legacy company-domain lookup connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("clearbit");
    expect(manifest).toBe(CLEARBIT_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({ type: "api_key" }),
    );
    expect(registry.getTool("clearbit", "clearbit_read")?.name).toBe(
      "clearbit.findCompany",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "clearbit")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://clearbit.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Leadfeeder as a minimized account-directory connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("leadfeeder");
    expect(manifest).toBe(LEADFEEDER_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({ type: "api_key" }),
    );
    expect(registry.getTool("leadfeeder", "leadfeeder_read")?.name).toBe(
      "leadfeeder.listAccounts",
    );
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "leadfeeder"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.leadfeeder.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("keeps Leadpages unavailable pending a public API contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("leadpages")).toBeNull();
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "leadpages")).toEqual(
      expect.objectContaining({
        availability: "preview",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "low",
      }),
    );
  });

  it("registers Unbounce as a minimized page-directory connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("unbounce");
    expect(manifest).toBe(UNBOUNCE_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({ type: "api_key" }),
    );
    expect(registry.getTool("unbounce", "unbounce_read")?.name).toBe(
      "unbounce.listPages",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "unbounce")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://unbounce.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Instapage as a minimized workspace-directory connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("instapage");
    expect(manifest).toBe(INSTAPAGE_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({ type: "api_key" }),
    );
    expect(registry.getTool("instapage", "instapage_read")?.name).toBe(
      "instapage.listWorkspaces",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "instapage")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://instapage.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers Optimizely as a broad-scope contained project connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("optimizely");
    expect(manifest).toBe(OPTIMIZELY_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        requiredScopes: ["all"],
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("optimizely", "optimizely_read")?.name).toBe(
      "optimizely.listProjects",
    );
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "optimizely"),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.optimizely.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers VWO as a minimized current-account project connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("vwo");
    expect(manifest).toBe(VWO_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({ type: "api_key" }),
    );
    expect(registry.getTool("vwo", "vwo_read")?.name).toBe("vwo.listProjects");
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "vwo")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://vwo.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers AB Tasty as an account-bound project connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("ab-tasty");
    expect(manifest).toBe(AB_TASTY_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({ type: "api_key" }),
    );
    expect(registry.getTool("ab-tasty", "ab_tasty_read")?.name).toBe(
      "abTasty.listProjects",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "ab-tasty")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.abtasty.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("registers FullStory as a minimized connection-summary connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("fullstory");
    expect(manifest).toBe(FULLSTORY_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({ type: "api_key" }),
    );
    expect(registry.getTool("fullstory", "fullstory_read")?.name).toBe(
      "fullstory.getConnectionSummary",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "fullstory")).toEqual(
      expect.objectContaining({
        providerWebsiteUrl: "https://www.fullstory.com/",
        riskLevel: "critical",
      }),
    );
  });

  it("keeps Microsoft Viva Insights unavailable while its API is beta-only", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("microsoft-viva-insights")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "microsoft-viva-insights"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("registers Dynamics 365 Sales as an environment-bound identity connector", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("microsoft-dynamics-365-sales");
    expect(manifest).toBe(MICROSOFT_DYNAMICS_365_SALES_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        requiredScopes: ["offline_access", "user_impersonation"],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(
      registry.getTool(
        "microsoft-dynamics-365-sales",
        "microsoft_dynamics_365_sales_read",
      )?.name,
    ).toBe("microsoft-dynamics-365-sales.getConnectionSummary");
    expect(
      MARKETPLACE_CATALOG.find(
        (app) => app.slug === "microsoft-dynamics-365-sales",
      ),
    ).toEqual(
      expect.objectContaining({
        providerWebsiteUrl:
          "https://www.microsoft.com/en-us/dynamics-365/products/sales",
        riskLevel: "critical",
      }),
    );
    const { service } = connectorOAuthHarness({
      MICROSOFT_DYNAMICS_365_CLIENT_ID: "railway-dynamics-client-id",
      MICROSOFT_DYNAMICS_365_CLIENT_SECRET: "railway-dynamics-client-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "microsoft-dynamics-365-sales",
      {
        providerDomain: "https://relay.crm.dynamics.com",
        returnTo:
          "https://relayconsole.work/app?marketplace_app=microsoft-dynamics-365-sales",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/microsoft-dynamics-365-sales/callback",
    );
    expect(url.searchParams.get("scope")).toBe(
      "offline_access https://relay.crm.dynamics.com/user_impersonation",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Dynamics 365 Customer Service with environment-bound OAuth", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("microsoft-dynamics-365-customer-service");
    expect(manifest).toBe(
      MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_CONNECTOR_MANIFEST,
    );
    expect(
      registry.getTool(
        "microsoft-dynamics-365-customer-service",
        "microsoft_dynamics_365_customer_service_read",
      )?.name,
    ).toBe("microsoft-dynamics-365-customer-service.getConnectionSummary");
    expect(
      MARKETPLACE_CATALOG.find(
        (app) => app.slug === "microsoft-dynamics-365-customer-service",
      ),
    ).toEqual(expect.objectContaining({ riskLevel: "critical" }));
    const { service } = connectorOAuthHarness({
      MICROSOFT_DYNAMICS_365_CLIENT_ID: "railway-dynamics-client-id",
      MICROSOFT_DYNAMICS_365_CLIENT_SECRET: "railway-dynamics-client-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "microsoft-dynamics-365-customer-service",
      {
        providerDomain: "https://support.crm.dynamics.com",
        returnTo:
          "https://relayconsole.work/app?marketplace_app=microsoft-dynamics-365-customer-service",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/microsoft-dynamics-365-customer-service/callback",
    );
    expect(url.searchParams.get("scope")).toBe(
      "offline_access https://support.crm.dynamics.com/user_impersonation",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Dynamics 365 Business Central with environment-bound OAuth", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("microsoft-dynamics-365-business-central");
    expect(manifest).toBe(
      MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_CONNECTOR_MANIFEST,
    );
    expect(
      registry.getTool(
        "microsoft-dynamics-365-business-central",
        "microsoft_dynamics_365_business_central_read",
      )?.name,
    ).toBe("microsoft-dynamics-365-business-central.listCompanies");
    expect(
      MARKETPLACE_CATALOG.find(
        (app) => app.slug === "microsoft-dynamics-365-business-central",
      ),
    ).toEqual(expect.objectContaining({ riskLevel: "critical" }));
    const { service } = connectorOAuthHarness({
      MICROSOFT_DYNAMICS_365_CLIENT_ID: "railway-dynamics-client-id",
      MICROSOFT_DYNAMICS_365_CLIENT_SECRET: "railway-dynamics-client-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "microsoft-dynamics-365-business-central",
      {
        providerDomain: "Production",
        returnTo:
          "https://relayconsole.work/app?marketplace_app=microsoft-dynamics-365-business-central",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/microsoft-dynamics-365-business-central/callback",
    );
    expect(url.searchParams.get("scope")).toBe(
      "offline_access https://api.businesscentral.dynamics.com/Financials.ReadWrite.All",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Microsoft Entra ID with least-privilege signed-in identity OAuth", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("microsoft-entra-id");
    expect(manifest).toBe(MICROSOFT_ENTRA_ID_CONNECTOR_MANIFEST);
    expect(
      registry.getTool("microsoft-entra-id", "microsoft_entra_id_read")?.name,
    ).toBe("microsoft-entra-id.getSignedInIdentity");
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "microsoft-entra-id"),
    ).toEqual(expect.objectContaining({ riskLevel: "high" }));
    const { service } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "railway-microsoft-client-id",
      MICROSOFT_CLIENT_SECRET: "railway-microsoft-client-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "microsoft-entra-id",
      {
        returnTo:
          "https://relayconsole.work/app?marketplace_app=microsoft-entra-id",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/microsoft-entra-id/callback",
    );
    expect(url.searchParams.get("scope")).toBe("offline_access User.Read");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Yammer with least-privilege signed-in identity OAuth", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("yammer");
    expect(manifest).toBe(YAMMER_CONNECTOR_MANIFEST);
    expect(registry.getTool("yammer", "yammer_read")?.name).toBe(
      "yammer.getSignedInIdentity",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "yammer")).toEqual(
      expect.objectContaining({ riskLevel: "high" }),
    );
    const { service } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "railway-microsoft-client-id",
      MICROSOFT_CLIENT_SECRET: "railway-microsoft-client-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "yammer", {
      returnTo: "https://relayconsole.work/app?marketplace_app=yammer",
    });
    const url = new URL(result.authorizationUrl);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/yammer/callback",
    );
    expect(url.searchParams.get("scope")).toBe(
      "offline_access https://www.yammer.com/.default",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Viva Learning with a bounded provider-directory OAuth contract", async () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("viva-learning")).toBe(
      VIVA_LEARNING_CONNECTOR_MANIFEST,
    );
    expect(registry.getTool("viva-learning", "viva_learning_read")?.name).toBe(
      "viva-learning.listProviders",
    );
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "viva-learning"),
    ).toEqual(expect.objectContaining({ riskLevel: "high" }));
    const { service } = connectorOAuthHarness({
      MICROSOFT_CLIENT_ID: "railway-microsoft-client-id",
      MICROSOFT_CLIENT_SECRET: "railway-microsoft-client-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "viva-learning",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=viva-learning",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/viva-learning/callback",
    );
    expect(url.searchParams.get("scope")).toBe(
      "offline_access LearningProvider.Read",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("keeps Microsoft Defender for Cloud Apps unavailable pending customer-tenant app context", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("microsoft-defender-for-cloud-apps")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find(
        (app) => app.slug === "microsoft-defender-for-cloud-apps",
      ),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("keeps Microsoft Purview unavailable pending a bounded API-plane contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("microsoft-purview")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "microsoft-purview"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("keeps retired Viva Goals unavailable", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("viva-goals")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "viva-goals"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "high",
      }),
    );
  });

  it("keeps Microsoft Clipchamp unavailable without a supported automation API", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("microsoft-clipchamp")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "microsoft-clipchamp"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "high",
      }),
    );
  });

  it("registers Adobe Analytics as a read-only dynamic public PKCE hosted-MCP connector", async () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("adobe-analytics")).toBe(
      ADOBE_ANALYTICS_CONNECTOR_MANIFEST,
    );
    expect(
      registry.getTool("adobe-analytics", "adobe_analytics_read")?.name,
    ).toBe("adobe-analytics.read");
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "adobe-analytics"),
    ).toEqual(expect.objectContaining({ riskLevel: "high" }));
    const { service } = connectorOAuthHarness({
      ADOBE_ANALYTICS_MCP_CLIENT_ID: "railway-adobe-analytics-public-client",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "adobe-analytics",
      {
        returnTo:
          "https://relayconsole.work/app?marketplace_app=adobe-analytics",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://ims-na1.adobelogin.com/ims/authorize/v2",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/adobe-analytics/callback",
    );
    expect(url.searchParams.get("scope")).toBe(
      ADOBE_ANALYTICS_SCOPES.join(" "),
    );
    expect(url.searchParams.get("resource")).toBe(
      "https://aa-mcp.adobe.io/mcp",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Adobe Marketo Engage as an instance-bound read-only custom-service connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("adobe-marketo-engage")).toBe(
      ADOBE_MARKETO_ENGAGE_CONNECTOR_MANIFEST,
    );
    expect(
      registry.getTool("adobe-marketo-engage", "adobe_marketo_engage_read")
        ?.name,
    ).toBe("adobe-marketo-engage.listPrograms");
    expect(
      ADOBE_MARKETO_ENGAGE_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual([
      "MARKETO_INSTANCE_ORIGIN",
      "MARKETO_CLIENT_ID",
      "MARKETO_CLIENT_SECRET",
    ]);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "adobe-marketo-engage"),
    ).toEqual(expect.objectContaining({ riskLevel: "high" }));
  });

  it("keeps Adobe Campaign unavailable pending one generation and bounded API contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("adobe-campaign")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "adobe-campaign"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("registers Adobe Target as a tenant-bound read-only server-to-server connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("adobe-target")).toBe(ADOBE_TARGET_CONNECTOR_MANIFEST);
    expect(registry.getTool("adobe-target", "adobe_target_read")?.name).toBe(
      "adobe-target.listActivities",
    );
    expect(
      ADOBE_TARGET_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual([
      "ADOBE_TARGET_TENANT",
      "ADOBE_TARGET_CLIENT_ID",
      "ADOBE_TARGET_CLIENT_SECRET",
      "ADOBE_TARGET_SCOPES",
    ]);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "adobe-target"),
    ).toEqual(expect.objectContaining({ riskLevel: "high" }));
  });

  it("keeps Adobe Commerce Cloud unavailable pending one deployment contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("adobe-commerce-cloud")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "adobe-commerce-cloud"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("keeps Adobe Sign as an unavailable alias of canonical Adobe Acrobat Sign", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("adobe-sign")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "adobe-sign"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("keeps Adobe Frame.io as an unavailable alias of canonical Frame.io", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("adobe-frame-io")).toBeNull();
    expect(registry.get("frame-io")).toBeTruthy();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "adobe-frame-io"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
      }),
    );
  });

  it("keeps Adobe Firefly unavailable pending an enterprise generation contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("adobe-firefly")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "adobe-firefly"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("keeps Adobe Fonts unavailable pending a current API and licensing contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("adobe-fonts")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "adobe-fonts"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "high",
      }),
    );
  });

  it("registers Osano as a fixed-origin read-only API-key connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("osano")).toBe(OSANO_CONNECTOR_MANIFEST);
    expect(registry.getTool("osano", "osano_read")?.name).toBe(
      "osano.listCookieConsentConfigs",
    );
    expect(
      OSANO_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name),
    ).toEqual(["OSANO_API_KEY"]);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "osano")).toEqual(
      expect.objectContaining({ riskLevel: "critical" }),
    );
  });

  it("registers Secureframe as a regional RBAC-bound read-only connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("secureframe")).toBe(SECUREFRAME_CONNECTOR_MANIFEST);
    expect(registry.getTool("secureframe", "secureframe_read")?.name).toBe(
      "secureframe.listFrameworks",
    );
    expect(
      SECUREFRAME_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual([
      "SECUREFRAME_REGION",
      "SECUREFRAME_API_KEY",
      "SECUREFRAME_API_SECRET",
    ]);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "secureframe"),
    ).toEqual(expect.objectContaining({ riskLevel: "critical" }));
  });

  it("registers Vanta as a fixed-origin client-credentials read-only connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("vanta")).toBe(VANTA_CONNECTOR_MANIFEST);
    expect(registry.getTool("vanta", "vanta_read")?.name).toBe(
      "vanta.listDocuments",
    );
    expect(
      VANTA_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name),
    ).toEqual(["VANTA_CLIENT_ID", "VANTA_CLIENT_SECRET"]);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "vanta")).toEqual(
      expect.objectContaining({
        riskLevel: "critical",
      }),
    );
  });

  it("registers Drata as a regional workspace-bound read-only connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("drata")).toBe(DRATA_CONNECTOR_MANIFEST);
    expect(registry.getTool("drata", "drata_read")?.name).toBe(
      "drata.listFrameworks",
    );
    expect(
      DRATA_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name),
    ).toEqual(["DRATA_REGION", "DRATA_WORKSPACE_ID", "DRATA_API_KEY"]);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "drata")).toEqual(
      expect.objectContaining({ riskLevel: "critical" }),
    );
  });

  it("keeps Thoropass unavailable pending a distributable partner API contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("thoropass")).toBeNull();
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "thoropass")).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("registers Sprinto as a contained US-only beta GraphQL connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("sprinto")).toBe(SPRINTO_CONNECTOR_MANIFEST);
    expect(registry.getTool("sprinto", "sprinto_read")?.name).toBe(
      "sprinto.listWorkflowChecks",
    );
    expect(
      SPRINTO_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["SPRINTO_API_KEY"]);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "sprinto")).toEqual(
      expect.objectContaining({
        availability: "available",
        riskLevel: "critical",
      }),
    );
  });

  it("keeps Laika as an unavailable legacy alias of canonical Thoropass", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("laika")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "thoropass"),
    ).toBeTruthy();
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "laika")).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("registers Hyperproof as a fixed-US single-control read connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("hyperproof")).toBe(HYPERPROOF_CONNECTOR_MANIFEST);
    expect(registry.getTool("hyperproof", "hyperproof_read")?.name).toBe(
      "hyperproof.getControl",
    );
    expect(
      HYPERPROOF_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["HYPERPROOF_CLIENT_ID", "HYPERPROOF_CLIENT_SECRET"]);
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "hyperproof"),
    ).toEqual(
      expect.objectContaining({
        availability: "preview",
        riskLevel: "critical",
      }),
    );
  });

  it("keeps AuditBoard unavailable after the Optro rebrand pending a distributable integration contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("auditboard")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "auditboard"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("registers Workiva as a regional exact-scope file-metadata connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("workiva")).toBe(WORKIVA_CONNECTOR_MANIFEST);
    expect(registry.getTool("workiva", "workiva_read")?.name).toBe(
      "workiva.listFiles",
    );
    expect(
      WORKIVA_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["WORKIVA_REGION", "WORKIVA_CLIENT_ID", "WORKIVA_CLIENT_SECRET"]);
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "workiva")).toEqual(
      expect.objectContaining({
        availability: "preview",
        riskLevel: "critical",
      }),
    );
  });

  it("keeps Diligent Boards unavailable pending a Boards-specific customer API contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("diligent-boards")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "diligent-boards"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("keeps Boardable unavailable pending a supported external automation contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("boardable")).toBeNull();
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "boardable")).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("keeps OnBoard unavailable pending a distributable customer API contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("onboard")).toBeNull();
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "onboard")).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("keeps BoardEffect unavailable pending a current distributable API contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("boardeffect")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "boardeffect"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("keeps Govenda unavailable pending a distributable customer API contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("govenda")).toBeNull();
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "govenda")).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("registers Carta as an approved client-credentials firm-directory connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("carta");
    expect(manifest).toBe(CARTA_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "CARTA_CLIENT_ID",
      "CARTA_CLIENT_SECRET",
    ]);
    expect(registry.getTool("carta", "carta_read")?.name).toBe(
      "carta.listFirms",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "carta")).toEqual(
      expect.objectContaining({
        availability: "available",
        credentialRequirements: expect.arrayContaining([
          expect.objectContaining({ name: "CARTA_CLIENT_ID", secret: true }),
          expect.objectContaining({
            name: "CARTA_CLIENT_SECRET",
            secret: true,
          }),
        ]),
        riskLevel: "critical",
      }),
    );
  });

  it("keeps Pulley unavailable pending a distributable customer API contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("pulley")).toBeNull();
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "pulley")).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("registers Shareworks as a read-only signed-JWT company-directory connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("shareworks");
    expect(manifest).toBe(SHAREWORKS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "SHAREWORKS_ACCOUNT_NUMBER",
      "SHAREWORKS_CLIENT_ID",
      "SHAREWORKS_CLIENT_SECRET",
      "SHAREWORKS_PRIVATE_KEY",
    ]);
    expect(registry.getTool("shareworks", "shareworks_read")?.name).toBe(
      "shareworks.listCompanies",
    );
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "shareworks"),
    ).toEqual(
      expect.objectContaining({
        availability: "available",
        credentialRequirements: expect.arrayContaining([
          expect.objectContaining({
            name: "SHAREWORKS_PRIVATE_KEY",
            secret: true,
          }),
        ]),
        riskLevel: "critical",
      }),
    );
  });

  it("registers Ledgy as a fixed company-identity GraphQL connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("ledgy");
    expect(manifest).toBe(LEDGY_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "LEDGY_API_KEY",
    ]);
    expect(registry.getTool("ledgy", "ledgy_read")?.name).toBe(
      "ledgy.getCompanyIdentity",
    );
    expect(MARKETPLACE_CATALOG.find((app) => app.slug === "ledgy")).toEqual(
      expect.objectContaining({
        availability: "available",
        credentialRequirements: [
          expect.objectContaining({ name: "LEDGY_API_KEY", secret: true }),
        ],
        riskLevel: "critical",
      }),
    );
  });

  it("keeps AngelList Venture unavailable pending a full-service API contract", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("angellist-venture")).toBeNull();
    expect(
      MARKETPLACE_CATALOG.find((app) => app.slug === "angellist-venture"),
    ).toEqual(
      expect.objectContaining({
        availability: "unsupported",
        credentialRequirements: [],
        capabilities: [],
        riskLevel: "critical",
      }),
    );
  });

  it("registers XMind as a dynamic public PKCE hosted-MCP connector", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("xmind");
    expect(manifest).toBe(XMIND_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://app.xmind.com/oauth/consent",
        tokenUrl: "https://app.xmind.com/api/oauth/token",
        requiredScopes: [...XMIND_SCOPES],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("xmind", "xmind_read")?.name).toBe("xmind.read");
    expect(manifest?.tools).toHaveLength(2);
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "xmind_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual(["xmind_mcp_write"]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      XMIND_MCP_CLIENT_ID: "railway-xmind-public-client",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "xmind", {
      returnTo: "https://relayconsole.work/app?marketplace_app=xmind",
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://app.xmind.com/oauth/consent",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/xmind/callback",
    );
    expect(url.searchParams.get("scope")).toBe(XMIND_SCOPES.join(" "));
    expect(url.searchParams.get("resource")).toBe(
      "https://app.xmind.com/api/mcp",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Padlet as a customer-token connector for every Public API endpoint", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("padlet");
    expect(manifest).toBe(PADLET_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual([
      expect.objectContaining({
        name: "PADLET_API_KEY",
        required: true,
        secret: true,
      }),
    ]);
    expect(manifest?.tools).toHaveLength(10);
    expect(registry.getTool("padlet", "padlet_get_board")?.name).toBe(
      "padlet.getBoard",
    );
    expect(
      registry.getTool("padlet", "padlet_create_post")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Dropbox Paper as Relay-owned offline OAuth across both Paper storage models", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("dropbox-paper");
    expect(manifest).toBe(DROPBOX_PAPER_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://www.dropbox.com/oauth2/authorize",
        tokenUrl: "https://api.dropboxapi.com/oauth2/token",
        requiredScopes: [...DROPBOX_PAPER_SCOPES],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools).toHaveLength(2);
    expect(
      registry.getTool("dropbox-paper", "dropbox_paper_write")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      DROPBOX_PAPER_CLIENT_ID: "railway-dropbox-app-key",
      DROPBOX_PAPER_CLIENT_SECRET: "railway-dropbox-app-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "dropbox-paper",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=dropbox-paper",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://www.dropbox.com/oauth2/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/dropbox-paper/callback",
    );
    expect(url.searchParams.get("scope")).toBe(DROPBOX_PAPER_SCOPES.join(" "));
    expect(url.searchParams.get("token_access_type")).toBe("offline");
    expect(url.searchParams.has("code_challenge")).toBe(false);
  });

  it("registers Dropbox as Relay-owned offline OAuth with PKCE and a Railway callback", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("dropbox");
    expect(manifest).toBe(DROPBOX_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://www.dropbox.com/oauth2/authorize",
        tokenUrl: "https://api.dropboxapi.com/oauth2/token",
        requiredScopes: [...DROPBOX_SCOPES],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools).toHaveLength(11);
    expect(
      registry.getTool("dropbox", "dropbox.deleteEntry")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      DROPBOX_CLIENT_ID: "railway-dropbox-app-key",
      DROPBOX_CLIENT_SECRET: "railway-dropbox-app-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "dropbox",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=dropbox",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://www.dropbox.com/oauth2/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/dropbox/callback",
    );
    expect(url.searchParams.get("scope")).toBe(DROPBOX_SCOPES.join(" "));
    expect(url.searchParams.get("token_access_type")).toBe("offline");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
  });

  it("registers Box as Relay-owned confidential OAuth with rotating refresh and a Railway callback", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("box");
    expect(manifest).toBe(BOX_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://account.box.com/api/oauth2/authorize",
        tokenUrl: "https://api.box.com/oauth2/token",
        requiredScopes: [...BOX_SCOPES],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools).toHaveLength(10);
    expect(registry.getTool("box", "box.moveItem")?.approvalRequired).toBe(
      true,
    );
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      BOX_CLIENT_ID: "railway-box-client-id",
      BOX_CLIENT_SECRET: "railway-box-client-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "box", {
      returnTo: "https://relayconsole.work/app?marketplace_app=box",
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://account.box.com/api/oauth2/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/box/callback",
    );
    expect(url.searchParams.get("scope")).toBe(BOX_SCOPES.join(" "));
    expect(url.searchParams.has("code_challenge")).toBe(false);
  });

  it("registers Zoho WorkDrive as Relay-owned regional offline OAuth over the pinned official API", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("zoho-workdrive");
    expect(manifest).toBe(ZOHO_WORKDRIVE_CONNECTOR_MANIFEST);
    expect(ZOHO_WORKDRIVE_OPERATIONS).toHaveLength(229);
    expect(ZOHO_WORKDRIVE_READ_OPERATION_IDS).toHaveLength(90);
    expect(
      ZOHO_WORKDRIVE_CONTENT_WRITE_OPERATION_IDS.length +
        ZOHO_WORKDRIVE_ADMIN_OPERATION_IDS.length,
    ).toBe(139);
    expect(ZOHO_WORKDRIVE_REQUIRED_SCOPES).toHaveLength(66);
    expect(manifest?.tools).toHaveLength(3);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);

    const { service, oauthStateRepo } = connectorOAuthHarness({
      ZOHO_WORKDRIVE_CLIENT_ID: "relay-workdrive-client-id",
      ZOHO_WORKDRIVE_CLIENT_SECRET: "relay-workdrive-client-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "zoho-workdrive",
      { returnTo: "/marketplace?app=zoho-workdrive" },
    );
    const url = new URL(result.authorizationUrl);
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://accounts.zoho.com/oauth/v2/auth",
    );
    expect(url.searchParams.get("scope")).toBe(
      ZOHO_WORKDRIVE_REQUIRED_SCOPES.join(","),
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/zoho-workdrive/callback",
    );
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain(
      "relay-workdrive-client-secret",
    );
  });

  it("registers Mural as a confidential PKCE OAuth connector for the complete public API", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("mural");
    expect(manifest).toBe(MURAL_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl:
          "https://app.mural.co/api/public/v1/authorization/oauth2/",
        tokenUrl:
          "https://app.mural.co/api/public/v1/authorization/oauth2/token",
        requiredScopes: [...MURAL_SCOPES],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("mural", "mural_read")?.name).toBe("mural.read");
    expect(registry.getTool("mural", "mural_write")?.approvalRequired).toBe(
      true,
    );
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "mural_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual(["mural_api_write"]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      MURAL_CLIENT_ID: "railway-mural-client",
      MURAL_CLIENT_SECRET: "railway-mural-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "mural", {
      returnTo: "https://relayconsole.work/app?marketplace_app=mural",
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://app.mural.co/api/public/v1/authorization/oauth2/",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/mural/callback",
    );
    expect(url.searchParams.get("scope")).toBe(MURAL_SCOPES.join(" "));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers FigJam as a Figma OAuth surface with truthful remote capabilities", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("figjam");
    expect(manifest).toBe(FIGJAM_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://www.figma.com/oauth",
        tokenUrl: "https://api.figma.com/v1/oauth/token",
        refreshUrl: "https://api.figma.com/v1/oauth/token",
        requiredScopes: [...FIGJAM_SCOPES],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("figjam", "figjam_read")?.name).toBe("figjam.read");
    expect(registry.getTool("figjam", "figjam_write")?.approvalRequired).toBe(
      true,
    );
    expect(
      manifest?.approvalProfiles
        .find((profile) => profile.id === "figjam_safe")
        ?.blockedActions.map((item) => item.id),
    ).toEqual(["figjam_canvas_write"]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      FIGMA_CLIENT_ID: "relay-figma-client",
      FIGMA_CLIENT_SECRET: "relay-figma-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "figjam", {
      returnTo: "https://relayconsole.work/app?marketplace_app=figjam",
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe("https://www.figma.com/oauth");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/figjam/callback",
    );
    expect(url.searchParams.get("scope")).toBe(FIGJAM_SCOPES.join(" "));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Figma as public PKCE OAuth with Safe and Dangerous design tools", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("figma");
    expect(manifest).toBe(FIGMA_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://www.figma.com/oauth",
        tokenUrl: "https://api.figma.com/v1/oauth/token",
        refreshUrl: "https://api.figma.com/v1/oauth/token",
        requiredScopes: [...FIGMA_SCOPES],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("figma", "figma_read")?.name).toBe("figma.read");
    expect(registry.getTool("figma", "figma_write")?.approvalRequired).toBe(
      true,
    );
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      FIGMA_CLIENT_ID: "relay-figma-client",
      FIGMA_CLIENT_SECRET: "relay-figma-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "figma", {
      returnTo: "https://relayconsole.work/app?marketplace_app=figma",
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe("https://www.figma.com/oauth");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/figma/callback",
    );
    expect(url.searchParams.get("scope")).toBe(FIGMA_SCOPES.join(" "));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Miro as Relay-owned OAuth with bounded board tools", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("miro");
    expect(manifest).toBe(MIRO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://miro.com/oauth/authorize",
        tokenUrl: "https://api.miro.com/v1/oauth/token",
        refreshUrl: "https://api.miro.com/v1/oauth/token",
        revocationUrl: "https://api.miro.com/v2/oauth/revoke",
        requiredScopes: [...MIRO_SCOPES],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools).toHaveLength(8);
    expect(
      registry.getTool("miro", "miro_sticky_note_create")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      MIRO_CLIENT_ID: "relay-miro-client",
      MIRO_CLIENT_SECRET: "relay-miro-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "miro", {
      returnTo: "https://relayconsole.work/app?marketplace_app=miro",
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe("https://miro.com/oauth/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/miro/callback",
    );
    expect(url.searchParams.get("scope")).toBe(MIRO_SCOPES.join(" "));
    expect(url.searchParams.get("code_challenge")).toBeNull();
    expect(url.searchParams.get("code_challenge_method")).toBeNull();
  });

  it("registers Canva as Relay-owned PKCE OAuth with stable design tools", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("canva");
    expect(manifest).toBe(CANVA_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://www.canva.com/api/oauth/authorize",
        tokenUrl: "https://api.canva.com/rest/v1/oauth/token",
        refreshUrl: "https://api.canva.com/rest/v1/oauth/token",
        revocationUrl: "https://api.canva.com/rest/v1/oauth/revoke",
        requiredScopes: [...CANVA_SCOPES],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools).toHaveLength(6);
    expect(
      registry.getTool("canva", "canva_design_create")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      CANVA_CLIENT_ID: "relay-canva-client",
      CANVA_CLIENT_SECRET: "relay-canva-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "canva", {
      returnTo: "https://relayconsole.work/app?marketplace_app=canva",
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://www.canva.com/api/oauth/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/canva/callback",
    );
    expect(url.searchParams.get("scope")).toBe(CANVA_SCOPES.join(" "));
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("registers Webflow as Relay-owned OAuth with staged CMS controls", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("webflow");
    expect(manifest).toBe(WEBFLOW_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://webflow.com/oauth/authorize",
        tokenUrl: "https://api.webflow.com/oauth/access_token",
        revocationUrl: "https://webflow.com/oauth/revoke_authorization",
        requiredScopes: [...WEBFLOW_SCOPES],
        pkce: false,
        supportsRefresh: false,
      }),
    );
    expect(manifest?.tools).toHaveLength(9);
    expect(
      registry.getTool("webflow", "webflow_item_publish")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      WEBFLOW_CLIENT_ID: "relay-webflow-client",
      WEBFLOW_CLIENT_SECRET: "relay-webflow-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "webflow",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=webflow",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://webflow.com/oauth/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/webflow/callback",
    );
    expect(url.searchParams.get("scope")).toBe(WEBFLOW_SCOPES.join(" "));
    expect(url.searchParams.get("code_challenge")).toBeNull();
    expect(url.searchParams.get("code_challenge_method")).toBeNull();
  });

  it("registers WordPress.com as specific-blog Relay-owned OAuth with draft-first publishing", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("wordpress-com");
    expect(manifest).toBe(WORDPRESS_COM_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://public-api.wordpress.com/oauth2/authorize",
        tokenUrl: "https://public-api.wordpress.com/oauth2/token",
        requiredScopes: [...WORDPRESS_COM_SCOPES],
        pkce: false,
        supportsRefresh: false,
      }),
    );
    expect(manifest?.tools).toHaveLength(8);
    expect(
      registry.getTool("wordpress-com", "wordpress_com_post_publish")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      WORDPRESS_COM_CLIENT_ID: "relay-wordpress-com-client",
      WORDPRESS_COM_CLIENT_SECRET: "relay-wordpress-com-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "wordpress-com",
      {
        returnTo: "https://relayconsole.work/app?marketplace_app=wordpress-com",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://public-api.wordpress.com/oauth2/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/wordpress-com/callback",
    );
    expect(url.searchParams.get("scope")).toBe(WORDPRESS_COM_SCOPES.join(" "));
    expect(url.searchParams.get("code_challenge")).toBeNull();
    expect(url.searchParams.get("code_challenge_method")).toBeNull();
    expect(url.searchParams.get("blog")).toBeNull();
  });

  it("registers Ghost as a user-owned Custom Integration with short-lived JWT tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("ghost");
    expect(manifest).toBe(GHOST_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: expect.arrayContaining([
        expect.objectContaining({ name: "GHOST_ADMIN_URL", secret: false }),
        expect.objectContaining({ name: "GHOST_ADMIN_API_KEY", secret: true }),
      ]),
    });
    expect(manifest?.tools).toHaveLength(7);
    expect(
      registry.getTool("ghost", "ghost_post_publish")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Contentful as Relay-owned public OAuth with draft-first entry tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("contentful");
    expect(manifest).toBe(CONTENTFUL_CONNECTOR_MANIFEST);
    expect(manifest?.tools).toHaveLength(11);
    expect(manifest?.auth.oauth).toMatchObject({
      authorizationUrl: "https://be.contentful.com/oauth/authorize",
      requiredScopes: ["content_management_manage"],
      pkce: false,
      supportsRefresh: false,
    });
    expect(
      manifest?.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual([
      "contentful_entry_create_draft",
      "contentful_entry_update_draft",
      "contentful_entry_publish",
    ]);
  });

  it("registers Sanity as a customer-owned robot-token connector with revision-safe draft tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("sanity");
    expect(manifest).toBe(SANITY_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: expect.arrayContaining([
        expect.objectContaining({ name: "SANITY_PROJECT_ID", secret: false }),
        expect.objectContaining({ name: "SANITY_DATASET", secret: false }),
        expect.objectContaining({ name: "SANITY_API_TOKEN", secret: true }),
      ]),
    });
    expect(manifest?.tools).toHaveLength(7);
    expect(
      registry.getTool("sanity", "sanity_document_update_draft")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("sanity", "sanity.publishDocument")?.functionName,
    ).toBe("sanity_document_publish");
    expect(
      manifest?.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual([
      "sanity_document_create_draft",
      "sanity_document_update_draft",
      "sanity_document_publish",
    ]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Strapi Cloud as a customer-owned Content API token connector with an exact project and content-type boundary", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("strapi-cloud");
    expect(manifest).toBe(STRAPI_CLOUD_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: expect.arrayContaining([
        expect.objectContaining({
          name: "STRAPI_CLOUD_INSTANCE_URL",
          secret: false,
        }),
        expect.objectContaining({
          name: "STRAPI_CLOUD_ALLOWED_API_IDS",
          secret: false,
        }),
        expect.objectContaining({
          name: "STRAPI_CLOUD_API_TOKEN",
          secret: true,
        }),
      ]),
    });
    expect(manifest?.tools).toHaveLength(7);
    expect(
      registry.getTool("strapi-cloud", "strapi_cloud_document_update_draft")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("strapi-cloud", "strapiCloud.publishDocument")
        ?.functionName,
    ).toBe("strapi_cloud_document_publish");
    expect(
      manifest?.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual([
      "strapi_cloud_document_create_draft",
      "strapi_cloud_document_update_draft",
      "strapi_cloud_document_publish",
    ]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Shopify as Relay-owned expiring offline OAuth with nine product-catalog tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("shopify");
    expect(manifest).toBe(SHOPIFY_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://{shop}.myshopify.com/admin/oauth/authorize",
        tokenUrl: "https://{shop}.myshopify.com/admin/oauth/access_token",
        requiredScopes: SHOPIFY_SCOPES,
        pkce: false,
        supportsRefresh: true,
      },
    });
    expect(manifest?.tools).toHaveLength(9);
    expect(
      registry.getTool("shopify", "shopify_product_publish")?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("shopify", "shopify.prepareProductChange")?.functionName,
    ).toBe("shopify_product_prepare");
    expect(
      manifest?.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual([
      "shopify_product_create_draft",
      "shopify_product_update_draft",
      "shopify_product_activate",
      "shopify_product_publish",
    ]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers WooCommerce as a customer-owned exact-store connector with seven product tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("woocommerce");
    expect(manifest).toBe(WOOCOMMERCE_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: expect.arrayContaining([
        expect.objectContaining({
          name: "WOOCOMMERCE_STORE_ORIGIN",
          secret: false,
        }),
        expect.objectContaining({
          name: "WOOCOMMERCE_CONSUMER_KEY",
          secret: true,
        }),
        expect.objectContaining({
          name: "WOOCOMMERCE_CONSUMER_SECRET",
          secret: true,
        }),
      ]),
    });
    expect(manifest?.tools).toHaveLength(7);
    expect(
      registry.getTool("woocommerce", "woocommerce_product_publish")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("woocommerce", "woocommerce.prepareProductChange")
        ?.functionName,
    ).toBe("woocommerce_product_prepare");
    expect(
      manifest?.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual([
      "woocommerce_product_create_draft",
      "woocommerce_product_update_draft",
      "woocommerce_product_publish",
    ]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Stripe as Relay-owned Stripe Apps OAuth with three read-only tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("stripe");
    expect(manifest).toBe(STRIPE_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://marketplace.stripe.com/oauth/v2/authorize",
        tokenUrl: "https://api.stripe.com/v1/oauth/token",
        requiredScopes: STRIPE_APP_PERMISSIONS,
        pkce: false,
        supportsRefresh: true,
      },
    });
    expect(manifest?.tools).toHaveLength(3);
    expect(
      registry.getTool("stripe", "stripe_payment_intent_list")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual(["stripe_payment_intent_list", "stripe_payment_intent_get"]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers PayPal as customer-owned client credentials with four redacted read-only tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("paypal");
    expect(manifest).toBe(PAYPAL_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: expect.arrayContaining([
        expect.objectContaining({ name: "PAYPAL_CLIENT_ID", secret: false }),
        expect.objectContaining({ name: "PAYPAL_CLIENT_SECRET", secret: true }),
        expect.objectContaining({ name: "PAYPAL_ENVIRONMENT", secret: false }),
      ]),
    });
    expect(manifest?.tools).toHaveLength(4);
    expect(
      registry.getTool("paypal", "paypal_transaction_list")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual([
      "paypal_transaction_list",
      "paypal_transaction_get",
      "paypal_order_get",
      "paypal_capture_get",
    ]);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("registers Xero as customer-owned OAuth bound to one organisation", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("xero");
    expect(manifest).toBe(XERO_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://login.xero.com/identity/connect/authorize",
        tokenUrl: "https://identity.xero.com/connect/token",
        requiredScopes: XERO_SCOPES,
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: expect.arrayContaining([
        expect.objectContaining({ name: "XERO_CLIENT_ID", secret: false }),
        expect.objectContaining({ name: "XERO_CLIENT_SECRET", secret: true }),
      ]),
    });
    expect(manifest?.tools).toHaveLength(3);
    expect(registry.getTool("xero", "xero_invoice_get")?.approvalRequired).toBe(
      true,
    );
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("starts customer-owned Xero OAuth and uses Basic token authentication", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({});
    const started = await service.startOAuth("workspace_1", "user_1", "xero", {
      clientId: "customer-xero-id",
      clientSecret: "customer-xero-secret",
      selectedCapabilities: ["organisation_read", "invoice_read"],
    });
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://login.xero.com/identity/connect/authorize",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe("customer-xero-id");
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/xero/callback",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(XERO_SCOPES.join(" "));
    expect(authorizeUrl.searchParams.has("client_secret")).toBe(false);
    expect(JSON.stringify(oauthStateRepo.save.mock.calls[0][0])).not.toContain(
      "customer-xero-secret",
    );
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "xero-access",
        refresh_token: "xero-refresh",
        expires_in: 1800,
        scope: XERO_SCOPES.join(" "),
      }),
    } as any);
    await service.exchangeToken("xero", {
      grant_type: "authorization_code",
      code: "xero-code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/xero/callback",
      client_id: "customer-xero-id",
      client_secret: "customer-xero-secret",
    });
    const [tokenUrl, options] = fetchMock.mock.calls[0] as any;
    expect(tokenUrl).toBe("https://identity.xero.com/connect/token");
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from("customer-xero-id:customer-xero-secret").toString("base64")}`,
    );
    expect(String(options.body)).not.toContain("customer-xero-secret");
  });

  it("registers QuickBooks as Relay-owned OAuth bound to one company", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("quickbooks");
    expect(manifest).toBe(QUICKBOOKS_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://appcenter.intuit.com/connect/oauth2",
        tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
        requiredScopes: QUICKBOOKS_SCOPES,
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools).toHaveLength(5);
    expect(
      registry.getTool("quickbooks", "quickbooks_invoice_get")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("quickbooks", "quickbooks_payroll_compensations_list")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("quickbooks", "quickbooks_payment_charge_get")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("starts QuickBooks OAuth from Railway and uses Basic token authentication", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      QUICKBOOKS_CLIENT_ID: "relay-intuit-client",
      QUICKBOOKS_CLIENT_SECRET: "relay-intuit-secret",
      QUICKBOOKS_ENVIRONMENT: "sandbox",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "quickbooks",
      {
        selectedCapabilities: [
          "company_read",
          "invoice_read",
          "payroll_compensation_read",
          "payment_charge_read",
        ],
      },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://appcenter.intuit.com/connect/oauth2",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-intuit-client",
    );
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/quickbooks/callback",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(
      QUICKBOOKS_SCOPES.join(" "),
    );
    expect(authorizeUrl.searchParams.has("client_secret")).toBe(false);
    expect(JSON.stringify(oauthStateRepo.save.mock.calls[0][0])).not.toContain(
      "relay-intuit-secret",
    );
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "quickbooks-access",
        refresh_token: "quickbooks-refresh",
        expires_in: 3600,
        scope: QUICKBOOKS_SCOPES.join(" "),
      }),
    } as any);
    await service.exchangeToken("quickbooks", {
      grant_type: "authorization_code",
      code: "quickbooks-code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/quickbooks/callback",
      client_id: "relay-intuit-client",
      client_secret: "relay-intuit-secret",
    });
    const [tokenUrl, options] = fetchMock.mock.calls[0] as any;
    expect(tokenUrl).toBe(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    );
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from("relay-intuit-client:relay-intuit-secret").toString("base64")}`,
    );
    expect(String(options.body)).not.toContain("relay-intuit-secret");
  });

  it("registers FreshBooks as Relay-owned OAuth bound to one business account", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("freshbooks");
    expect(manifest).toBe(FRESHBOOKS_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://auth.freshbooks.com/oauth/authorize/",
        tokenUrl: "https://api.freshbooks.com/auth/oauth/token",
        requiredScopes: FRESHBOOKS_SCOPES,
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools).toHaveLength(3);
    expect(
      registry.getTool("freshbooks", "freshbooks_invoice_get")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("starts FreshBooks OAuth from Railway and exchanges tokens as JSON", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      FRESHBOOKS_CLIENT_ID: "relay-freshbooks-client",
      FRESHBOOKS_CLIENT_SECRET: "relay-freshbooks-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "freshbooks",
      { selectedCapabilities: ["business_membership_read", "invoice_read"] },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://auth.freshbooks.com/oauth/authorize/",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-freshbooks-client",
    );
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/freshbooks/callback",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(
      FRESHBOOKS_SCOPES.join(" "),
    );
    expect(JSON.stringify(oauthStateRepo.save.mock.calls[0][0])).not.toContain(
      "relay-freshbooks-secret",
    );
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "freshbooks-access",
        refresh_token: "freshbooks-refresh",
        expires_in: 3600,
        scope: FRESHBOOKS_SCOPES.join(" "),
      }),
    } as any);
    await service.exchangeToken("freshbooks", {
      grant_type: "authorization_code",
      code: "freshbooks-code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/freshbooks/callback",
      client_id: "relay-freshbooks-client",
      client_secret: "relay-freshbooks-secret",
    });
    const [tokenUrl, options] = fetchMock.mock.calls[0] as any;
    expect(tokenUrl).toBe("https://api.freshbooks.com/auth/oauth/token");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(options.body))).toMatchObject({
      client_id: "relay-freshbooks-client",
      client_secret: "relay-freshbooks-secret",
      code: "freshbooks-code",
    });
  });

  it("registers Wave as Relay-owned OAuth bound to one eligible business", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("wave");
    expect(manifest).toBe(WAVE_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://api.waveapps.com/oauth2/authorize/",
        tokenUrl: "https://api.waveapps.com/oauth2/token/",
        revocationUrl: "https://api.waveapps.com/oauth2/token-revoke/",
        requiredScopes: WAVE_SCOPES,
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools).toHaveLength(3);
    expect(registry.getTool("wave", "wave_invoice_get")?.approvalRequired).toBe(
      true,
    );
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("starts Wave OAuth from Railway and exchanges confidential tokens as form data", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      WAVE_CLIENT_ID: "relay-wave-client",
      WAVE_CLIENT_SECRET: "relay-wave-secret",
    });
    const started = await service.startOAuth("workspace_1", "user_1", "wave", {
      selectedCapabilities: ["business_read", "invoice_read"],
    });
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://api.waveapps.com/oauth2/authorize/",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-wave-client",
    );
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/wave/callback",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(WAVE_SCOPES.join(" "));
    expect(JSON.stringify(oauthStateRepo.save.mock.calls[0][0])).not.toContain(
      "relay-wave-secret",
    );
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "wave-access",
        refresh_token: "wave-refresh",
        expires_in: 3600,
        scope: WAVE_SCOPES.join(" "),
        businessId: "QnVzaW5lc3M6cmVsYXktZGVtby",
      }),
    } as any);
    await service.exchangeToken("wave", {
      grant_type: "authorization_code",
      code: "wave-code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/wave/callback",
      client_id: "relay-wave-client",
      client_secret: "relay-wave-secret",
    });
    const [tokenUrl, options] = fetchMock.mock.calls[0] as any;
    expect(tokenUrl).toBe("https://api.waveapps.com/oauth2/token/");
    expect(options.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const form = new URLSearchParams(String(options.body));
    expect(form.get("client_id")).toBe("relay-wave-client");
    expect(form.get("client_secret")).toBe("relay-wave-secret");
    expect(form.get("code")).toBe("wave-code");
  });

  it("registers FreeAgent as scope-less Relay-owned OAuth bound to one company", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("freeagent");
    expect(manifest).toBe(FREEAGENT_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://api.freeagent.com/v2/approve_app",
        tokenUrl: "https://api.freeagent.com/v2/token_endpoint",
        refreshUrl: "https://api.freeagent.com/v2/token_endpoint",
        requiredScopes: FREEAGENT_SCOPES,
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools).toHaveLength(3);
    expect(
      registry.getTool("freeagent", "freeagent_invoice_get")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("starts FreeAgent OAuth without invented scopes and uses HTTP Basic for tokens", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      FREEAGENT_CLIENT_ID: "relay-freeagent-client",
      FREEAGENT_CLIENT_SECRET: "relay-freeagent-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "freeagent",
      { selectedCapabilities: ["company_read", "invoice_read"] },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://api.freeagent.com/v2/approve_app",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-freeagent-client",
    );
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/freeagent/callback",
    );
    expect(authorizeUrl.searchParams.has("scope")).toBe(false);
    expect(JSON.stringify(oauthStateRepo.save.mock.calls[0][0])).not.toContain(
      "relay-freeagent-secret",
    );
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "freeagent-access",
        refresh_token: "freeagent-refresh",
        expires_in: 3600,
      }),
    } as any);
    await service.exchangeToken("freeagent", {
      grant_type: "authorization_code",
      code: "freeagent-code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/freeagent/callback",
      client_id: "relay-freeagent-client",
      client_secret: "relay-freeagent-secret",
    });
    const [tokenUrl, options] = fetchMock.mock.calls[0] as any;
    expect(tokenUrl).toBe("https://api.freeagent.com/v2/token_endpoint");
    expect(options.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from("relay-freeagent-client:relay-freeagent-secret").toString("base64")}`,
    );
    const form = new URLSearchParams(String(options.body));
    expect(form.get("client_id")).toBeNull();
    expect(form.get("client_secret")).toBeNull();
    expect(form.get("code")).toBe("freeagent-code");
  });

  it("registers Salesforce as Relay-owned packaged ECA OAuth with three bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("salesforce");
    expect(manifest).toBe(SALESFORCE_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        requiredScopes: SALESFORCE_SCOPES,
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools).toHaveLength(3);
    expect(manifest?.tools.every((tool) => tool.approvalRequired)).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("starts Salesforce sandbox OAuth with PKCE and exact Relay callback", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      SALESFORCE_CLIENT_ID: "relay-salesforce-client",
      SALESFORCE_CLIENT_SECRET: "relay-salesforce-secret",
      SALESFORCE_ENVIRONMENT: "sandbox",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "salesforce",
      { selectedCapabilities: ["account_read", "opportunity_read"] },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://test.salesforce.com/services/oauth2/authorize",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-salesforce-client",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe("api refresh_token");
    expect(authorizeUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorizeUrl.searchParams.get("code_challenge")).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/salesforce/callback",
    );
    expect(JSON.stringify(oauthStateRepo.save.mock.calls[0][0])).not.toContain(
      "relay-salesforce-secret",
    );
  });

  it("registers HubSpot as Relay-owned OAuth with three bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("hubspot");
    expect(manifest).toBe(HUBSPOT_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        requiredScopes: HUBSPOT_SCOPES,
        pkce: false,
        supportsRefresh: true,
        tokenUrl: "https://api.hubapi.com/oauth/2026-03/token",
      },
      credentialSchema: [],
    });
    expect(manifest?.tools).toHaveLength(3);
    expect(manifest?.tools.every((tool) => tool.approvalRequired)).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("starts HubSpot OAuth with exact scopes and Relay callback", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      HUBSPOT_CLIENT_ID: "relay-hubspot-client",
      HUBSPOT_CLIENT_SECRET: "relay-hubspot-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "hubspot",
      { selectedCapabilities: ["company_read", "deal_read"] },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://app.hubspot.com/oauth/authorize",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-hubspot-client",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(
      HUBSPOT_SCOPES.join(" "),
    );
    expect(authorizeUrl.searchParams.get("code_challenge")).toBeNull();
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/hubspot/callback",
    );
    expect(JSON.stringify(oauthStateRepo.save.mock.calls[0][0])).not.toContain(
      "relay-hubspot-secret",
    );
  });

  it("registers Pipedrive as Relay-owned OAuth with three bounded reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("pipedrive");
    expect(manifest).toBe(PIPEDRIVE_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        requiredScopes: PIPEDRIVE_SCOPES,
        pkce: false,
        supportsRefresh: true,
        tokenUrl: "https://oauth.pipedrive.com/oauth/token",
      },
      credentialSchema: [],
    });
    expect(manifest?.tools).toHaveLength(3);
    expect(manifest?.tools.every((tool) => tool.approvalRequired)).toBe(true);
  });

  it("starts Pipedrive OAuth with exact scopes and exchanges tokens using HTTP Basic", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      PIPEDRIVE_CLIENT_ID: "relay-pipedrive-client",
      PIPEDRIVE_CLIENT_SECRET: "relay-pipedrive-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "pipedrive",
      {
        selectedCapabilities: ["organization_read", "deal_read"],
      },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://oauth.pipedrive.com/oauth/authorize",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-pipedrive-client",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(
      PIPEDRIVE_SCOPES.join(" "),
    );
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/pipedrive/callback",
    );
    expect(JSON.stringify(oauthStateRepo.save.mock.calls[0][0])).not.toContain(
      "relay-pipedrive-secret",
    );
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "access",
        refresh_token: "refresh",
        api_domain: "https://relay.pipedrive.com",
      }),
    } as any);
    await (service as any).exchangeToken("pipedrive", {
      grant_type: "authorization_code",
      code: "code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/pipedrive/callback",
      client_id: "relay-pipedrive-client",
      client_secret: "relay-pipedrive-secret",
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("relay-pipedrive-client:relay-pipedrive-secret").toString("base64")}`,
    );
    expect(String(init.body)).not.toContain("relay-pipedrive-secret");
    expect(String(init.body)).not.toContain("relay-pipedrive-client");
    fetchMock.mockRestore();
  });

  it("registers Zoho CRM as Relay-owned multi-DC OAuth with three bounded reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("zoho");
    expect(manifest).toBe(ZOHO_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        requiredScopes: ZOHO_SCOPES,
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools).toHaveLength(3);
    expect(manifest?.tools.every((tool) => tool.approvalRequired)).toBe(true);
  });

  it("starts Zoho CRM OAuth on the configured allowlisted data center without persisting the Relay secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      ZOHO_CLIENT_ID: "relay-zoho-client",
      ZOHO_CLIENT_SECRET: "relay-zoho-secret",
      ZOHO_ACCOUNTS_ORIGIN: "https://accounts.zoho.eu",
    });
    const started = await service.startOAuth("workspace_1", "user_1", "zoho", {
      selectedCapabilities: ["account_read", "deal_read"],
    });
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://accounts.zoho.eu/oauth/v2/auth",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-zoho-client",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(ZOHO_SCOPES.join(","));
    expect(authorizeUrl.searchParams.get("access_type")).toBe("offline");
    expect(authorizeUrl.searchParams.get("prompt")).toBe("consent");
    expect(authorizeUrl.searchParams.has("code_challenge")).toBe(false);
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/zoho/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-zoho-secret");
  });

  it("registers Zoho Desk as Relay-owned organization-bound Multi-DC OAuth with two bounded reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("zoho-desk");
    expect(manifest).toBe(ZOHO_DESK_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        requiredScopes: ZOHO_DESK_SCOPES,
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "zoho_desk_ticket_list",
      "zoho_desk_ticket_get",
    ]);
    expect(manifest?.tools.every((tool) => tool.approvalRequired)).toBe(true);
  });

  it("starts Zoho Desk OAuth with exact scopes, offline consent, regional authority, and no persisted Relay secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      ZOHO_CLIENT_ID: "relay-zoho-client",
      ZOHO_CLIENT_SECRET: "relay-zoho-secret",
      ZOHO_ACCOUNTS_ORIGIN: "https://accounts.zoho.eu",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "zoho-desk",
      { selectedCapabilities: ["ticket_read"] },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://accounts.zoho.eu/oauth/v2/auth",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-zoho-client",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(
      ZOHO_DESK_SCOPES.join(","),
    );
    expect(authorizeUrl.searchParams.get("access_type")).toBe("offline");
    expect(authorizeUrl.searchParams.get("prompt")).toBe("consent");
    expect(authorizeUrl.searchParams.has("code_challenge")).toBe(false);
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/zoho-desk/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-zoho-secret");
  });

  it("registers Zoho Projects as portal-bound Multi-DC OAuth with three bounded reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("zoho-projects");
    expect(manifest).toBe(ZOHO_PROJECTS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toMatchObject({
      requiredScopes: ZOHO_PROJECTS_SCOPES,
      pkce: false,
      supportsRefresh: true,
    });
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "ZOHO_PROJECTS_PORTAL_ID",
    ]);
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "zoho_projects_project_list",
      "zoho_projects_task_list",
      "zoho_projects_task_get",
    ]);
    expect(manifest?.tools.every((tool) => tool.approvalRequired)).toBe(true);
  });

  it("starts Zoho Projects OAuth with portal session, exact scopes, offline consent, and no persisted Relay secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      ZOHO_CLIENT_ID: "relay-zoho-client",
      ZOHO_CLIENT_SECRET: "relay-zoho-secret",
      ZOHO_ACCOUNTS_ORIGIN: "https://accounts.zoho.eu",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "zoho-projects",
      {
        selectedCapabilities: ["project_task_read"],
        providerDomain: "2389290",
      },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://accounts.zoho.eu/oauth/v2/auth",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(
      ZOHO_PROJECTS_SCOPES.join(","),
    );
    expect(authorizeUrl.searchParams.get("access_type")).toBe("offline");
    expect(authorizeUrl.searchParams.get("prompt")).toBe("consent");
    expect(authorizeUrl.searchParams.has("code_challenge")).toBe(false);
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/zoho-projects/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.providerSessionCiphertext).toBeTruthy();
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-zoho-secret");
  });

  it("registers Clay as one encrypted-key, approval-gated workspace read", () => {
    const manifest = new MarketplaceConnectorRegistry().get("clay");
    expect(manifest).toBe(CLAY_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        { name: "CLAY_PUBLIC_API_KEY", secret: true, required: true },
      ],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "clay_workspace_get",
    ]);
    expect(manifest?.tools.every((tool) => tool.approvalRequired)).toBe(true);
  });
  it("registers Claygent as workspace validation with execution hard-blocked", () => {
    const manifest = new MarketplaceConnectorRegistry().get("claygent");
    expect(manifest).toBe(CLAYGENT_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "CLAYGENT_PUBLIC_API_KEY",
    ]);
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "claygent_workspace_get",
    ]);
    expect(
      manifest?.approvalProfiles[1].blockedActions.map((item) => item.id),
    ).toContain("claygent_run");
  });
  it("registers PhantomBuster as exact-Agent status only", () => {
    const manifest = new MarketplaceConnectorRegistry().get("phantombuster");
    expect(manifest).toBe(PHANTOMBUSTER_CONNECTOR_MANIFEST);
    expect(manifest?.tools.map((t) => t.functionName)).toEqual([
      "phantombuster_agent_status_get",
    ]);
    expect(
      manifest?.approvalProfiles[1].blockedActions.map((x) => x.id),
    ).toContain("phantombuster_agent_run");
  });
  it("registers TexAu as one privacy-redacted classifier", () => {
    const manifest = new MarketplaceConnectorRegistry().get("texau");
    expect(manifest).toBe(TEXAU_CONNECTOR_MANIFEST);
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "texau_email_type_identify",
    ]);
    expect(
      manifest?.approvalProfiles[1].blockedActions.map((item) => item.id),
    ).toContain("texau_enrichment");
  });
  it("registers Evaboot as privacy-redacted quota only", () => {
    const manifest = new MarketplaceConnectorRegistry().get("evaboot");
    expect(manifest).toBe(EVABOOT_CONNECTOR_MANIFEST);
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "evaboot_quota_get",
    ]);
    expect(
      manifest?.approvalProfiles[1].blockedActions.map((item) => item.id),
    ).toContain("evaboot_extraction");
  });
  it("registers lemlist as one exact privacy-redacted campaign status read", () => {
    const manifest = new MarketplaceConnectorRegistry().get("lemlist");
    expect(manifest).toBe(LEMLIST_CONNECTOR_MANIFEST);
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "lemlist_campaign_status_get",
    ]);
    expect(
      manifest?.approvalProfiles[1].blockedActions.map((item) => item.id),
    ).toContain("lemlist_people_messaging");
  });
  it("registers Mailshake as one exact privacy-redacted campaign status read", () => {
    const manifest = new MarketplaceConnectorRegistry().get("mailshake");
    expect(manifest).toBe(MAILSHAKE_CONNECTOR_MANIFEST);
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "mailshake_campaign_status_get",
    ]);
    expect(
      manifest?.approvalProfiles[1].blockedActions.map((item) => item.id),
    ).toContain("mailshake_people_messaging");
  });
  it("registers Woodpecker as one exact privacy-redacted campaign status read", () => {
    const manifest = new MarketplaceConnectorRegistry().get("woodpecker");
    expect(manifest).toBe(WOODPECKER_CONNECTOR_MANIFEST);
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "woodpecker_campaign_status_get",
    ]);
    expect(
      manifest?.approvalProfiles[1].blockedActions.map((item) => item.id),
    ).toContain("woodpecker_prospect_messaging");
  });
  it("registers Reply.io as one exact privacy-redacted sequence status read", () => {
    const manifest = new MarketplaceConnectorRegistry().get("reply-io");
    expect(manifest).toBe(REPLY_IO_CONNECTOR_MANIFEST);
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "reply_io_sequence_status_get",
    ]);
    expect(
      manifest?.approvalProfiles[1].blockedActions.map((item) => item.id),
    ).toContain("reply_io_people_messaging");
  });
  it("registers Mixmax as one exact privacy-redacted sequence summary read", () => {
    const manifest = new MarketplaceConnectorRegistry().get("mixmax");
    expect(manifest).toBe(MIXMAX_CONNECTOR_MANIFEST);
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "mixmax_sequence_summary_get",
    ]);
    expect(
      manifest?.approvalProfiles[1].blockedActions.map((item) => item.id),
    ).toContain("mixmax_recipient_messaging");
  });
  it("registers Cirrus Insight as one exact privacy-redacted scheduling-link read", () => {
    const manifest = new MarketplaceConnectorRegistry().get("cirrus-insight");
    expect(manifest).toBe(CIRRUS_INSIGHT_CONNECTOR_MANIFEST);
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "cirrus_insight_scheduling_links_get",
    ]);
    expect(
      manifest?.approvalProfiles[1].blockedActions.map((item) => item.id),
    ).toContain("cirrus_insight_people_content");
  });
  it("registers SPOTIO as one exact privacy-redacted data-object summary read", () => {
    const manifest = new MarketplaceConnectorRegistry().get("spotio");
    expect(manifest).toBe(SPOTIO_CONNECTOR_MANIFEST);
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "spotio_data_object_summary_get",
    ]);
    expect(
      manifest?.approvalProfiles[1].blockedActions.map((item) => item.id),
    ).toContain("spotio_people_location_content");
  });

  it("registers Copper as Relay-owned partner OAuth with three bounded reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("copper");
    expect(manifest).toBe(COPPER_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        requiredScopes: COPPER_SCOPES,
        pkce: false,
        supportsRefresh: false,
        tokenUrl: "https://app.copper.com/oauth/token",
      },
      credentialSchema: [],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "copper_account_get",
      "copper_opportunity_list",
      "copper_opportunity_get",
    ]);
    expect(manifest?.tools.every((tool) => tool.approvalRequired)).toBe(true);
  });

  it("starts Copper OAuth with the broad provider scope without persisting Relay credentials", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      COPPER_CLIENT_ID: "relay-copper-client",
      COPPER_CLIENT_SECRET: "relay-copper-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "copper",
      { selectedCapabilities: ["account_read", "opportunity_read"] },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://app.copper.com/oauth/authorize",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-copper-client",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(
      COPPER_SCOPES.join(" "),
    );
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/copper/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-copper-secret");
  });

  it("exchanges Copper authorization codes with form-encoded partner credentials", async () => {
    const { service } = connectorOAuthHarness({
      COPPER_CLIENT_ID: "relay-copper-client",
      COPPER_CLIENT_SECRET: "relay-copper-secret",
    });
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "access", scope: "developer/v1/all" }),
    } as any);

    await (service as any).exchangeToken("copper", {
      grant_type: "authorization_code",
      code: "code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/copper/callback",
      client_id: "relay-copper-client",
      client_secret: "relay-copper-secret",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://app.copper.com/oauth/token");
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
    const form = new URLSearchParams(String(init.body));
    expect(form.get("client_id")).toBe("relay-copper-client");
    expect(form.get("client_secret")).toBe("relay-copper-secret");
    fetchMock.mockRestore();
  });

  it("registers Close as Relay-owned OAuth with three bounded reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("close");
    expect(manifest).toBe(CLOSE_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        requiredScopes: CLOSE_SCOPES,
        pkce: false,
        supportsRefresh: true,
        tokenUrl: "https://api.close.com/oauth2/token/",
        revocationUrl: "https://api.close.com/oauth2/revoke/",
      },
      credentialSchema: [],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "close_organization_get",
      "close_opportunity_list",
      "close_opportunity_get",
    ]);
    expect(manifest?.tools.every((tool) => tool.approvalRequired)).toBe(true);
  });

  it("starts Close OAuth without persisting Relay credentials", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      CLOSE_CLIENT_ID: "relay-close-client",
      CLOSE_CLIENT_SECRET: "relay-close-secret",
    });
    const started = await service.startOAuth("workspace_1", "user_1", "close", {
      selectedCapabilities: ["organization_read", "opportunity_read"],
    });
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://app.close.com/oauth2/authorize/",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-close-client",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe(CLOSE_SCOPES.join(" "));
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/close/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-close-secret");
  });

  it("exchanges Close authorization codes with form-encoded confidential credentials", async () => {
    const { service } = connectorOAuthHarness({
      CLOSE_CLIENT_ID: "relay-close-client",
      CLOSE_CLIENT_SECRET: "relay-close-secret",
    });
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "close-access",
        refresh_token: "close-refresh",
        expires_in: 3600,
        scope: CLOSE_SCOPES.join(" "),
        organization_id: "orga_Relay123",
        user_id: "user_Relay123",
      }),
    } as any);

    await (service as any).exchangeToken("close", {
      grant_type: "authorization_code",
      code: "code",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/close/callback",
      client_id: "relay-close-client",
      client_secret: "relay-close-secret",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.close.com/oauth2/token/");
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
    const form = new URLSearchParams(String(init.body));
    expect(form.get("client_id")).toBe("relay-close-client");
    expect(form.get("client_secret")).toBe("relay-close-secret");
    fetchMock.mockRestore();
  });

  it("revokes the Close rotating refresh token before clearing the local connection", async () => {
    const { service, credentials, connectionRepo } = connectorOAuthHarness({
      CLOSE_CLIENT_ID: "relay-close-client",
      CLOSE_CLIENT_SECRET: "relay-close-secret",
    });
    const connection = {
      id: "conn_close",
      workspaceId: "workspace_1",
      appSlug: "close",
      displayName: "Close",
      authType: "oauth2_authorization_code",
      credentialNames: [],
      selectedCapabilities: ["organization_read", "opportunity_read"],
      status: "ready",
      metadata: {
        closeOrganizationId: "orga_Relay123",
        closeUserId: "user_Relay123",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    credentials.applyEncrypted(connection, {
      accessToken: "close-access",
      refreshToken: "close-refresh",
      grantedScopes: [...CLOSE_SCOPES],
    });
    jest
      .spyOn(service, "getConnectionWithSecrets")
      .mockResolvedValue(connection);
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue({ ok: true } as any);

    await service.disconnect("workspace_1", "user_1", "close", "conn_close");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.close.com/oauth2/revoke/",
    );
    const revokeBody = new URLSearchParams(
      String((fetchMock.mock.calls[0][1] as any).body),
    );
    expect(revokeBody.get("client_id")).toBe("relay-close-client");
    expect(revokeBody.get("client_secret")).toBe("relay-close-secret");
    expect(revokeBody.get("token")).toBe("close-refresh");
    expect(revokeBody.toString()).not.toContain("close-access");
    const saved = connectionRepo.save.mock.calls.at(-1)?.[0];
    expect(credentials.decrypt(saved)).toBeNull();
    expect(saved.status).toBe("needs_credentials");
    expect(saved.metadata).toEqual(
      expect.objectContaining({
        provider: "close",
        tokenStatus: "disconnected",
      }),
    );
  });

  it("registers Zendesk global OAuth with three bounded ticket reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("zendesk");
    expect(manifest).toBe(ZENDESK_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        requiredScopes: ZENDESK_SCOPES,
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [
        expect.objectContaining({
          name: "zendeskSubdomain",
          required: true,
          secret: false,
          storedIn: "metadata",
        }),
      ],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "zendesk_ticket_count",
      "zendesk_ticket_list",
      "zendesk_ticket_get",
    ]);
    expect(manifest?.tools.every((tool) => tool.approvalRequired)).toBe(true);
  });

  it("starts Zendesk OAuth on one exact tenant without persisting Relay credentials", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      ZENDESK_CLIENT_ID: "zdg-relay-console",
      ZENDESK_CLIENT_SECRET: "relay-zendesk-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "zendesk",
      {
        providerDomain: "relay-support",
        selectedCapabilities: ["ticket_read"],
      },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://relay-support.zendesk.com/oauth/authorizations/new",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "zdg-relay-console",
    );
    expect(authorizeUrl.searchParams.get("scope")).toBe("tickets:read");
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/zendesk/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.authorityTokenUrl).toBe(
      "https://relay-support.zendesk.com/oauth/tokens",
    );
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-zendesk-secret");
  });

  it("exchanges Zendesk tokens as JSON against the exact tenant", async () => {
    const { service } = connectorOAuthHarness({
      ZENDESK_CLIENT_ID: "zdg-relay-console",
      ZENDESK_CLIENT_SECRET: "relay-zendesk-secret",
    });
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "zendesk-access",
        refresh_token: "zendesk-refresh",
        expires_in: 1800,
        refresh_token_expires_in: 2592000,
        scope: "tickets:read",
      }),
    } as any);

    await (service as any).exchangeToken(
      "zendesk",
      {
        grant_type: "authorization_code",
        code: "code",
        client_id: "zdg-relay-console",
        client_secret: "relay-zendesk-secret",
        expires_in: "1800",
        refresh_token_expires_in: "2592000",
      },
      { tokenUrl: "https://relay-support.zendesk.com/oauth/tokens" },
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://relay-support.zendesk.com/oauth/tokens");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(String(init.body))).toEqual(
      expect.objectContaining({
        client_id: "zdg-relay-console",
        client_secret: "relay-zendesk-secret",
        expires_in: "1800",
        refresh_token_expires_in: "2592000",
      }),
    );
    fetchMock.mockRestore();
  });

  it("revokes the exact Zendesk tenant token before clearing the connection", async () => {
    const { service, credentials, connectionRepo } = connectorOAuthHarness({
      ZENDESK_CLIENT_ID: "zdg-relay-console",
      ZENDESK_CLIENT_SECRET: "relay-zendesk-secret",
    });
    const connection = {
      id: "conn_zendesk",
      workspaceId: "workspace_1",
      appSlug: "zendesk",
      displayName: "Zendesk",
      authType: "oauth2_authorization_code",
      credentialNames: [],
      selectedCapabilities: ["ticket_read"],
      status: "ready",
      metadata: {
        zendeskInstanceOrigin: "https://relay-support.zendesk.com",
        zendeskUserId: "123",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    credentials.applyEncrypted(connection, {
      accessToken: "zendesk-access",
      refreshToken: "zendesk-refresh",
      grantedScopes: [...ZENDESK_SCOPES],
    });
    jest
      .spyOn(service, "getConnectionWithSecrets")
      .mockResolvedValue(connection);
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue({ ok: true, status: 204 } as any);

    await service.disconnect(
      "workspace_1",
      "user_1",
      "zendesk",
      "conn_zendesk",
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://relay-support.zendesk.com/api/v2/oauth/tokens/current.json",
    );
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
    expect(
      (
        (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
          string,
          string
        >
      ).Authorization,
    ).toBe("Bearer zendesk-access");
    const saved = connectionRepo.save.mock.calls.at(-1)?.[0];
    expect(credentials.decrypt(saved)).toBeNull();
    expect(saved.status).toBe("needs_credentials");
    fetchMock.mockRestore();
  });

  it("registers Intercom public OAuth with three bounded conversation reads", () => {
    const manifest = new MarketplaceConnectorRegistry().get("intercom");
    expect(manifest).toBe(INTERCOM_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toMatchObject({
      type: "oauth2_authorization_code",
      oauth: {
        requiredScopes: INTERCOM_SCOPES,
        pkce: false,
        supportsRefresh: false,
      },
      credentialSchema: [],
    });
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "intercom_conversation_count",
      "intercom_conversation_list",
      "intercom_conversation_get",
    ]);
    expect(manifest?.tools.every((tool) => tool.approvalRequired)).toBe(true);
  });

  it("starts Intercom OAuth without leaking app credentials or pseudo-scopes", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      INTERCOM_CLIENT_ID: "relay-intercom-client",
      INTERCOM_CLIENT_SECRET: "relay-intercom-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "intercom",
      { selectedCapabilities: ["conversation_read"] },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://app.intercom.com/oauth",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      "relay-intercom-client",
    );
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/intercom/callback",
    );
    expect(authorizeUrl.searchParams.has("state")).toBe(true);
    expect(authorizeUrl.searchParams.has("scope")).toBe(false);
    expect(authorizeUrl.searchParams.has("response_type")).toBe(false);
    expect(started.authorizationUrl).not.toContain("relay-intercom-secret");
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-intercom-secret");
  });

  it("exchanges Intercom authorization codes as the exact documented form", async () => {
    const { service } = connectorOAuthHarness({
      INTERCOM_CLIENT_ID: "relay-intercom-client",
      INTERCOM_CLIENT_SECRET: "relay-intercom-secret",
    });
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "intercom-access",
        token_type: "Bearer",
      }),
    } as any);

    await (service as any).exchangeToken("intercom", {
      code: "intercom-code",
      client_id: "relay-intercom-client",
      client_secret: "relay-intercom-secret",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.intercom.io/auth/eagle/token");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(new URLSearchParams(String(init.body))).toEqual(
      new URLSearchParams({
        code: "intercom-code",
        client_id: "relay-intercom-client",
        client_secret: "relay-intercom-secret",
      }),
    );
    fetchMock.mockRestore();
  });

  it("revokes the exact regional Intercom app token before clearing it", async () => {
    const { service, credentials, connectionRepo } = connectorOAuthHarness({
      INTERCOM_CLIENT_ID: "relay-intercom-client",
      INTERCOM_CLIENT_SECRET: "relay-intercom-secret",
    });
    const connection = {
      id: "conn_intercom",
      workspaceId: "workspace_1",
      appSlug: "intercom",
      displayName: "Intercom",
      authType: "oauth2_authorization_code",
      credentialNames: [],
      selectedCapabilities: ["conversation_read"],
      status: "ready",
      metadata: {
        intercomApiOrigin: "https://api.eu.intercom.io",
        intercomRegion: "EU",
        intercomWorkspaceId: "workspace_123",
        intercomAdminId: "admin_123",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    credentials.applyEncrypted(connection, {
      accessToken: "intercom-access",
      grantedScopes: [...INTERCOM_SCOPES],
    });
    jest
      .spyOn(service, "getConnectionWithSecrets")
      .mockResolvedValue(connection);
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue({ ok: true, status: 204 } as any);

    await service.disconnect(
      "workspace_1",
      "user_1",
      "intercom",
      "conn_intercom",
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.eu.intercom.io/auth/uninstall",
    );
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
    expect(
      (
        (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
          string,
          string
        >
      ).Authorization,
    ).toBe("Bearer intercom-access");
    const saved = connectionRepo.save.mock.calls.at(-1)?.[0];
    expect(credentials.decrypt(saved)).toBeNull();
    expect(saved.status).toBe("needs_credentials");
    fetchMock.mockRestore();
  });

  it("revokes HubSpot refresh tokens with the current authenticated revoke contract", async () => {
    const { service, credentials, connectionRepo } = connectorOAuthHarness({
      HUBSPOT_CLIENT_ID: "relay-hubspot-client",
      HUBSPOT_CLIENT_SECRET: "relay-hubspot-secret",
    });
    const connection = {
      id: "conn_hubspot",
      workspaceId: "workspace_1",
      appSlug: "hubspot",
      displayName: "HubSpot",
      authType: "oauth2_authorization_code",
      credentialNames: [],
      selectedCapabilities: ["company_read", "deal_read"],
      status: "ready",
      metadata: { hubId: "1234567", userId: "222222" },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    credentials.applyEncrypted(connection, {
      accessToken: "hubspot-access",
      refreshToken: "hubspot-refresh",
      grantedScopes: [...HUBSPOT_SCOPES],
    });
    jest
      .spyOn(service, "getConnectionWithSecrets")
      .mockResolvedValue(connection);
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue({ ok: true } as any);

    await service.disconnect(
      "workspace_1",
      "user_1",
      "hubspot",
      "conn_hubspot",
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.hubapi.com/oauth/2026-03/token/revoke",
    );
    const revokeBody = String((fetchMock.mock.calls[0][1] as any).body);
    expect(revokeBody).toContain("client_id=relay-hubspot-client");
    expect(revokeBody).toContain("client_secret=relay-hubspot-secret");
    expect(revokeBody).toContain("token=hubspot-refresh");
    expect(revokeBody).toContain("token_type_hint=refresh_token");
    expect(revokeBody).not.toContain("hubspot-access");
    const saved = connectionRepo.save.mock.calls.at(-1)?.[0];
    expect(credentials.decrypt(saved)).toBeNull();
    expect(saved.status).toBe("needs_credentials");
    expect(saved.metadata).toEqual(
      expect.objectContaining({
        provider: "hubspot",
        tokenStatus: "disconnected",
      }),
    );
  });

  it("starts Stripe Apps OAuth without invented scopes and exchanges tokens with the developer key in Basic auth", async () => {
    const { service } = connectorOAuthHarness({
      STRIPE_APPS_CLIENT_ID: "ca_relay",
      STRIPE_APPS_DEVELOPER_SECRET_KEY: "sk_test_relay",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "stripe",
      { returnTo: "/marketplace?app=stripe" },
    );
    const authorizeUrl = new URL(started.authorizationUrl);
    expect(authorizeUrl.origin).toBe("https://marketplace.stripe.com");
    expect(authorizeUrl.pathname).toBe("/oauth/v2/authorize");
    expect(authorizeUrl.searchParams.get("client_id")).toBe("ca_relay");
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/stripe/callback",
    );
    expect(authorizeUrl.searchParams.has("scope")).toBe(false);
    expect(authorizeUrl.searchParams.has("response_type")).toBe(false);

    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "stripe-access",
        refresh_token: "stripe-refresh",
        expires_in: 3600,
        scope: "stripe_apps",
        account_id: "acct_Relay123",
        livemode: false,
      }),
    } as any);
    await service.exchangeToken("stripe", {
      grant_type: "authorization_code",
      code: "ac_Relay",
      client_id: "ca_relay",
      client_secret: "sk_test_relay",
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("sk_test_relay:").toString("base64")}`,
    );
    expect(String(init.body)).not.toContain("ca_relay");
    expect(String(init.body)).not.toContain("sk_test_relay");
    expect(
      service.resolveGrantedScopes(
        "stripe",
        "stripe_apps",
        STRIPE_APP_PERMISSIONS,
        "stripe-refresh",
      ),
    ).toEqual(STRIPE_APP_PERMISSIONS);
    expect(
      service.buildMetadata("stripe", "ca_relay", STRIPE_APP_PERMISSIONS, {
        stripeAccountId: "acct_Relay123",
        stripeLivemode: false,
        displayName: "acct_Relay123 (test)",
      }),
    ).toMatchObject({
      provider: "stripe",
      stripeAccountId: "acct_Relay123",
      stripeLivemode: false,
      rotatingRefreshTokens: true,
      rawApiEnabled: false,
    });
  });

  it("starts Shopify OAuth against one encrypted shop authority without exposing Relay app credentials", async () => {
    const { service, credentials, oauthStateRepo } = connectorOAuthHarness({
      SHOPIFY_CLIENT_ID: "shopify-client",
      SHOPIFY_CLIENT_SECRET: "shopify-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "shopify",
      {
        providerDomain: "relay-demo.myshopify.com",
        returnTo: "/marketplace?app=shopify",
      },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin).toBe("https://relay-demo.myshopify.com");
    expect(url.pathname).toBe("/admin/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("shopify-client");
    expect(url.searchParams.get("scope")).toBe(
      "write_products write_publications",
    );
    const saved = oauthStateRepo.save.mock.calls[0][0];
    expect(saved).toEqual(
      expect.objectContaining({
        appSlug: "shopify",
        authorityAuthorizeUrl:
          "https://relay-demo.myshopify.com/admin/oauth/authorize",
        authorityTokenUrl:
          "https://relay-demo.myshopify.com/admin/oauth/access_token",
        clientSecretCiphertext: null,
        providerSessionCiphertext: expect.any(String),
      }),
    );
    expect(
      credentials.decryptEncrypted({
        ciphertext: saved.providerSessionCiphertext,
        iv: saved.providerSessionIv,
        authTag: saved.providerSessionAuthTag,
        keyVersion: saved.providerSessionKeyVersion,
      }),
    ).toContain("relay-demo.myshopify.com");
  });

  it("exchanges a signed Shopify callback for expiring offline tokens and binds the returned shop", async () => {
    const { service, credentials, oauthStateRepo, connectionRepo } =
      connectorOAuthHarness({
        SHOPIFY_CLIENT_ID: "shopify-client",
        SHOPIFY_CLIENT_SECRET: "shopify-secret",
      });
    const providerSession = credentials.encrypt({
      shopDomain: "relay-demo.myshopify.com",
    });
    oauthStateRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => ({
        id: "state_shopify",
        workspaceId: "workspace_1",
        userId: "user_1",
        appSlug: "shopify",
        reauthorizeConnectionId: null,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        providerSessionCiphertext: providerSession.ciphertext,
        providerSessionIv: providerSession.iv,
        providerSessionAuthTag: providerSession.authTag,
        providerSessionKeyVersion: providerSession.keyVersion,
        clientId: "shopify-client",
        authorityMode: "relay-demo.myshopify.com",
        authorityTenantId: null,
        authorityAuthorizeUrl:
          "https://relay-demo.myshopify.com/admin/oauth/authorize",
        authorityTokenUrl:
          "https://relay-demo.myshopify.com/admin/oauth/access_token",
        redirectUri:
          "https://api.relayconsole.work/api/v1/marketplace/oauth/shopify/callback",
        scopes: ["write_products", "write_publications"],
        selectedCapabilities: [
          "product_read",
          "product_draft",
          "product_publish",
        ],
        displayName: "Relay demo shop",
        environment: "default",
        returnTo: "https://relayconsole.work/app?marketplace_app=shopify",
      })),
    });
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          refresh_token_expires_in: 7_776_000,
          token_type: "Bearer",
          scope: "write_products,write_publications",
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            shop: {
              id: "gid://shopify/Shop/1",
              name: "Relay Demo",
              myshopifyDomain: "relay-demo.myshopify.com",
              currencyCode: "GBP",
              primaryDomain: {
                host: "shop.example",
                url: "https://shop.example",
              },
            },
          },
        }),
      } as any);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const callbackParams = new URLSearchParams({
      code: "auth-code",
      shop: "relay-demo.myshopify.com",
      state: "returned-state",
      timestamp,
    });
    const callbackMessage = [...callbackParams.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const hmac = createHmac("sha256", "shopify-secret")
      .update(callbackMessage)
      .digest("hex");
    const result = await service.completeOAuth("shopify", {
      state: "returned-state",
      code: "auth-code",
      shopifyShop: "relay-demo.myshopify.com",
      shopifyTimestamp: timestamp,
      shopifyHmac: hmac,
      rawCallbackPathAndQuery: `/api/v1/marketplace/oauth/shopify/callback?${callbackParams}&hmac=${hmac}`,
    });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "https://relay-demo.myshopify.com/admin/oauth/access_token",
    );
    const form = (global.fetch as jest.Mock).mock.calls[0][1]
      .body as URLSearchParams;
    expect(form.get("expiring")).toBe("1");
    expect(form.get("client_secret")).toBe("shopify-secret");
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        appSlug: "shopify",
        authType: "oauth2_authorization_code",
        metadata: expect.objectContaining({
          shopDomain: "relay-demo.myshopify.com",
          shopifyShopId: "gid://shopify/Shop/1",
          rotatingRefreshTokens: true,
        }),
      }),
    );
    expect(result.returnTo).toContain("marketplace_connection_id=");
  });

  it("rotates Shopify offline tokens through the connection-bound shop authority", async () => {
    const { service, credentials, connectionRepo } = connectorOAuthHarness({
      SHOPIFY_CLIENT_ID: "shopify-client",
      SHOPIFY_CLIENT_SECRET: "shopify-secret",
    });
    const connection = {
      id: "conn_shopify",
      workspaceId: "workspace_1",
      appSlug: "shopify",
      metadata: {
        clientId: "shopify-client",
        shopDomain: "relay-demo.myshopify.com",
        grantedScopes: [...SHOPIFY_SCOPES],
      },
      status: "ready",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    credentials.applyEncrypted(connection, {
      accessToken: "expired-access",
      refreshToken: "old-refresh",
      clientId: "shopify-client",
      shopDomain: "relay-demo.myshopify.com",
      expiresAt: "2026-01-01T00:00:00.000Z",
      grantedScopes: [...SHOPIFY_SCOPES],
    });
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access",
        refresh_token: "rotated-refresh",
        expires_in: 3600,
        refresh_token_expires_in: 7_776_000,
        scope: "write_products,write_publications",
      }),
    } as any);

    const refreshed = await service.refreshIfNeeded(connection);

    expect(refreshed).toEqual(
      expect.objectContaining({ accessToken: "new-access", refreshed: true }),
    );
    expect(refreshed.credentials.refreshToken).toBe("rotated-refresh");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://relay-demo.myshopify.com/admin/oauth/access_token",
    );
    const refreshBody = String((fetchMock.mock.calls[0][1] as any).body);
    expect(refreshBody).toContain("refresh_token=old-refresh");
    expect(refreshBody).toContain("client_secret=shopify-secret");
    expect(JSON.stringify(connection.metadata)).not.toContain("shopify-secret");
    expect(connectionRepo.save).toHaveBeenCalledWith(connection);
  });

  it("registers Lucidspark as Relay-owned Lucid OAuth with product-bound tools", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("lucidspark");
    expect(manifest).toBe(LUCIDSPARK_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://lucid.app/oauth2/authorize",
        tokenUrl: "https://api.lucid.co/oauth2/token",
        refreshUrl: "https://api.lucid.co/oauth2/token",
        revocationUrl: "https://api.lucid.co/v1/oauth2/token/revoke",
        requiredScopes: [...LUCIDSPARK_SCOPES],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("lucidspark", "lucidspark_read")?.name).toBe(
      "lucidspark.read",
    );
    expect(
      registry.getTool("lucidspark", "lucidspark_write")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      LUCID_CLIENT_ID: "relay-lucid-client",
      LUCID_CLIENT_SECRET: "relay-lucid-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "lucidspark",
      { returnTo: "https://relayconsole.work/app?marketplace_app=lucidspark" },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://lucid.app/oauth2/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/lucidspark/callback",
    );
    expect(url.searchParams.get("scope")).toBe(LUCIDSPARK_SCOPES.join(" "));
    expect(url.searchParams.has("code_challenge")).toBe(false);
  });

  it("registers Lucidchart as Relay-owned Lucid OAuth with product-bound tools", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("lucidchart");
    expect(manifest).toBe(LUCIDCHART_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://lucid.app/oauth2/authorize",
        tokenUrl: "https://api.lucid.co/oauth2/token",
        refreshUrl: "https://api.lucid.co/oauth2/token",
        revocationUrl: "https://api.lucid.co/v1/oauth2/token/revoke",
        requiredScopes: [...LUCIDCHART_SCOPES],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(registry.getTool("lucidchart", "lucidchart_read")?.name).toBe(
      "lucidchart.read",
    );
    expect(
      registry.getTool("lucidchart", "lucidchart_write")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      LUCID_CLIENT_ID: "relay-lucid-client",
      LUCID_CLIENT_SECRET: "relay-lucid-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "lucidchart",
      { returnTo: "https://relayconsole.work/app?marketplace_app=lucidchart" },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://lucid.app/oauth2/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/lucidchart/callback",
    );
    expect(url.searchParams.get("scope")).toBe(LUCIDCHART_SCOPES.join(" "));
    expect(url.searchParams.has("code_challenge")).toBe(false);
  });

  it("gives every converged provider a product-first complete description", () => {
    const convergedProviderSlugs = [
      "mailgun",
      "sendgrid",
      "postmark",
      "resend",
      "sparkpost",
      "brevo",
      "sinch-mailjet",
      "evernote",
      "nimbus-note",
      "mem",
      "reflect",
      "readwise",
      "raindrop-io",
      "instapaper",
      "feedly",
      "inoreader",
      "readme",
      "guru",
      "slite",
      "slab",
      "confluence",
      "quip",
      "nuclino",
      "document360",
      "archbee",
      "tettra",
      "knowledgeowl",
      "scribe",
      "vidyard",
      "vimeo",
      "wistia",
      "frame-io",
      "descript",
      "rev",
      "otter-ai",
      "fireflies-ai",
      "fathom",
      "tl-dv",
      "grain",
      "mural",
      "figjam",
      "lucidspark",
      "lucidchart",
      "whimsical",
      "cognito-forms",
      "draw-io",
      "mindmeister",
      "xmind",
      "padlet",
      "dropbox-paper",
      "dropbox",
      "box",
      "roadmunk",
      "shortcut",
      "hive",
      "nifty",
      "paymo",
      "proofhub",
      "meistertask",
      "nozbe",
      "any-do",
      "remember-the-milk",
      "habitica",
      "amazing-marvin",
      "akiflow",
    ];

    for (const slug of convergedProviderSlugs) {
      const description =
        MARKETPLACE_CATALOG.find((entry) => entry.slug === slug)?.description ??
        "";
      expect(description).not.toMatch(/^(Connect|Enter|Provide|Authorize)\b/i);
      expect(
        description.match(/[.!?](?:\s|$)/g)?.length ?? 0,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("registers MindMeister as Relay-owned OAuth with exact read and write wrappers", async () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("mindmeister");
    expect(manifest).toBe(MINDMEISTER_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://www.mindmeister.com/oauth2/authorize",
        tokenUrl: "https://www.mindmeister.com/oauth2/token",
        revocationUrl: "https://www.mindmeister.com/oauth2/revoke",
        requiredScopes: [...MINDMEISTER_SCOPES],
        pkce: false,
        supportsRefresh: false,
      }),
    );
    expect(registry.getTool("mindmeister", "mindmeister_read")?.name).toBe(
      "mindmeister.read",
    );
    expect(
      registry.getTool("mindmeister", "mindmeister_write")?.approvalRequired,
    ).toBe(true);
    expect(
      manifest?.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
    const { service } = connectorOAuthHarness({
      MINDMEISTER_CLIENT_ID: "relay-mindmeister-client",
      MINDMEISTER_CLIENT_SECRET: "relay-mindmeister-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "mindmeister",
      { returnTo: "https://relayconsole.work/app?marketplace_app=mindmeister" },
    );
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://www.mindmeister.com/oauth2/authorize",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/mindmeister/callback",
    );
    expect(url.searchParams.get("scope")).toBe(MINDMEISTER_SCOPES.join(" "));
    expect(url.searchParams.has("code_challenge")).toBe(false);
  });

  it("registers Draw.io as an exact no-credential hosted MCP connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("draw-io");
    expect(manifest).toBe(DRAW_IO_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual({ type: "mcp", credentialSchema: [] });
    expect(registry.getTool("draw-io", "draw_io_use")?.name).toBe(
      "draw-io.use",
    );
    expect(manifest?.tools[0].inputSchema).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          toolName: {
            type: "string",
            enum: ["create_diagram", "search_shapes"],
          },
        }),
      }),
    );
  });

  it("registers Nextdoor with only the bounded Publish API surface", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("nextdoor");

    expect(manifest).toBe(NEXTDOOR_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth?.requiredScopes).toEqual(NEXTDOOR_SCOPES);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://www.nextdoor.com/v3/authorize/",
        tokenUrl: "https://auth.nextdoor.com/v2/token",
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_nextdoor_get_profile",
      "relay_nextdoor_list_own_posts",
      "relay_nextdoor_draft_text_post",
      "relay_nextdoor_publish_text_post",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "nextdoor_safe",
      "dangerously_skip_permissions",
      "nextdoor_read_only",
      "nextdoor_no_access",
    ]);
    expect(
      manifest?.approvalProfiles.every((profile) =>
        profile.blockedActions.some(
          (entry) => entry.id === "nextdoor_cross_product",
        ),
      ),
    ).toBe(true);
    expect(
      registry.getTool("nextdoor", "relay_nextdoor_publish_text_post"),
    ).toEqual(
      expect.objectContaining({ action: "write", approvalRequired: true }),
    );
    const catalog = MARKETPLACE_CATALOG.find(
      (entry) => entry.slug === "nextdoor",
    );
    expect(catalog?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "nextdoor_safe",
      "dangerously_skip_permissions",
    ]);
    expect(catalog?.approvalProfile).toBe("nextdoor_safe");
    expect(catalog?.riskLevel).toBe("high");
    expect(
      catalog?.approvalProfiles
        .find((profile) => profile.id === "nextdoor_safe")
        ?.approvalRequiredActions.map((entry) => entry.id),
    ).toEqual(["nextdoor_text_post_publish"]);
    expect(
      catalog?.approvalProfiles
        .find((profile) => profile.id === "dangerously_skip_permissions")
        ?.allowedActions.map((entry) => entry.id),
    ).toContain("nextdoor_text_post_publish");
  });

  it("registers Meetup with exactly two fixed read-only GraphQL wrappers", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("meetup");
    expect(manifest).toBe(MEETUP_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://secure.meetup.com/oauth2/authorize",
        tokenUrl: "https://secure.meetup.com/oauth2/access",
        userInfoUrl: "https://api.meetup.com/gql-ext",
        requiredScopes: [],
        optionalScopes: [],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_meetup_get_self",
      "relay_meetup_get_event",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "meetup_safe",
      "dangerously_skip_permissions",
      "meetup_read_only",
      "meetup_no_access",
    ]);
    expect(
      manifest?.approvalProfiles.every((profile) =>
        profile.blockedActions.some(
          (entry) => entry.id === "meetup_raw_graphql",
        ),
      ),
    ).toBe(true);
    const catalog = MARKETPLACE_CATALOG.find(
      (entry) => entry.slug === "meetup",
    );
    expect(catalog?.approvalProfile).toBe("meetup_safe");
    expect(catalog?.runtimeSupport).toEqual([
      expect.objectContaining({
        format: "openclaw",
        installSupport: "installable",
      }),
      expect.objectContaining({
        format: "hermes",
        installSupport: "installable",
      }),
    ]);
  });

  it("starts Meetup OAuth from Railway-held credentials without invented scopes or leaked secrets", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      MEETUP_CLIENT_ID: "meetup-client-id",
      MEETUP_CLIENT_SECRET: "meetup-client-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "meetup", {
      returnTo: "/marketplace?app=meetup",
    });
    const url = new URL(result.authorizationUrl);
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://secure.meetup.com/oauth2/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("meetup-client-id");
    expect(url.searchParams.has("scope")).toBe(false);
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(state.stateHash).not.toBe(url.searchParams.get("state"));
    expect(state.clientSecretCiphertext).toEqual(expect.any(String));
    expect(JSON.stringify(state)).not.toContain("meetup-client-secret");
  });

  it("registers Eventbrite with exactly four read-only REST wrappers", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("eventbrite");
    expect(manifest).toBe(EVENTBRITE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://www.eventbrite.com/oauth/authorize",
        tokenUrl: "https://www.eventbrite.com/oauth/token",
        userInfoUrl: "https://www.eventbriteapi.com/v3/users/me/",
        requiredScopes: [],
        optionalScopes: [],
        pkce: false,
        supportsRefresh: false,
      }),
    );
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_eventbrite_get_user",
      "relay_eventbrite_list_organizations",
      "relay_eventbrite_list_organization_events",
      "relay_eventbrite_get_event",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "eventbrite_safe",
      "dangerously_skip_permissions",
      "eventbrite_read_only",
      "eventbrite_no_access",
    ]);
    const catalog = MARKETPLACE_CATALOG.find(
      (entry) => entry.slug === "eventbrite",
    );
    expect(catalog?.approvalProfile).toBe("eventbrite_safe");
    expect(catalog?.runtimeSupport).toEqual([
      expect.objectContaining({
        format: "openclaw",
        installSupport: "installable",
      }),
      expect.objectContaining({
        format: "hermes",
        installSupport: "installable",
      }),
    ]);
  });

  it("starts Eventbrite OAuth from Railway-held credentials without invented scopes, PKCE, or leaked secrets", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      EVENTBRITE_API_KEY: "eventbrite-app-key",
      EVENTBRITE_CLIENT_SECRET: "eventbrite-client-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "eventbrite",
      {
        returnTo: "/marketplace?app=eventbrite",
      },
    );
    const url = new URL(result.authorizationUrl);
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://www.eventbrite.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("eventbrite-app-key");
    expect(url.searchParams.has("scope")).toBe(false);
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(state.stateHash).not.toBe(url.searchParams.get("state"));
    expect(state.clientSecretCiphertext).toEqual(expect.any(String));
    expect(JSON.stringify(state)).not.toContain("eventbrite-client-secret");
  });

  it("registers Luma as one encrypted Calendar API-key connection with four fixed reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("luma");
    expect(manifest).toBe(LUMA_CONNECTOR_MANIFEST);
    expect(manifest?.auth).toEqual(
      expect.objectContaining({
        type: "api_key",
        credentialSchema: [
          expect.objectContaining({
            name: "LUMA_API_KEY",
            secret: true,
            storedIn: "encrypted_secret",
          }),
        ],
      }),
    );
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_luma_get_user",
      "relay_luma_get_calendar",
      "relay_luma_list_calendar_events",
      "relay_luma_get_event",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "luma_safe",
      "dangerously_skip_permissions",
    ]);
    const catalog = MARKETPLACE_CATALOG.find((entry) => entry.slug === "luma");
    expect(catalog).toEqual(
      expect.objectContaining({
        approvalProfile: "luma_safe",
        riskLevel: "high",
        providerWebsiteUrl: "https://luma.com/",
        description: expect.stringContaining("event-hosting and discovery"),
      }),
    );
    expect(catalog?.runtimeSupport).toEqual([
      expect.objectContaining({
        format: "openclaw",
        installSupport: "installable",
      }),
      expect.objectContaining({
        format: "hermes",
        installSupport: "installable",
      }),
    ]);
  });

  it("registers the Hopin slug as current RingCentral Events with one Organization-bound token and four reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("hopin");
    expect(manifest).toBe(HOPIN_CONNECTOR_MANIFEST);
    expect(manifest?.name).toBe("RingCentral Events");
    expect(manifest?.auth).toEqual(
      expect.objectContaining({
        type: "api_key",
        credentialSchema: [
          expect.objectContaining({
            name: "RINGCENTRAL_EVENTS_ACCESS_TOKEN",
            secret: true,
            storedIn: "encrypted_secret",
          }),
          expect.objectContaining({
            name: "RINGCENTRAL_EVENTS_ORGANIZATION_ID",
            required: true,
          }),
        ],
      }),
    );
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_hopin_get_organization",
      "relay_hopin_list_organization_events",
      "relay_hopin_get_event",
      "relay_hopin_list_event_schedule_items",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "hopin_safe",
      "dangerously_skip_permissions",
    ]);
    const catalog = MARKETPLACE_CATALOG.find((entry) => entry.slug === "hopin");
    expect(catalog).toEqual(
      expect.objectContaining({
        name: "RingCentral Events",
        approvalProfile: "hopin_safe",
        riskLevel: "high",
        providerWebsiteUrl: "https://www.ringcentral.com/rc-events",
        description: expect.stringContaining("formerly Hopin Events"),
      }),
    );
    expect(catalog?.runtimeSupport).toEqual([
      expect.objectContaining({
        format: "openclaw",
        installSupport: "installable",
      }),
      expect.objectContaining({
        format: "hermes",
        installSupport: "installable",
      }),
    ]);
  });

  it("registers Twist with exactly five bounded read-only wrappers and exact scopes", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("twist");
    expect(manifest).toBe(TWIST_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://twist.com/oauth/authorize",
        tokenUrl: "https://twist.com/oauth/access_token",
        userInfoUrl: "https://api.twist.com/api/v3/users/get_session_user",
        requiredScopes: TWIST_REQUIRED_SCOPES,
        optionalScopes: [],
        pkce: false,
        supportsRefresh: false,
      }),
    );
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_twist_get_user",
      "relay_twist_list_workspaces",
      "relay_twist_list_channels",
      "relay_twist_list_inbox_threads",
      "relay_twist_get_thread_with_comments",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "twist_read_only",
      "twist_no_access",
    ]);
    expect(
      manifest?.approvalProfiles.every((profile) =>
        profile.blockedActions.some((entry) => entry.id === "twist_broad_raw"),
      ),
    ).toBe(true);
  });

  it("starts Twist OAuth with comma-delimited exact scopes and no leaked Railway secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      TWIST_CLIENT_ID: "twist-client-id",
      TWIST_CLIENT_SECRET: "twist-client-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "twist", {
      returnTo: "/marketplace?app=twist",
    });
    const url = new URL(result.authorizationUrl);
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe("https://twist.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("twist-client-id");
    expect(url.searchParams.get("scope")).toBe(TWIST_REQUIRED_SCOPES.join(","));
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/twist/callback",
    );
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(state.stateHash).not.toBe(url.searchParams.get("state"));
    expect(state.clientSecretCiphertext).toEqual(expect.any(String));
    expect(JSON.stringify(state)).not.toContain("twist-client-secret");
  });

  it("registers Zoho Mail OAuth health and exactly four bounded read tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("zoho-mail");
    expect(manifest).toBe(ZOHO_MAIL_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
        tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
        requiredScopes: [...ZOHO_MAIL_REQUIRED_SCOPES],
        optionalScopes: [],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_zoho_mail_list_accounts",
      "relay_zoho_mail_list_folders",
      "relay_zoho_mail_list_messages_filtered",
      "relay_zoho_mail_get_message",
    ]);
    expect(
      manifest?.tools.every(
        (tool) => tool.action === "read" && tool.approvalRequired === false,
      ),
    ).toBe(true);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "zoho_mail_read_only",
      "zoho_mail_no_access",
    ]);
    expect(
      manifest?.approvalProfiles[0].allowedActions.map((entry) => entry.id),
    ).toEqual([
      "zoho_mail_accounts_list",
      "zoho_mail_folders_list",
      "zoho_mail_messages_list_filtered",
      "zoho_mail_message_get",
    ]);
    expect(
      manifest?.approvalProfiles.every((profile) =>
        profile.blockedActions.some(
          (entry) => entry.id === "zoho_mail_broad_raw",
        ),
      ),
    ).toBe(true);
    expect(manifest?.healthChecks).toEqual([
      expect.objectContaining({
        id: "bound_mail_account",
        requiredScopes: [...ZOHO_MAIL_REQUIRED_SCOPES],
      }),
    ]);
  });

  it("starts regional Zoho Mail offline OAuth with encrypted state and exact comma scopes", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      ZOHO_MAIL_CLIENT_ID: "zoho-mail-client-id",
      ZOHO_MAIL_CLIENT_SECRET: "zoho-mail-client-secret",
      ZOHO_MAIL_ACCOUNTS_ORIGIN: "https://accounts.zoho.eu",
    });
    const before = Date.now();
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "zoho-mail",
      { returnTo: "/marketplace?app=zoho-mail" },
    );
    const url = new URL(result.authorizationUrl);
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://accounts.zoho.eu/oauth/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("zoho-mail-client-id");
    expect(url.searchParams.get("scope")).toBe(
      ZOHO_MAIL_REQUIRED_SCOPES.join(","),
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/zoho-mail/callback",
    );
    expect(state.authorityAuthorizeUrl).toBe(
      "https://accounts.zoho.eu/oauth/v2/auth",
    );
    expect(state.authorityTokenUrl).toBe(
      "https://accounts.zoho.eu/oauth/v2/token",
    );
    expect(state.stateHash).not.toBe(url.searchParams.get("state"));
    expect(state.clientSecretCiphertext).toEqual(expect.any(String));
    expect(JSON.stringify(state)).not.toContain("zoho-mail-client-secret");
    expect(state.expiresAt.getTime() - before).toBeLessThanOrEqual(120_500);
    expect(state.expiresAt.getTime() - before).toBeGreaterThan(119_000);
  });

  it("rejects arbitrary Zoho OAuth authorities before persisting state", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      ZOHO_MAIL_CLIENT_ID: "zoho-mail-client-id",
      ZOHO_MAIL_CLIENT_SECRET: "zoho-mail-client-secret",
      ZOHO_MAIL_ACCOUNTS_ORIGIN: "https://attacker.example",
    });
    await expect(
      service.startOAuth("workspace_1", "user_1", "zoho-mail", {}),
    ).rejects.toThrow(
      "ZOHO_MAIL_ACCOUNTS_ORIGIN must be an allowlisted HTTPS Zoho Accounts origin",
    );
    expect(oauthStateRepo.save).not.toHaveBeenCalled();
  });

  it("binds Zoho Mail health to one account in the allowlisted Mail data center", async () => {
    const { service } = connectorOAuthHarness();
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              accountId: "123456789",
              primaryEmailAddress: "relay@example.eu",
              displayName: "Relay Mail",
            },
          ],
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              accountId: "987654321",
              primaryEmailAddress: "other@example.eu",
              displayName: "Other Mail",
            },
          ],
        }),
      } as any);
    const providerSession = {
      zohoAccountsOrigin: "https://accounts.zoho.eu",
      zohoMailOrigin: "https://mail.zoho.eu",
      zohoRegion: "eu",
    };
    const profile = await service.fetchProviderProfile(
      "zoho-mail",
      "access-token",
      providerSession,
    );
    const metadata = service.buildMetadata(
      "zoho-mail",
      "client-id",
      [...ZOHO_MAIL_REQUIRED_SCOPES],
      profile,
      providerSession,
    );
    expect(metadata).toEqual(
      expect.objectContaining({
        zohoAccountId: "123456789",
        email: "relay@example.eu",
        zohoRegion: "eu",
        zohoAccountsOrigin: "https://accounts.zoho.eu",
        zohoMailOrigin: "https://mail.zoho.eu",
        accountVerified: true,
        regionalAuthorityBound: true,
        readOnlyScopes: true,
        writesEnabled: false,
        attachmentDownloadsEnabled: false,
        automaticPagination: false,
        rawToolsEnabled: false,
      }),
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://mail.zoho.eu/api/accounts",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Zoho-oauthtoken access-token",
        }),
      }),
    );
    await expect(
      service.validateZohoMailAccount(
        {
          appSlug: "zoho-mail",
          metadata: {
            clientId: "client-id",
            grantedScopes: [...ZOHO_MAIL_REQUIRED_SCOPES],
            zohoAccountId: "123456789",
            ...providerSession,
          },
        },
        "access-token",
      ),
    ).rejects.toThrow("connected account binding changed");
  });

  it("refreshes Zoho Mail tokens through the bound Accounts authority without exposing secrets", async () => {
    const { service, credentials, connectionRepo } = connectorOAuthHarness();
    const connection = {
      id: "conn_zoho",
      workspaceId: "workspace_1",
      appSlug: "zoho-mail",
      metadata: {
        clientId: "zoho-client",
        grantedScopes: [...ZOHO_MAIL_REQUIRED_SCOPES],
        zohoAccountsOrigin: "https://accounts.zoho.jp",
        zohoMailOrigin: "https://mail.zoho.jp",
        zohoRegion: "jp",
      },
      status: "ready",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    credentials.applyEncrypted(connection, {
      accessToken: "expired-access",
      refreshToken: "zoho-refresh",
      clientId: "zoho-client",
      clientSecret: "zoho-secret",
      expiresAt: "2026-01-01T00:00:00.000Z",
      grantedScopes: [...ZOHO_MAIL_REQUIRED_SCOPES],
    });
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-access", expires_in: 3600 }),
    } as any);
    const refreshed = await service.refreshIfNeeded(connection);
    expect(refreshed).toEqual(
      expect.objectContaining({ accessToken: "new-access", refreshed: true }),
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://accounts.zoho.jp/oauth/v2/token",
    );
    const refreshBody = String((fetchMock.mock.calls[0][1] as any).body);
    expect(refreshBody).toContain("refresh_token=zoho-refresh");
    expect(refreshBody).toContain("client_secret=zoho-secret");
    expect(JSON.stringify(connection.metadata)).not.toContain("zoho-secret");
    expect(credentials.decrypt(connection)).toEqual(
      expect.objectContaining({
        accessToken: "new-access",
        refreshToken: "zoho-refresh",
        clientSecret: "zoho-secret",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(connection);
  });

  it("keeps Zoho Mail OAuth material encrypted and reports unreadable bundles distinctly", () => {
    const { service, credentials } = connectorOAuthHarness();
    const connection = {
      id: "conn_zoho",
      workspaceId: "workspace_1",
      appSlug: "zoho-mail",
      displayName: "Zoho Mail",
      environment: "default",
      authType: "oauth2_authorization_code",
      credentialNames: [
        "ZOHO-MAIL_OAUTH_TOKEN_BUNDLE",
        "ZOHO-MAIL_CLIENT_SECRET",
      ],
      selectedCapabilities: [],
      status: "ready",
      lastValidatedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: {
        provider: "zoho-mail",
        tokenStatus: "valid",
        zohoAccountId: "123456789",
        email: "relay@example.com",
      },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date("2026-07-13T00:00:00.000Z"),
      updatedAt: new Date("2026-07-13T00:00:00.000Z"),
    } as any;
    credentials.applyEncrypted(connection, {
      clientId: "zoho-client",
      clientSecret: "zoho-secret",
      accessToken: "zoho-access",
      refreshToken: "zoho-refresh",
    });
    expect(credentials.decrypt(connection)).toEqual(
      expect.objectContaining({
        clientSecret: "zoho-secret",
        accessToken: "zoho-access",
        refreshToken: "zoho-refresh",
      }),
    );
    const view = service.toConnectionView(connection);
    expect(JSON.stringify(view)).not.toContain("zoho-secret");
    expect(JSON.stringify(view)).not.toContain("zoho-access");
    expect(JSON.stringify(view)).not.toContain("zoho-refresh");
    connection.secretAuthTag = `${
      connection.secretAuthTag.startsWith("A") ? "B" : "A"
    }${connection.secretAuthTag.slice(1)}`;
    expect(() => credentials.decrypt(connection)).toThrow(
      "credential_decrypt_failed",
    );
  });

  it("revokes Zoho Mail upstream and retains only encrypted reauthorization material", async () => {
    const { service, credentials, connectionRepo } = connectorOAuthHarness();
    const connection = {
      id: "conn_zoho",
      workspaceId: "workspace_1",
      appSlug: "zoho-mail",
      displayName: "Zoho Mail",
      authType: "oauth2_authorization_code",
      credentialNames: [],
      selectedCapabilities: ["account_read"],
      status: "ready",
      metadata: {
        zohoAccountsOrigin: "https://accounts.zohocloud.ca",
        zohoMailOrigin: "https://mail.zohocloud.ca",
        zohoRegion: "ca",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    credentials.applyEncrypted(connection, {
      accessToken: "zoho-access",
      refreshToken: "zoho-refresh",
      clientId: "zoho-client",
      clientSecret: "zoho-secret",
    });
    jest
      .spyOn(service, "getConnectionWithSecrets")
      .mockResolvedValue(connection);
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue({ ok: true } as any);
    await service.disconnect("workspace_1", "user_1", "zoho-mail", "conn_zoho");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://accounts.zohocloud.ca/oauth/v2/token/revoke?token=zoho-refresh",
    );
    const saved = connectionRepo.save.mock.calls.at(-1)?.[0];
    expect(credentials.decrypt(saved)).toEqual({
      clientId: "zoho-client",
      clientSecret: "zoho-secret",
    });
    expect(saved.status).toBe("needs_credentials");
    expect(saved.metadata).toEqual(
      expect.objectContaining({
        provider: "zoho-mail",
        tokenStatus: "disconnected",
      }),
    );
  });

  it("registers Webex with exactly three read-only Person and Meeting wrappers", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("webex");
    expect(manifest).toBe(WEBEX_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://webexapis.com/v1/authorize",
        tokenUrl: "https://webexapis.com/v1/access_token",
        userInfoUrl: "https://webexapis.com/v1/people/me",
        requiredScopes: WEBEX_SCOPES,
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_webex_get_person",
      "relay_webex_list_meetings",
      "relay_webex_get_meeting",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "webex_safe",
      "dangerously_skip_permissions",
    ]);
    const catalog = MARKETPLACE_CATALOG.find((entry) => entry.slug === "webex");
    expect(catalog).toEqual(
      expect.objectContaining({
        name: "Webex",
        approvalProfile: "webex_safe",
        riskLevel: "high",
        providerWebsiteUrl: "https://www.webex.com/",
        description: expect.stringContaining(
          "Cisco's cloud collaboration suite",
        ),
      }),
    );
    expect(catalog?.runtimeSupport).toEqual([
      expect.objectContaining({
        format: "openclaw",
        installSupport: "installable",
      }),
      expect.objectContaining({
        format: "hermes",
        installSupport: "installable",
      }),
    ]);
  });

  it("starts Webex OAuth with PKCE, exact scopes and no leaked Railway secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      WEBEX_CLIENT_ID: "webex-client-id",
      WEBEX_CLIENT_SECRET: "webex-client-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "webex", {
      returnTo: "/marketplace?app=webex",
    });
    const url = new URL(result.authorizationUrl);
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://webexapis.com/v1/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("webex-client-id");
    expect(url.searchParams.get("scope")).toBe(WEBEX_SCOPES.join(" "));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(state.stateHash).not.toBe(url.searchParams.get("state"));
    expect(state.clientSecretCiphertext).toEqual(expect.any(String));
    expect(JSON.stringify(state)).not.toContain("webex-client-secret");
  });

  it("bounds Webex Meetings to one page and strips identity and join fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "meeting_A1",
              title: "Relay Review",
              meetingNumber: "123456789",
              webLink: "https://example.webex.com/meet/private",
              hostEmail: "host@example.com",
              meetingType: "scheduledMeeting",
              state: "active",
              timezone: "Europe/London",
              start: "2026-08-01T09:00:00Z",
              end: "2026-08-01T10:00:00Z",
              recurrence: "FREQ=WEEKLY",
              enabledAutoRecordMeeting: false,
              invitees: [{ email: "invitee@example.com" }],
            },
          ],
        }),
        {
          headers: {
            "content-type": "application/json",
            link: '<https://webexapis.com/v1/meetings?max=1&cursor=private>; rel="next"',
          },
        },
      ),
    );
    const result = await new WebexApiAdapter().listMeetings(
      "synthetic-webex-token",
      1,
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://webexapis.com/v1/meetings?max=1",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer synthetic-webex-token",
          "User-Agent": "RelayConsole-Webex/1.0",
        }),
      }),
    );
    expect(result.truncated).toBe(true);
    expect(result.meetings).toEqual([
      expect.objectContaining({
        meetingId: "meeting_A1",
        title: "Relay Review",
        start: "2026-08-01T09:00:00Z",
        end: "2026-08-01T10:00:00Z",
      }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /meetingNumber|webLink|hostEmail|invitee@example\.com/,
    );
  });

  it("preflights bounded Webex Meeting membership before detail reads", async () => {
    const meeting = {
      id: "meeting_A1",
      title: "Relay Review",
      meetingType: "meeting",
      state: "inProgress",
      timezone: "Europe/London",
      start: "2026-08-01T09:00:00Z",
      end: "2026-08-01T10:00:00Z",
      meetingNumber: "private",
      webLink: "https://example.webex.com/private",
    };
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [meeting] }), {
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(meeting), {
          headers: { "content-type": "application/json" },
        }),
      );
    const result = await new WebexApiAdapter().getMeeting(
      "synthetic-webex-token",
      "meeting_A1",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://webexapis.com/v1/meetings?max=10",
    );
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://webexapis.com/v1/meetings/meeting_A1",
    );
    expect(result.meetingId).toBe("meeting_A1");
    expect(JSON.stringify(result)).not.toMatch(/meetingNumber|webLink/);
  });

  it("denies out-of-page, oversized, and rate-limited Webex reads safely", async () => {
    const adapter = new WebexApiAdapter();
    jest.spyOn(global, "fetch" as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      adapter.getMeeting("synthetic-webex-token", "meeting_other"),
    ).rejects.toMatchObject<Partial<WebexApiError>>({
      code: "provider_validation_error",
      statusCode: 403,
    });

    jest.spyOn(global, "fetch" as any).mockResolvedValueOnce(
      new Response("{}", {
        headers: { "content-length": String(512 * 1024 + 1) },
      }),
    );
    await expect(
      adapter.listMeetings("synthetic-webex-token", 1),
    ).rejects.toMatchObject<Partial<WebexApiError>>({
      code: "provider_validation_error",
    });

    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await expect(
      adapter.listMeetings("synthetic-webex-token", 1),
    ).rejects.toMatchObject<Partial<WebexApiError>>({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });

  it("registers GoTo Meeting with exactly three organizer-bound read wrappers", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("goto-meeting");
    expect(manifest).toBe(GOTO_MEETING_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl:
          "https://authentication.logmeininc.com/oauth/authorize",
        tokenUrl: "https://authentication.logmeininc.com/oauth/token",
        userInfoUrl: "https://api.getgo.com/identity/v1/Users/me",
        requiredScopes: [],
        optionalScopes: [],
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_goto_meeting_get_identity",
      "relay_goto_meeting_list_upcoming_meetings",
      "relay_goto_meeting_get_meeting",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "goto_meeting_safe",
      "dangerously_skip_permissions",
    ]);
  });

  it("starts GoTo Meeting OAuth without invented scopes, PKCE or leaked secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      GOTO_MEETING_CLIENT_ID: "goto-client-id",
      GOTO_MEETING_CLIENT_SECRET: "goto-client-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "goto-meeting",
      {
        returnTo: "/marketplace?app=goto-meeting",
      },
    );
    const url = new URL(result.authorizationUrl);
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://authentication.logmeininc.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("goto-client-id");
    expect(url.searchParams.has("scope")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(state.stateHash).not.toBe(url.searchParams.get("state"));
    expect(state.clientSecretCiphertext).toEqual(expect.any(String));
    expect(JSON.stringify(state)).not.toContain("goto-client-secret");
  });

  it("bounds GoTo Meeting organizer reads and drops identities and join data", async () => {
    const meetings = [
      {
        meetingId: "123456789",
        subject: "Relay Review",
        startTime: "2026-08-01T09:00:00Z",
        endTime: "2026-08-01T10:00:00Z",
        meetingType: "scheduled",
        status: "ACTIVE",
        organizerKey: "8439885694023999999",
        email: "organizer@example.com",
        joinURL: "https://global.gotomeeting.com/join/123456789",
        conferenceCallInfo: "Private dial-in and access code",
        passwordRequired: "true",
      },
      {
        meetingId: "987654321",
        subject: "Later Meeting",
        startTime: "2026-08-02T09:00:00Z",
        endTime: "2026-08-02T10:00:00Z",
      },
    ];
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValueOnce(
      new Response(JSON.stringify(meetings), {
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await new GoToMeetingApiAdapter().listUpcomingMeetings(
      "synthetic-goto-token",
      "8439885694023999999",
      1,
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.getgo.com/G2M/rest/organizers/8439885694023999999/upcomingMeetings",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer synthetic-goto-token",
          "User-Agent": "RelayConsole-GoToMeeting/1.0",
        }),
      }),
    );
    expect(result.truncated).toBe(true);
    expect(result.meetings).toEqual([
      expect.objectContaining({
        meetingId: "123456789",
        subject: "Relay Review",
        startTime: "2026-08-01T09:00:00Z",
        endTime: "2026-08-01T10:00:00Z",
      }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /organizerKey|organizer@example\.com|joinURL|conferenceCallInfo|passwordRequired/,
    );
  });

  it("preflights connected-organizer GoTo Meeting membership before detail reads", async () => {
    const meeting = {
      meetingId: "123456789",
      subject: "Relay Review",
      startTime: "2026-08-01T09:00:00Z",
      endTime: "2026-08-01T10:00:00Z",
      duration: 60,
      meetingType: "scheduled",
      status: "ACTIVE",
      joinURL: "https://global.gotomeeting.com/join/123456789",
      coorganizerKeys: ["private"],
    };
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([meeting]), {
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([meeting]), {
          headers: { "content-type": "application/json" },
        }),
      );
    const result = await new GoToMeetingApiAdapter().getMeeting(
      "synthetic-goto-token",
      "8439885694023999999",
      "123456789",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.getgo.com/G2M/rest/organizers/8439885694023999999/upcomingMeetings",
    );
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://api.getgo.com/G2M/rest/meetings/123456789",
    );
    expect(result.meetingId).toBe("123456789");
    expect(JSON.stringify(result)).not.toMatch(/joinURL|coorganizerKeys/);
  });

  it("denies unbounded, oversized, and rate-limited GoTo Meeting reads safely", async () => {
    const adapter = new GoToMeetingApiAdapter();
    jest.spyOn(global, "fetch" as any).mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      adapter.getMeeting(
        "synthetic-goto-token",
        "8439885694023999999",
        "999999999",
      ),
    ).rejects.toMatchObject<Partial<GoToMeetingApiError>>({
      code: "provider_validation_error",
      statusCode: 403,
    });

    jest.spyOn(global, "fetch" as any).mockResolvedValueOnce(
      new Response("{}", {
        headers: { "content-length": String(512 * 1024 + 1) },
      }),
    );
    await expect(
      adapter.listUpcomingMeetings(
        "synthetic-goto-token",
        "8439885694023999999",
        1,
      ),
    ).rejects.toMatchObject<Partial<GoToMeetingApiError>>({
      code: "provider_validation_error",
    });

    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await expect(
      adapter.listUpcomingMeetings(
        "synthetic-goto-token",
        "8439885694023999999",
        1,
      ),
    ).rejects.toMatchObject<Partial<GoToMeetingApiError>>({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });

  it("registers RingCentral with exact permissions and three self-extension read wrappers", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("ringcentral");
    expect(manifest).toBe(RINGCENTRAL_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl:
          "https://platform.ringcentral.com/restapi/oauth/authorize",
        tokenUrl: "https://platform.ringcentral.com/restapi/oauth/token",
        requiredScopes: RINGCENTRAL_PERMISSIONS,
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_ringcentral_get_extension",
      "relay_ringcentral_list_call_log",
      "relay_ringcentral_get_call_log_record",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "ringcentral_safe",
      "dangerously_skip_permissions",
    ]);
    expect(manifest?.approvalProfiles[0].allowedActions).toEqual(
      manifest?.approvalProfiles[1].allowedActions,
    );
  });

  it("starts RingCentral OAuth with S256 PKCE while omitting scope and secrets", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      RINGCENTRAL_CLIENT_ID: "ringcentral-client-id",
      RINGCENTRAL_CLIENT_SECRET: "ringcentral-client-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "ringcentral",
      {
        returnTo: "/marketplace?app=ringcentral",
      },
    );
    const url = new URL(result.authorizationUrl);
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://platform.ringcentral.com/restapi/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("ringcentral-client-id");
    expect(url.searchParams.has("scope")).toBe(false);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(state.scopes).toEqual(RINGCENTRAL_PERMISSIONS);
    expect(state.clientSecretCiphertext).toEqual(expect.any(String));
    expect(JSON.stringify(state)).not.toContain("ringcentral-client-secret");
  });

  it("uses RingCentral PKCE token exchange without transmitting the client secret", async () => {
    const { service } = connectorOAuthHarness();
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "access", refresh_token: "rotated" }),
    } as any);
    await service.exchangeToken("ringcentral", {
      grant_type: "authorization_code",
      client_id: "client",
      client_secret: "never-send",
      code: "code",
      code_verifier: "verifier",
      redirect_uri: "https://example.com/callback",
    });
    const options = fetchMock.mock.calls[0][1] as any;
    expect(options.headers.Authorization).toBeUndefined();
    expect(String(options.body)).not.toContain("client_secret");
    expect(String(options.body)).not.toContain("never-send");
  });

  it("binds RingCentral health to the own extension and rejects drift", async () => {
    const { service } = connectorOAuthHarness();
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "101",
            account: { id: "1" },
            extensionNumber: "1001",
            name: "Relay User",
            contact: { email: "relay@example.com" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "202",
            account: { id: "1" },
            extensionNumber: "1002",
            name: "Other User",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const profile = await service.fetchProviderProfile("ringcentral", "token");
    const metadata = service.buildMetadata(
      "ringcentral",
      "client",
      RINGCENTRAL_PERMISSIONS,
      profile,
    );
    expect(metadata).toEqual(
      expect.objectContaining({
        ringCentralExtensionId: "101",
        ringCentralAccountId: "1",
        extensionVerified: true,
        selfExtensionOnly: true,
        canonicalPlatformOnly: true,
        privacyMasked: true,
        fixedEndpointsOnly: true,
        automaticRetry: false,
        automaticPagination: false,
        rawToolsEnabled: false,
        maxProviderRequestsPerAction: 2,
        maxResponseBytes: 512 * 1024,
      }),
    );
    expect(metadata).not.toHaveProperty("email");
    expect(metadata).not.toHaveProperty("extensionNumber");
    await expect(
      service.validateRingCentralExtension(
        {
          appSlug: "ringcentral",
          metadata: {
            clientId: "client",
            grantedScopes: RINGCENTRAL_PERMISSIONS,
            ringCentralExtensionId: "101",
          },
        },
        "token",
      ),
    ).rejects.toThrow("binding changed");
  });

  it("registers Dialpad with offline refresh and exactly two own-user read wrappers", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("dialpad");
    expect(manifest).toBe(DIALPAD_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://dialpad.com/oauth2/authorize",
        tokenUrl: "https://dialpad.com/oauth2/token",
        userInfoUrl: "https://dialpad.com/api/v2/users/me",
        requiredScopes: DIALPAD_SCOPES,
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_dialpad_get_user",
      "relay_dialpad_get_caller_id",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "dialpad_safe",
      "dangerously_skip_permissions",
    ]);
  });

  it("starts Dialpad OAuth with exact offline_access, S256 PKCE and no leaked secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      DIALPAD_CLIENT_ID: "dialpad-client",
      DIALPAD_CLIENT_SECRET: "dialpad-secret",
    });
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "dialpad",
      { returnTo: "/marketplace?app=dialpad" },
    );
    const url = new URL(result.authorizationUrl);
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://dialpad.com/oauth2/authorize",
    );
    expect(url.searchParams.get("scope")).toBe("offline_access");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(state.clientSecretCiphertext).toEqual(expect.any(String));
    expect(JSON.stringify(state)).not.toContain("dialpad-secret");
  });

  it("binds Dialpad health to one useful own user and rejects identity drift", async () => {
    const { service } = connectorOAuthHarness();
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 101,
            display_name: "Relay User",
            emails: ["relay@example.com"],
            company_id: 1,
            office_id: 2,
            extension: "1001",
            state: "active",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 202,
            display_name: "Other User",
            emails: ["other@example.com"],
          }),
          { status: 200 },
        ),
      );
    const profile = await service.fetchProviderProfile("dialpad", "token");
    const metadata = service.buildMetadata(
      "dialpad",
      "client",
      DIALPAD_SCOPES,
      profile,
    );
    expect(metadata).toEqual(
      expect.objectContaining({
        dialpadUserId: "101",
        displayName: "Relay User",
        userVerified: true,
        selfUserOnly: true,
        canonicalDialpadOnly: true,
        privacyMasked: true,
        fixedEndpointsOnly: true,
        automaticRetry: false,
        automaticPagination: false,
        rawToolsEnabled: false,
        maxResponseBytes: 512 * 1024,
        forwardingNumbers: "blocked",
      }),
    );
    expect(metadata).not.toHaveProperty("primaryEmail");
    expect(metadata).not.toHaveProperty("extension");
    expect(metadata).not.toHaveProperty("companyId");
    expect(metadata).not.toHaveProperty("officeId");
    expect(metadata).not.toHaveProperty("userState");
    const request = (global.fetch as jest.Mock).mock.calls[0];
    expect(request[0]).toBe("https://dialpad.com/api/v2/users/me");
    expect(request[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
      }),
    );
    expect(request[1].headers["User-Agent"]).toBe("RelayConsole-Dialpad/1.0");
    await expect(
      service.validateDialpadUser(
        {
          appSlug: "dialpad",
          metadata: {
            clientId: "client",
            grantedScopes: DIALPAD_SCOPES,
            dialpadUserId: "101",
          },
        },
        "token",
      ),
    ).rejects.toThrow("binding changed");
  });

  it("registers LINE with exact OIDC scopes and one profile wrapper", () => {
    const manifest = new MarketplaceConnectorRegistry().get("line");
    expect(manifest).toBe(LINE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://access.line.me/oauth2/v2.1/authorize",
        tokenUrl: "https://api.line.me/oauth2/v2.1/token",
        userInfoUrl: "https://api.line.me/v2/profile",
        requiredScopes: LINE_SCOPES,
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_line_get_profile",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "line_read_only",
      "line_no_access",
    ]);
  });

  it("starts LINE OAuth with exact scopes, encrypted nonce, S256 PKCE and no leaked secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      LINE_CLIENT_ID: "line-channel",
      LINE_CLIENT_SECRET: "line-secret",
    });
    const result = await service.startOAuth("workspace_1", "user_1", "line", {
      returnTo: "/marketplace?app=line",
    });
    const url = new URL(result.authorizationUrl);
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://access.line.me/oauth2/v2.1/authorize",
    );
    expect(url.searchParams.get("scope")).toBe("profile openid");
    expect(url.searchParams.get("nonce")).toEqual(expect.any(String));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(state.providerSessionCiphertext).toEqual(expect.any(String));
    expect(state.clientSecretCiphertext).toEqual(expect.any(String));
    expect(JSON.stringify(state)).not.toContain(url.searchParams.get("nonce"));
    expect(JSON.stringify(state)).not.toContain("line-secret");
  });

  it("binds LINE health to the OIDC subject and rejects profile drift", async () => {
    const { service } = connectorOAuthHarness();
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: "U123",
          displayName: "Relay User",
          pictureUrl: "https://profile.line-scdn.net/avatar",
          statusMessage: "Available",
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userId: "U999", displayName: "Other User" }),
      } as any);
    const profile = await service.fetchProviderProfile("line", "token", {
      lineSubject: "U123",
    });
    const metadata = service.buildMetadata(
      "line",
      "client",
      LINE_SCOPES,
      profile,
    );
    expect(metadata).toEqual(
      expect.objectContaining({
        lineUserId: "U123",
        displayName: "Relay User",
        nonceVerified: true,
        idTokenVerified: true,
        subjectBound: true,
        lineLoginOnly: true,
        messagingAuthority: false,
        fixedEndpointsOnly: true,
        rawToolsEnabled: false,
      }),
    );
    await expect(
      service.validateLineProfile(
        {
          appSlug: "line",
          metadata: {
            clientId: "client",
            grantedScopes: LINE_SCOPES,
            lineUserId: "U123",
          },
        },
        "token",
      ),
    ).rejects.toThrow("OIDC-bound");
  });

  it("verifies LINE RS256 ID tokens against issuer, audience, nonce, expiry and subject", async () => {
    const { service } = connectorOAuthHarness();
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const encode = (value: Record<string, unknown>) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const header = encode({ alg: "RS256", kid: "line-key-1", typ: "JWT" });
    const claims = encode({
      iss: "https://access.line.me",
      aud: "line-channel",
      nonce: "expected-nonce",
      sub: "U123",
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    const signingInput = `${header}.${claims}`;
    const token = `${signingInput}.${sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url")}`;
    const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
    jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [{ ...jwk, kid: "line-key-1", kty: "RSA", alg: "RS256" }],
      }),
    } as any);
    await expect(
      service.verifyLineIdToken(token, "line-channel", "expected-nonce"),
    ).resolves.toEqual({ sub: "U123" });
    await expect(
      service.verifyLineIdToken(token, "line-channel", "wrong-nonce"),
    ).rejects.toThrow("verification failed");
  });

  it("requires and persists LINE refresh-token rotation", async () => {
    const { service, credentials, connectionRepo } = connectorOAuthHarness();
    const connection = {
      id: "conn_line",
      workspaceId: "workspace_1",
      appSlug: "line",
      metadata: { clientId: "line-channel" },
      status: "ready",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    credentials.applyEncrypted(connection, {
      accessToken: "expired-access",
      refreshToken: "old-refresh",
      clientId: "line-channel",
      clientSecret: "line-secret",
      expiresAt: "2026-01-01T00:00:00.000Z",
      grantedScopes: LINE_SCOPES,
    });
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access",
        refresh_token: "rotated-refresh",
        expires_in: 3600,
        scope: "profile openid",
      }),
    } as any);
    const refreshed = await service.refreshIfNeeded(connection);
    expect(refreshed).toEqual(
      expect.objectContaining({ accessToken: "new-access", refreshed: true }),
    );
    expect(refreshed.credentials.refreshToken).toBe("rotated-refresh");
    expect(String((fetchMock.mock.calls[0][1] as any).body)).toContain(
      "refresh_token=old-refresh",
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(connection);
  });

  it("revokes LINE upstream before retaining only Railway reauthorization material", async () => {
    const { service, credentials, connectionRepo } = connectorOAuthHarness();
    const connection = {
      id: "conn_line",
      workspaceId: "workspace_1",
      appSlug: "line",
      displayName: "LINE",
      authType: "oauth2_pkce_user",
      credentialNames: [],
      selectedCapabilities: ["profile_read"],
      status: "ready",
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    credentials.applyEncrypted(connection, {
      accessToken: "line-access",
      refreshToken: "line-refresh",
      clientId: "line-channel",
      clientSecret: "line-secret",
    });
    jest
      .spyOn(service, "getConnectionWithSecrets")
      .mockResolvedValue(connection);
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue({ ok: true } as any);
    await service.disconnect("workspace_1", "user_1", "line", "conn_line");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.line.me/oauth2/v2.1/revoke",
    );
    const revokeBody = String((fetchMock.mock.calls[0][1] as any).body);
    expect(revokeBody).toContain("access_token=line-access");
    expect(revokeBody).toContain("client_id=line-channel");
    const saved = connectionRepo.save.mock.calls.at(-1)?.[0];
    expect(credentials.decrypt(saved)).toEqual({
      clientId: "line-channel",
      clientSecret: "line-secret",
    });
    expect(saved.status).toBe("needs_credentials");
    expect(saved.metadata).toEqual(
      expect.objectContaining({
        provider: "line",
        tokenStatus: "disconnected",
      }),
    );
  });

  it("binds Eventbrite health to one useful connected user and rejects identity drift", async () => {
    const { service } = connectorOAuthHarness();
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        arrayBuffer: async () =>
          new TextEncoder().encode(
            JSON.stringify({ id: 1234, name: "Relay Organizer" }),
          ).buffer,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        arrayBuffer: async () =>
          new TextEncoder().encode(
            JSON.stringify({ id: 5678, name: "Other Organizer" }),
          ).buffer,
      } as any);
    const profile = await service.fetchProviderProfile("eventbrite", "token");
    const metadata = service.buildMetadata(
      "eventbrite",
      "app-key",
      [],
      profile,
    );
    expect(metadata).toEqual(
      expect.objectContaining({
        eventbriteUserId: "1234",
        displayName: "Relay Organizer",
        userVerified: true,
        userBindingVerified: true,
        fixedEndpointsOnly: true,
        organizationMembershipRequired: true,
        automaticRetry: false,
        automaticPagination: false,
        rawToolsEnabled: false,
        grantedScopes: [],
      }),
    );
    const request = (global.fetch as jest.Mock).mock.calls[0];
    expect(request[0]).toBe("https://www.eventbriteapi.com/v3/users/me/");
    expect(request[1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
    await expect(
      service.validateEventbriteUser(
        {
          appSlug: "eventbrite",
          metadata: { clientId: "app-key", eventbriteUserId: "1234" },
        } as any,
        "token",
      ),
    ).rejects.toThrow("connected user binding changed");
  });

  it("binds Twist health to one useful connected user and rejects identity drift", async () => {
    const { service } = connectorOAuthHarness();
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1234,
          name: "Relay Teammate",
          email: "relay@example.com",
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 5678, name: "Other Teammate" }),
      } as any);
    const profile = await service.fetchProviderProfile("twist", "token");
    const metadata = service.buildMetadata(
      "twist",
      "client-id",
      TWIST_REQUIRED_SCOPES,
      profile,
    );
    expect(metadata).toEqual(
      expect.objectContaining({
        twistUserId: "1234",
        displayName: "Relay Teammate",
        email: "relay@example.com",
        userVerified: true,
        railwayCallbackOnly: true,
        stateVerified: true,
        readOnlyScopes: true,
        fixedEndpointsOnly: true,
        automaticRetry: false,
        automaticPagination: false,
        rawToolsEnabled: false,
        grantedScopes: TWIST_REQUIRED_SCOPES,
      }),
    );
    const request = (global.fetch as jest.Mock).mock.calls[0];
    expect(request[0]).toBe(
      "https://api.twist.com/api/v3/users/get_session_user",
    );
    expect(request[1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
    await expect(
      service.validateTwistUser(
        {
          appSlug: "twist",
          metadata: {
            clientId: "client-id",
            grantedScopes: TWIST_REQUIRED_SCOPES,
            twistUserId: "1234",
          },
        } as any,
        "token",
      ),
    ).rejects.toThrow("connected user binding changed");
  });

  it("keeps Twist access tokens usable when the provider omits expiry and refresh tokens", async () => {
    const { service, credentials } = connectorOAuthHarness();
    const connection = {
      id: "conn_twist",
      workspaceId: "workspace_1",
      appSlug: "twist",
      metadata: {
        clientId: "twist-client-id",
        grantedScopes: TWIST_REQUIRED_SCOPES,
      },
      status: "ready",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    credentials.applyEncrypted(connection, {
      accessToken: "long-lived-token",
      clientId: "twist-client-id",
      clientSecret: "twist-client-secret",
      grantedScopes: TWIST_REQUIRED_SCOPES,
    });
    await expect(service.refreshIfNeeded(connection)).resolves.toEqual(
      expect.objectContaining({
        accessToken: "long-lived-token",
        refreshed: false,
      }),
    );
  });

  it("binds Meetup health to a useful connected member and rejects identity drift", async () => {
    const { service } = connectorOAuthHarness();
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        arrayBuffer: async () =>
          new TextEncoder().encode(
            JSON.stringify({
              data: { self: { id: 1234, name: "Cool Developer" } },
            }),
          ).buffer,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        arrayBuffer: async () =>
          new TextEncoder().encode(
            JSON.stringify({
              data: { self: { id: 5678, name: "Other Member" } },
            }),
          ).buffer,
      } as any);
    const profile = await service.fetchProviderProfile("meetup", "token");
    const metadata = service.buildMetadata("meetup", "client-id", [], profile);
    expect(metadata).toEqual(
      expect.objectContaining({
        meetupMemberId: "1234",
        displayName: "Cool Developer",
        memberVerified: true,
        memberBindingVerified: true,
        fixedQueriesOnly: true,
        automaticRetry: false,
        automaticPagination: false,
        rawToolsEnabled: false,
        grantedScopes: [],
      }),
    );
    const request = (global.fetch as jest.Mock).mock.calls[0];
    expect(request[0]).toBe("https://api.meetup.com/gql-ext");
    expect(JSON.parse(request[1].body)).toEqual({
      query: "query RelayMeetupSelf { self { id name } }",
    });
    await expect(
      service.validateMeetupMember(
        {
          appSlug: "meetup",
          metadata: { clientId: "client-id", meetupMemberId: "1234" },
        } as any,
        "token",
      ),
    ).rejects.toThrow("connected member binding changed");
  });

  it("starts Nextdoor OAuth with Railway-held credentials and encrypted ephemeral state", async () => {
    const { service, credentials, oauthStateRepo } = connectorOAuthHarness({
      NEXTDOOR_CLIENT_ID: "railway-client-id",
      NEXTDOOR_CLIENT_SECRET: "railway-client-secret",
    });

    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "nextdoor",
      {
        expectedProfileLabel: "My Neighbourhood",
        returnTo: "/marketplace?app=nextdoor",
      },
    );

    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe(
      "https://www.nextdoor.com/v3/authorize/",
    );
    expect(url.searchParams.get("client_id")).toBe("railway-client-id");
    expect(url.searchParams.get("scope")).toBe(NEXTDOOR_SCOPES.join(" "));
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(savedState.stateHash).not.toBe(url.searchParams.get("state"));
    expect(savedState.clientSecretCiphertext).toEqual(expect.any(String));
    expect(savedState.providerSessionCiphertext).toEqual(expect.any(String));
    expect(savedState).not.toHaveProperty("clientSecret");
    const providerSession = JSON.parse(
      credentials.decryptEncrypted({
        ciphertext: savedState.providerSessionCiphertext,
        iv: savedState.providerSessionIv,
        authTag: savedState.providerSessionAuthTag,
        keyVersion: savedState.providerSessionKeyVersion,
      }),
    );
    expect(providerSession).toEqual({
      expectedProfileLabel: "My Neighbourhood",
    });
  });

  it("binds NationBuilder OAuth state to the normalized nation slug", async () => {
    const { service, credentials, oauthStateRepo } = connectorOAuthHarness({
      NATIONBUILDER_CLIENT_ID: "nationbuilder-client-id",
      NATIONBUILDER_CLIENT_SECRET: "nationbuilder-client-secret",
    });

    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "nationbuilder",
      {
        providerDomain: "My-Nation",
        returnTo: "/marketplace?app=nationbuilder",
      },
    );

    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(url.searchParams.get("client_id")).toBe("nationbuilder-client-id");
    expect(savedState.providerSessionCiphertext).toEqual(expect.any(String));
    const providerSession = JSON.parse(
      credentials.decryptEncrypted({
        ciphertext: savedState.providerSessionCiphertext,
        iv: savedState.providerSessionIv,
        authTag: savedState.providerSessionAuthTag,
        keyVersion: savedState.providerSessionKeyVersion,
      }),
    );
    expect(providerSession).toEqual({
      nationBuilderNationSlug: "my-nation",
    });
  });

  it("uses HTTP Basic for Nextdoor token exchange without duplicating the secret in the form", async () => {
    const { service } = connectorOAuthHarness();
    jest.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "access-token" }),
    } as any);

    await service.exchangeToken("nextdoor", {
      grant_type: "authorization_code",
      code: "code",
      client_id: "client-id",
      client_secret: "client-secret",
    });

    const request = (global.fetch as jest.Mock).mock.calls[0];
    expect(request[0]).toBe("https://auth.nextdoor.com/v2/token");
    expect(request[1].headers.Authorization).toBe(
      `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
    );
    expect(
      (request[1].body as URLSearchParams).get("client_secret"),
    ).toBeNull();
    expect((request[1].body as URLSearchParams).get("client_id")).toBe(
      "client-id",
    );
  });

  it("fails closed unless Nextdoor returns one exact verified neighbor or business profile", async () => {
    const { service } = connectorOAuthHarness();
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            profiles: [
              { id: "p1", type: "neighbor", name: "Expected", verified: false },
              { id: "p2", type: "business", name: "Other", verified: true },
            ],
          }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            profiles: [
              { id: "p1", type: "neighbor", name: "One", verified: true },
              { id: "p2", type: "business", name: "Two", verified: true },
            ],
          }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            profiles: [
              {
                id: "p3",
                is_entity_profile: true,
                entity_page: { id: "entity-3", name: "Expected" },
              },
            ],
          }),
      } as any);

    await expect(
      service.fetchProviderProfile("nextdoor", "token", {
        expectedProfileLabel: "Expected",
      }),
    ).rejects.toThrow("expected neighbor or business profile");
    await expect(
      service.fetchProviderProfile("nextdoor", "token"),
    ).rejects.toThrow("returned multiple profiles");
    const profile = await service.fetchProviderProfile("nextdoor", "token", {
      expectedProfileLabel: "Expected",
    });
    expect(
      service.buildMetadata("nextdoor", "client-id", NEXTDOOR_SCOPES, profile),
    ).toEqual(
      expect.objectContaining({
        selectedProfileId: "p3",
        selectedProfileType: "business",
        profileVerified: true,
        selectedProfileIdBound: true,
        railwayCallbackOnly: true,
      }),
    );
  });

  it("rejects Nextdoor health validation when the server-bound profile changes", async () => {
    const { service } = connectorOAuthHarness();
    jest.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          profiles: [
            {
              id: "different-profile",
              type: "neighbor",
              name: "Expected",
              verified: true,
            },
          ],
        }),
    } as any);
    const connection = {
      appSlug: "nextdoor",
      metadata: {
        clientId: "client-id",
        displayName: "Expected",
        selectedProfileId: "bound-profile",
        grantedScopes: NEXTDOOR_SCOPES,
      },
    } as any;

    await expect(
      service.validateNextdoorProfile(connection, "access-token"),
    ).rejects.toThrow("selected profile binding changed");
  });

  it("disconnects Nextdoor by destroying tokens while retaining only Railway-side reauthorization material", async () => {
    const { service, credentials, connectionRepo } = connectorOAuthHarness();
    const connection = {
      id: "conn_nextdoor",
      workspaceId: "workspace_1",
      appSlug: "nextdoor",
      displayName: "Nextdoor",
      environment: "default",
      authType: "oauth2_authorization_code",
      credentialNames: [
        "NEXTDOOR_OAUTH_TOKEN_BUNDLE",
        "NEXTDOOR_CLIENT_SECRET",
      ],
      selectedCapabilities: ["profile_read"],
      status: "ready",
      metadata: { selectedProfileId: "profile-1" },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date("2026-07-12T10:00:00.000Z"),
      updatedAt: new Date("2026-07-12T10:00:00.000Z"),
      ...credentials.encrypt({
        clientId: "client-id",
        clientSecret: "client-secret",
        accessToken: "access-token",
        refreshToken: "refresh-token",
      }),
    } as any;
    connection.secretCiphertext = connection.ciphertext;
    connection.secretIv = connection.iv;
    connection.secretAuthTag = connection.authTag;
    connection.secretKeyVersion = connection.keyVersion;
    connectionRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => connection),
    });

    const view = await service.disconnect(
      "workspace_1",
      "user_1",
      "nextdoor",
      "conn_nextdoor",
    );

    const saved = connectionRepo.save.mock.calls[0][0];
    expect(credentials.decrypt(saved)).toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
    });
    expect(JSON.stringify(view)).not.toContain("access-token");
    expect(JSON.stringify(view)).not.toContain("refresh-token");
    expect(JSON.stringify(view)).not.toContain("client-secret");
    expect(view).toEqual(
      expect.objectContaining({
        status: "needs_credentials",
        metadata: expect.objectContaining({ tokenStatus: "disconnected" }),
      }),
    );
  });

  it("blocks OAuth start for beta-unavailable native connectors", async () => {
    process.env.CLAWCHAT_MARKETPLACE_BETA_MODE = "true";
    process.env.CLAWCHAT_MARKETPLACE_ALLOWED_APPS = "github, outlook";
    process.env.CLAWCHAT_MARKETPLACE_BLOCKED_APPS = "outlook";
    const service = oauthService();

    await expect(
      service.startOAuth("workspace_1", "user_1", "outlook", {
        clientId: "client-id",
      }),
    ).rejects.toThrow("This app has been temporarily disabled by Relay.");
  });

  it("rejects mismatched, consumed, and expired OAuth state before token exchange", async () => {
    for (const oauthState of [
      null,
      {
        id: "consumed-state",
        appSlug: "outlook",
        consumedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        id: "expired-state",
        appSlug: "outlook",
        consumedAt: null,
        expiresAt: new Date(Date.now() - 1),
      },
    ]) {
      const { service, oauthStateRepo } = connectorOAuthHarness();
      oauthStateRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => oauthState),
      });
      const fetchMock = jest.spyOn(global, "fetch" as any);
      await expect(
        service.completeOAuth("outlook", {
          state: "untrusted-returned-state",
          code: "authorization-code",
        }),
      ).rejects.toThrow(/OAuth state/);
      expect(fetchMock).not.toHaveBeenCalled();
      fetchMock.mockRestore();
    }
  });

  it("destroys denied OAuth state and audits no provider secrets", async () => {
    const { service, oauthStateRepo, auditLogService } =
      connectorOAuthHarness();
    oauthStateRepo.findOne.mockResolvedValue({
      id: "state-to-destroy",
      workspaceId: "workspace_1",
      userId: "user_1",
      appSlug: "outlook",
    });

    await expect(
      service.cancelOAuthState("outlook", "raw-denied-state"),
    ).resolves.toBe(true);

    expect(oauthStateRepo.findOne).toHaveBeenCalledWith({
      where: {
        stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        appSlug: "outlook",
      },
    });
    expect(oauthStateRepo.delete).toHaveBeenCalledWith({
      id: "state-to-destroy",
    });
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.outlook.oauth.denied",
        workspaceId: "workspace_1",
        metadata: { stateDestroyed: true },
      }),
    );
    expect(JSON.stringify(auditLogService.record.mock.calls)).not.toContain(
      "raw-denied-state",
    );
  });

  it("stores connector OAuth PKCE verifiers encrypted and cleans stale state on start", async () => {
    const { service, credentials, oauthStateRepo } = connectorOAuthHarness();

    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "outlook",
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        microsoftAuthorityMode: "multi_tenant_org",
        returnTo: "/marketplace?app=outlook",
      },
    );

    const url = new URL(result.authorizationUrl);
    const savedState = oauthStateRepo.save.mock.calls[0][0];
    expect(savedState).toEqual(
      expect.objectContaining({
        appSlug: "outlook",
        clientId: "client-id",
        legacyCodeVerifier: null,
        codeVerifierCiphertext: expect.any(String),
        codeVerifierIv: expect.any(String),
        codeVerifierAuthTag: expect.any(String),
        codeVerifierKeyVersion: expect.any(String),
        returnTo: "https://clawchat.team/marketplace?app=outlook",
      }),
    );
    expect(savedState).not.toHaveProperty("codeVerifier");
    const decryptedVerifier = JSON.parse(
      credentials.decryptEncrypted({
        ciphertext: savedState.codeVerifierCiphertext,
        iv: savedState.codeVerifierIv,
        authTag: savedState.codeVerifierAuthTag,
        keyVersion: savedState.codeVerifierKeyVersion,
      }),
    ).codeVerifier;
    expect(url.searchParams.get("code_challenge")).toBe(
      service.base64UrlSha256(decryptedVerifier),
    );
    expect(oauthStateRepo.delete).toHaveBeenCalledWith(
      expect.objectContaining({ appSlug: "outlook" }),
    );
  });

  it("uses encrypted connector PKCE verifiers and deletes consumed state on callback", async () => {
    const {
      service,
      credentials,
      oauthStateRepo,
      connectionRepo,
      outlookGraph,
    } = connectorOAuthHarness();
    const encryptedSecret = credentials.encrypt({
      clientSecret: "client-secret",
    });
    oauthStateRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => ({
        id: "state_id",
        workspaceId: "workspace_1",
        userId: "user_1",
        appSlug: "outlook",
        reauthorizeConnectionId: null,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        ...encryptedConnectorVerifierFields(credentials, "verifier"),
        clientId: "client-id",
        clientSecretCiphertext: encryptedSecret.ciphertext,
        clientSecretIv: encryptedSecret.iv,
        clientSecretAuthTag: encryptedSecret.authTag,
        clientSecretKeyVersion: encryptedSecret.keyVersion,
        authorityMode: "multi_tenant_org",
        authorityTenantId: null,
        authorityAuthorizeUrl:
          "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
        authorityTokenUrl:
          "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
        redirectUri:
          "https://api.relayconsole.work/api/v1/marketplace/oauth/outlook/callback",
        scopes: [
          "openid",
          "profile",
          "offline_access",
          "https://graph.microsoft.com/Mail.Read",
        ],
        selectedCapabilities: ["inbox_messages_list"],
        displayName: "Outlook",
        environment: "default",
        returnTo: "https://clawchat.team/marketplace?app=outlook",
      })),
    });
    jest.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "Mail.Read",
      }),
    } as any);
    outlookGraph.getMe.mockResolvedValueOnce({
      id: "microsoft-user-id",
      mail: "owner@example.com",
      displayName: "Owner",
    });

    const result = await service.completeOAuth("outlook", {
      state: "returned-state",
      code: "auth-code",
    });

    const tokenRequestBody = (global.fetch as jest.Mock).mock.calls[0][1]
      .body as URLSearchParams;
    expect(tokenRequestBody.get("code_verifier")).toBe("verifier");
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        appSlug: "outlook",
        authType: "oauth2_pkce_user",
        secretCiphertext: expect.any(String),
      }),
    );
    expect(result.returnTo).toContain("marketplace_connection_id=");
    expect(oauthStateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "state_id",
        consumedAt: expect.any(Date),
        legacyCodeVerifier: null,
        codeVerifierCiphertext: null,
        codeVerifierIv: null,
        codeVerifierAuthTag: null,
        codeVerifierKeyVersion: null,
      }),
    );
    expect(oauthStateRepo.delete).toHaveBeenCalledWith({ id: "state_id" });
  });

  it("blocks runtime marketplace tool execution for beta-unavailable native connectors", async () => {
    process.env.CLAWCHAT_MARKETPLACE_BETA_MODE = "true";
    process.env.CLAWCHAT_MARKETPLACE_ALLOWED_APPS = "github, exa";
    process.env.CLAWCHAT_MARKETPLACE_BLOCKED_APPS = "exa-search";
    const decrypt = jest.fn();
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt } as any,
      { getConnectionWithSecrets: jest.fn() } as any,
      { search: jest.fn() } as any,
      { health: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo({
        findOne: jest.fn(async () => ({
          id: "dispatch_1",
          workspaceId: "workspace_1",
          agentId: "agent_1",
          messageId: "msg_1",
        })),
      }),
      repo(),
      repo(),
      repo(),
      repo(),
    );

    await expect(
      service.executeDispatchTool({
        workspaceId: "workspace_1",
        dispatchId: "dispatch_1",
        appSlug: "exa-search",
        toolName: "exa_search",
        body: { arguments: { query: "blocked" } },
      }),
    ).rejects.toThrow("This app has been temporarily disabled by Relay.");
    expect(decrypt).not.toHaveBeenCalled();
  });

  it("keeps Outlook on the Relay-owned common Microsoft authority", () => {
    const service = oauthService({ MICROSOFT_TENANT_ID: "tenant-123" });
    const authority = service.resolveOAuthAuthority("outlook");

    expect(authority).toMatchObject({
      mode: "multi_tenant_common",
      tenantId: null,
      authorizationUrl:
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    });
  });

  it("generates organizations Microsoft authority URLs", () => {
    const service = oauthService({
      MICROSOFT_AUTHORITY_MODE: "multi_tenant_org",
    });
    const authority = service.resolveOAuthAuthority("outlook");

    expect(authority.authorizationUrl).toBe(
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    );
    expect(authority.tokenUrl).toBe(
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
    );
  });

  it("generates common Microsoft authority URLs only when selected", () => {
    const service = oauthService({
      MICROSOFT_AUTHORITY_MODE: "multi_tenant_common",
    });
    const authority = service.resolveOAuthAuthority("outlook");

    expect(authority.authorizationUrl).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    expect(authority.tokenUrl).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    );
  });

  it("refreshes Microsoft tokens against the stored connection authority", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
        scope:
          "offline_access User.Read Mail.Read Mail.ReadWrite Mail.Send MailboxSettings.Read MailboxSettings.ReadWrite",
      }),
    } as any);
    const connection = outlookConnection({
      metadata: {
        microsoftAuthorityMode: "single_tenant",
        microsoftAuthorityTenantId: "tenant-abc",
      },
    });
    const service = new MarketplaceConnectorOAuthService(
      new MarketplaceConnectorRegistry(),
      {
        decrypt: jest.fn(() => ({
          clientId: "client-id",
          accessToken: "old-access-token",
          refreshToken: "refresh-token",
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        })),
        applyEncrypted: jest.fn(),
      } as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      { get: jest.fn() } as any,
      { getMe: jest.fn() } as any,
      repo({ save: jest.fn(async (value) => value) }),
      repo(),
    );

    await service.refreshIfNeeded(connection);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://login.microsoftonline.com/tenant-abc/oauth2/v2.0/token",
    );
    jest.restoreAllMocks();
  });

  it("accepts Microsoft offline_access when a refresh token is returned without an echoed scope", () => {
    const service = oauthService();
    const grantedScopes = service.resolveGrantedScopes(
      "outlook",
      "Mail.Read",
      [
        "openid",
        "profile",
        "offline_access",
        "https://graph.microsoft.com/Mail.Read",
      ],
      "refresh-token",
    );

    expect(grantedScopes).toEqual(["Mail.Read", "offline_access"]);
    expect(() =>
      service.assertRequiredScopes("outlook", grantedScopes, {
        requestedScopes: [
          "openid",
          "profile",
          "offline_access",
          "https://graph.microsoft.com/Mail.Read",
        ],
        refreshToken: "refresh-token",
      }),
    ).not.toThrow();
  });

  it("rejects Microsoft offline_access when no refresh token is returned", () => {
    const service = oauthService();
    const grantedScopes = service.resolveGrantedScopes(
      "outlook",
      "Mail.Read",
      [
        "openid",
        "profile",
        "offline_access",
        "https://graph.microsoft.com/Mail.Read",
      ],
      undefined,
    );

    expect(grantedScopes).not.toContain("offline_access");
    expect(() =>
      service.assertRequiredScopes("outlook", grantedScopes, {
        requestedScopes: [
          "openid",
          "profile",
          "offline_access",
          "https://graph.microsoft.com/Mail.Read",
        ],
      }),
    ).toThrow("Outlook did not grant required scopes: offline_access");
  });

  it("builds connector OAuth callback redirects to the frontend return target", async () => {
    const service = new MarketplaceConnectorOAuthService(
      new MarketplaceConnectorRegistry(),
      {
        encrypt: jest.fn(),
        decrypt: jest.fn(),
        decryptEncrypted: jest.fn(),
        applyEncrypted: jest.fn(),
      } as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      {
        get: jest.fn((key: string) =>
          key === "CORS_ORIGINS" ? "https://clawchat.team" : undefined,
        ),
      } as any,
      { getMe: jest.fn() } as any,
      repo(),
      repo({
        findOne: jest.fn(async () => ({
          returnTo: "https://clawchat.team/marketplace?app=outlook",
        })),
      }),
    ) as any;

    const redirectUrl = await service.buildCallbackRedirect("outlook", {
      state: "state-token",
      status: "error",
      message: "OAuth failed",
    });

    expect(redirectUrl).toBe(
      "https://clawchat.team/marketplace?app=outlook&connector_oauth=outlook&status=error&message=OAuth+failed",
    );
  });

  it("normalizes connector OAuth return targets to approved frontend origins only", () => {
    const service = oauthService({
      CLAWCHAT_WEB_ORIGIN: "https://clawchat.team",
      CORS_ORIGINS: "https://preview.clawchat.team",
    });

    expect(
      service.normalizeReturnTo(
        "https://clawchat.team/marketplace?app=outlook",
      ),
    ).toBe("https://clawchat.team/marketplace?app=outlook");
    expect(
      service.normalizeReturnTo(
        "https://preview.clawchat.team/marketplace?app=outlook",
      ),
    ).toBe("https://preview.clawchat.team/marketplace?app=outlook");
    expect(service.normalizeReturnTo("/marketplace?app=outlook")).toBe(
      "https://clawchat.team/marketplace?app=outlook",
    );
    expect(service.normalizeReturnTo("https://evil.example/phish")).toBeNull();
    expect(service.normalizeReturnTo("//evil.example/phish")).toBeNull();
    expect(
      service.appendOAuthResult("https://evil.example/phish", "conn_outlook"),
    ).toBeNull();
    expect(
      service.appendOAuthResult(
        "relayconsole://marketplace/oauth?workspace_id=workspace_1&marketplace_app=jotform",
        "conn_jotform",
      ),
    ).toBe(
      "relayconsole://marketplace/oauth?workspace_id=workspace_1&marketplace_app=jotform",
    );
  });

  it("falls back to the frontend marketplace URL when persisted connector OAuth return target is unsafe", async () => {
    const service = new MarketplaceConnectorOAuthService(
      new MarketplaceConnectorRegistry(),
      {
        encrypt: jest.fn(),
        decrypt: jest.fn(),
        decryptEncrypted: jest.fn(),
        applyEncrypted: jest.fn(),
      } as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      {
        get: jest.fn((key: string) =>
          key === "CLAWCHAT_WEB_ORIGIN" ? "https://clawchat.team" : undefined,
        ),
      } as any,
      { getMe: jest.fn() } as any,
      repo(),
      repo({
        findOne: jest.fn(async () => ({
          returnTo: "https://evil.example/phish",
        })),
      }),
    ) as any;

    const redirectUrl = await service.buildCallbackRedirect("outlook", {
      state: "state-token",
      status: "error",
      message: "OAuth failed",
    });

    expect(redirectUrl).toBe(
      "https://clawchat.team/app?connector_oauth=outlook&status=error&message=OAuth+failed",
    );
  });

  it("registers Exa as an API-key native connector with executable tools", () => {
    const registry = new MarketplaceConnectorRegistry();

    expect(registry.get("exa-search")?.connectorType).toBe("native_clawchat");
    expect(EXA_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(EXA_CONNECTOR_MANIFEST.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "EXA_API_KEY",
          secret: true,
          storedIn: "encrypted_secret",
        }),
      ]),
    );
    expect(registry.getTool("exa-search", "exa_search")?.name).toBe(
      "exa.search",
    );
    expect(
      registry.getTool("exa-search", "exa.research")?.approvalRequired,
    ).toBe(true);
  });

  it("registers Mailgun with customer-owned credentials and full Safe/Dangerous capability policy", () => {
    const registry = new MarketplaceConnectorRegistry();
    const app = MARKETPLACE_CATALOG.find((entry) => entry.slug === "mailgun");

    expect(registry.get("mailgun")?.connectorType).toBe("native_clawchat");
    expect(MAILGUN_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      MAILGUN_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual([
      "MAILGUN_API_KEY",
      "MAILGUN_DOMAIN",
      "MAILGUN_REGION",
      "MAILGUN_KEY_TYPE",
    ]);
    expect(
      registry.getTool("mailgun", "mailgun_send_message")?.approvalRequired,
    ).toBe(true);
    expect(registry.getTool("mailgun", "mailgun_request")?.capability).toBe(
      "full_api",
    );
    expect(app?.approvalProfiles.map((profile) => profile.id)).toEqual(
      expect.arrayContaining(["mailgun_safe", "dangerously_skip_permissions"]),
    );
    expect(
      app?.runtimeSupport.every(
        (runtime) => runtime.installSupport === "installable",
      ),
    ).toBe(true);
  });

  it("registers SendGrid with customer-owned credentials and full Safe/Dangerous capability policy", () => {
    const registry = new MarketplaceConnectorRegistry();
    const app = MARKETPLACE_CATALOG.find((entry) => entry.slug === "sendgrid");
    expect(registry.get("sendgrid")?.connectorType).toBe("native_clawchat");
    expect(
      SENDGRID_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual([
      "SENDGRID_API_KEY",
      "SENDGRID_REGION",
      "SENDGRID_SENDER_BOUNDARY",
    ]);
    expect(
      registry.getTool("sendgrid", "sendgrid_send_mail")?.approvalRequired,
    ).toBe(true);
    expect(registry.getTool("sendgrid", "sendgrid_request")?.capability).toBe(
      "full_api",
    );
    expect(app?.approvalProfiles.map((profile) => profile.id)).toEqual(
      expect.arrayContaining(["sendgrid_safe", "dangerously_skip_permissions"]),
    );
  });

  it("registers Postmark with server/account token authority and full Safe/Dangerous policy", () => {
    const registry = new MarketplaceConnectorRegistry();
    const app = MARKETPLACE_CATALOG.find((entry) => entry.slug === "postmark");
    expect(registry.get("postmark")?.connectorType).toBe("native_clawchat");
    expect(
      POSTMARK_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual([
      "POSTMARK_SERVER_TOKEN",
      "POSTMARK_ACCOUNT_TOKEN",
      "POSTMARK_SENDER_BOUNDARY",
      "POSTMARK_MESSAGE_STREAM",
    ]);
    expect(
      registry.getTool("postmark", "postmark_send_email")?.approvalRequired,
    ).toBe(true);
    expect(registry.getTool("postmark", "postmark_request")?.capability).toBe(
      "full_api",
    );
    expect(app?.approvalProfiles.map((profile) => profile.id)).toEqual(
      expect.arrayContaining(["postmark_safe", "dangerously_skip_permissions"]),
    );
  });

  it("registers Resend with customer-owned key authority and full Safe/Dangerous policy", () => {
    const registry = new MarketplaceConnectorRegistry();
    const app = MARKETPLACE_CATALOG.find((entry) => entry.slug === "resend");
    expect(registry.get("resend")?.connectorType).toBe("native_clawchat");
    expect(
      RESEND_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["RESEND_API_KEY", "RESEND_KEY_PERMISSION", "RESEND_DOMAIN"]);
    expect(
      registry.getTool("resend", "resend_send_email")?.approvalRequired,
    ).toBe(true);
    expect(registry.getTool("resend", "resend_request")?.capability).toBe(
      "full_api",
    );
    expect(app?.approvalProfiles.map((profile) => profile.id)).toEqual(
      expect.arrayContaining(["resend_safe", "dangerously_skip_permissions"]),
    );
  });

  it("registers SparkPost with regional/subaccount key authority and Safe/Dangerous policy", () => {
    const registry = new MarketplaceConnectorRegistry();
    const app = MARKETPLACE_CATALOG.find((entry) => entry.slug === "sparkpost");
    expect(registry.get("sparkpost")?.connectorType).toBe("native_clawchat");
    expect(
      SPARKPOST_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual([
      "SPARKPOST_API_KEY",
      "SPARKPOST_REGION",
      "SPARKPOST_SENDER_DOMAIN",
      "SPARKPOST_SUBACCOUNT_ID",
    ]);
    expect(
      registry.getTool("sparkpost", "sparkpost_create_transmission")
        ?.approvalRequired,
    ).toBe(true);
    expect(registry.getTool("sparkpost", "sparkpost_request")?.capability).toBe(
      "full_api",
    );
    expect(app?.approvalProfiles.map((profile) => profile.id)).toEqual(
      expect.arrayContaining([
        "sparkpost_safe",
        "dangerously_skip_permissions",
      ]),
    );
  });
  it("registers Brevo with customer-owned API-key authority and Safe/Dangerous policy", () => {
    const registry = new MarketplaceConnectorRegistry();
    const app = MARKETPLACE_CATALOG.find((entry) => entry.slug === "brevo");
    expect(registry.get("brevo")?.connectorType).toBe("native_clawchat");
    expect(
      BREVO_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name),
    ).toEqual(["BREVO_API_KEY", "BREVO_SENDER_BOUNDARY"]);
    expect(
      registry.getTool("brevo", "brevo_send_transactional_email")
        ?.approvalRequired,
    ).toBe(true);
    expect(registry.getTool("brevo", "brevo_request")?.capability).toBe(
      "full_api",
    );
    expect(app?.approvalProfiles.map((profile) => profile.id)).toEqual(
      expect.arrayContaining(["brevo_safe", "dangerously_skip_permissions"]),
    );
  });
  it("registers Mailjet with customer credentials and Safe/Dangerous policy", () => {
    const r = new MarketplaceConnectorRegistry(),
      a = MARKETPLACE_CATALOG.find((x) => x.slug === "sinch-mailjet");
    expect(r.get("sinch-mailjet")?.connectorType).toBe("native_clawchat");
    expect(
      SINCH_MAILJET_CONNECTOR_MANIFEST.auth.credentialSchema.map((x) => x.name),
    ).toEqual([
      "MAILJET_API_KEY",
      "MAILJET_SECRET_KEY",
      "MAILJET_SENDER_BOUNDARY",
    ]);
    expect(a?.approvalProfiles.map((x) => x.id)).toEqual(
      expect.arrayContaining(["mailjet_safe", "dangerously_skip_permissions"]),
    );
  });

  it("registers Evernote with Railway OAuth 1.0a and Safe/Dangerous policy", () => {
    const registry = new MarketplaceConnectorRegistry();
    const catalog = MARKETPLACE_CATALOG.find(
      (item) => item.slug === "evernote",
    );
    expect(registry.get("evernote")?.auth.type).toBe("oauth1");
    expect(EVERNOTE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "evernote.searchNotes",
        "evernote.createNote",
        "evernote.invoke",
      ]),
    );
    expect(catalog?.approvalProfiles.map((profile) => profile.id)).toEqual(
      expect.arrayContaining(["evernote_safe", "dangerously_skip_permissions"]),
    );
  });

  it("registers FuseBase as customer-owned MCP with Safe and Dangerous policy", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(FUSEBASE_CONNECTOR_MANIFEST.auth.type).toBe("mcp");
    expect(FUSEBASE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "fusebase.listTools",
      "fusebase.callReadTool",
      "fusebase.callTool",
    ]);
    expect(
      registry
        .get("nimbus-note")
        ?.approvalProfiles.map((profile) => profile.id),
    ).toEqual(
      expect.arrayContaining(["fusebase_safe", "dangerously_skip_permissions"]),
    );
  });

  it("registers Atlassian Rovo as fixed-origin customer-owned MCP", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("atlassian-rovo");
    expect(manifest).toBe(ATLASSIAN_ROVO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("mcp");
    expect(manifest?.auth.credentialSchema.map((field) => field.name)).toEqual([
      "ATLASSIAN_ROVO_SERVICE_ACCOUNT_API_KEY",
    ]);
    expect(
      registry.getTool("atlassian-rovo", "atlassian_rovo_call_read_tool")?.name,
    ).toBe("atlassianRovo.callReadTool");
    expect(
      registry.getTool("atlassian-rovo", "atlassian_rovo_call_tool")
        ?.approvalRequired,
    ).toBe(true);
  });

  it("publishes Atlassian Loom fail-closed without credentials or tools", () => {
    const app = MARKETPLACE_CATALOG.find(
      (candidate) => candidate.slug === "atlassian-loom",
    );
    expect(app?.availability).toBe("unsupported");
    expect(app?.connectionTypes).toEqual(["no_open_account_api"]);
    expect(app?.credentialRequirements).toEqual([]);
    expect(app?.capabilities).toEqual([]);
    expect(
      app?.runtimeSupport.every(
        (item) => item.installSupport === "unsupported",
      ),
    ).toBe(true);
    expect(app?.blockedActions.map((item) => item.id)).toEqual([
      "atlassian_loom_connect_account",
      "atlassian_loom_account_api",
      "atlassian_loom_runtime_actions",
    ]);
  });

  it("registers Opsgenie Cloud as a regional read-only legacy connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("opsgenie-cloud")).toBe(
      OPSGENIE_CLOUD_CONNECTOR_MANIFEST,
    );
    expect(
      OPSGENIE_CLOUD_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["OPSGENIE_API_KEY", "OPSGENIE_REGION"]);
    expect(
      OPSGENIE_CLOUD_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["opsgenieCloud.listAlerts", "opsgenieCloud.getAlert"]);
    expect(
      OPSGENIE_CLOUD_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read",
      ),
    ).toBe(true);
  });

  it("registers Statuspage Cloud with page-bound reads and approved status writes", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("statuspage-cloud")).toBe(
      STATUSPAGE_CLOUD_CONNECTOR_MANIFEST,
    );
    expect(
      STATUSPAGE_CLOUD_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["STATUSPAGE_API_TOKEN", "STATUSPAGE_PAGE_ID"]);
    expect(
      registry.getTool(
        "statuspage-cloud",
        "statuspage_cloud_update_component_status",
      )?.approvalRequired,
    ).toBe(true);
    expect(
      STATUSPAGE_CLOUD_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["statuspage_cloud_safe", "dangerously_skip_permissions"]);
  });

  it("publishes Confluence Questions fail-closed without experimental endpoints", () => {
    const app = MARKETPLACE_CATALOG.find(
      (candidate) => candidate.slug === "confluence-questions",
    );
    expect(app?.availability).toBe("unsupported");
    expect(app?.connectionTypes).toEqual(["no_supported_cloud_api"]);
    expect(app?.credentialRequirements).toEqual([]);
    expect(app?.capabilities).toEqual([]);
    expect(
      app?.runtimeSupport.every(
        (item) => item.installSupport === "unsupported",
      ),
    ).toBe(true);
    expect(app?.blockedActions.map((item) => item.id)).toContain(
      "confluence_questions_use_experimental_api",
    );
  });

  it("registers Mem as a customer-owned full v2 API connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(
      MEM_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name),
    ).toEqual(["MEM_API_KEY"]);
    expect(registry.get("mem")?.tools.map((tool) => tool.name)).toEqual([
      "mem.listNotes",
      "mem.searchNotes",
      "mem.getNote",
      "mem.request",
    ]);
    expect(
      MARKETPLACE_CATALOG.find(
        (app) => app.slug === "mem",
      )?.approvalProfiles.map((profile) => profile.id),
    ).toEqual(
      expect.arrayContaining(["mem_safe", "dangerously_skip_permissions"]),
    );
  });

  it("registers DataForSEO as a Basic Auth native connector with executable tools", () => {
    const registry = new MarketplaceConnectorRegistry();

    expect(registry.get("dataforseo")?.connectorType).toBe("native_clawchat");
    expect(DATAFORSEO_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(DATAFORSEO_CONNECTOR_MANIFEST.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "DATAFORSEO_API_LOGIN",
          secret: true,
          storedIn: "encrypted_secret",
        }),
        expect.objectContaining({
          name: "DATAFORSEO_API_PASSWORD",
          secret: true,
          storedIn: "encrypted_secret",
        }),
      ]),
    );
    expect(
      registry.getTool("dataforseo", "dataforseo_google_organic_serp")?.name,
    ).toBe("dataforseo.googleOrganicSerp");
    expect(registry.getTool("dataforseo", "dataforseo.inspectPage")?.name).toBe(
      "dataforseo.inspectPage",
    );
  });

  it("registers LinkedIn with exactly three connected-member profile/draft/text-post actions", () => {
    const registry = new MarketplaceConnectorRegistry();

    expect(registry.get("linkedin")?.connectorType).toBe("native_clawchat");
    expect(LINKEDIN_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes).toEqual(
      LINKEDIN_SCOPES,
    );
    expect(LINKEDIN_CONNECTOR_MANIFEST.auth.oauth?.optionalScopes).toEqual([]);
    expect(LINKEDIN_CONNECTOR_MANIFEST.auth.oauth?.pkce).toBe(false);
    expect(registry.getTool("linkedin", "linkedin_profile_get")?.name).toBe(
      "linkedin.getProfile",
    );
    expect(
      registry.getTool("linkedin", "linkedin.createTextPost")?.approvalRequired,
    ).toBe(true);
    expect(
      registry.get("linkedin")?.tools.map((tool) => tool.functionName),
    ).toEqual([
      "linkedin_profile_get",
      "linkedin_post_draft",
      "linkedin_text_post_create",
    ]);
  });

  it("starts LinkedIn Relay-owned OAuth with exact scopes and no persisted client secret", async () => {
    const { service, oauthStateRepo } = connectorOAuthHarness({
      LINKEDIN_CLIENT_ID: "relay-linkedin-client",
      LINKEDIN_CLIENT_SECRET: "relay-linkedin-secret",
    });
    const started = await service.startOAuth(
      "workspace_1",
      "user_1",
      "linkedin",
      {
        selectedCapabilities: ["identity", "draft", "publish"],
      },
    );
    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      "https://www.linkedin.com/oauth/v2/authorization",
    );
    expect(url.searchParams.get("scope")).toBe(LINKEDIN_SCOPES.join(" "));
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/linkedin/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.clientId).toBe("relay-linkedin-client");
    expect(state.clientSecretCiphertext).toBeNull();
    expect(state.scopes).toEqual(LINKEDIN_SCOPES);
    expect(JSON.stringify(state)).not.toContain("relay-linkedin-secret");
  });

  it("builds executable descriptors without token material", () => {
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn() } as any,
      {} as any,
      { health: jest.fn() } as any,
      { health: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo(),
      repo(),
    );

    const descriptors = service.buildRuntimeDescriptors({
      workspaceId: "workspace_1",
      appSlug: "outlook",
      connection: outlookConnection(),
      selectedCapabilities: [
        "mail_folders_list",
        "inbox_messages_list",
        "unread_messages_list",
        "message_get",
      ],
    });

    expect(descriptors.map((tool) => tool.functionName)).toEqual(
      expect.arrayContaining([
        "outlook_mail_folders_list",
        "outlook_inbox_messages_list",
        "outlook_unread_messages_list",
        "outlook_message_get",
      ]),
    );
    const serialized = JSON.stringify(descriptors);
    expect(serialized).toContain("clawchat_connector_token_proxy");
    expect(serialized).toContain("secretMaterialSentToHermes");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("refreshToken");
    expect(serialized).not.toContain("clientSecret");
  });

  it("builds only the four bounded Outlook read descriptors", () => {
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn() } as any,
      {} as any,
      { health: jest.fn() } as any,
      { health: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo(),
      repo(),
    );

    const descriptors = service.buildRuntimeDescriptors({
      workspaceId: "workspace_1",
      appSlug: "outlook",
      connection: outlookConnection(),
      selectedCapabilities: [
        "mail_folders_list",
        "inbox_messages_list",
        "unread_messages_list",
        "message_get",
      ],
    });

    expect(descriptors.map((tool) => tool.functionName)).toEqual([
      "outlook_mail_folders_list",
      "outlook_inbox_messages_list",
      "outlook_unread_messages_list",
      "outlook_message_get",
    ]);
  });

  it("builds only the four exact-scope Microsoft Teams metadata descriptors", () => {
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn() } as any,
      {} as any,
      { health: jest.fn() } as any,
      { health: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo(),
      repo(),
    );

    const descriptors = service.buildRuntimeDescriptors({
      workspaceId: "workspace_1",
      appSlug: "microsoft-teams",
      connection: microsoftTeamsConnection(),
      selectedCapabilities: [
        "joined_teams_list",
        "team_get",
        "channels_list",
        "channel_get",
      ],
    });

    expect(descriptors.map((tool) => tool.functionName)).toEqual([
      "microsoft_teams_joined_teams_list",
      "microsoft_teams_team_get",
      "microsoft_teams_channels_list",
      "microsoft_teams_channel_get",
    ]);
  });

  it("does not expose legacy Outlook write descriptors", () => {
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn() } as any,
      {} as any,
      { health: jest.fn() } as any,
      { health: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo(),
      repo(),
    );

    const descriptors = service.buildRuntimeDescriptors({
      workspaceId: "workspace_1",
      appSlug: "outlook",
      connection: outlookConnection({
        metadata: {
          grantedScopes: ["offline_access", "Mail.Read"],
        },
      }),
      selectedCapabilities: ["mail_folders_list", "inbox_messages_list"],
    });

    expect(descriptors.map((tool) => tool.functionName)).toEqual([
      "outlook_mail_folders_list",
      "outlook_inbox_messages_list",
    ]);
  });

  it("builds Exa descriptors without API key material", () => {
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn() } as any,
      {} as any,
      { health: jest.fn() } as any,
      { health: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo(),
      repo(),
    );

    const descriptors = service.buildRuntimeDescriptors({
      workspaceId: "workspace_1",
      appSlug: "exa-search",
      connection: exaConnection(),
      selectedCapabilities: [
        "search",
        "contents",
        "similar",
        "answer",
        "research",
      ],
    });

    expect(descriptors.map((tool) => tool.functionName)).toEqual(
      expect.arrayContaining([
        "exa_search",
        "exa_get_contents",
        "exa_find_similar",
        "exa_answer",
        "exa_research",
      ]),
    );
    const serialized = JSON.stringify(descriptors);
    expect(serialized).toContain("clawchat_connector_token_proxy");
    expect(serialized).toContain("server_side_token_proxy");
    expect(serialized).not.toContain("EXA_API_KEY");
    expect(serialized).not.toContain("exa-test-key");
  });

  it("builds DataForSEO descriptors without credential material", () => {
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn() } as any,
      {} as any,
      { health: jest.fn() } as any,
      { health: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo(),
      repo(),
    );

    const descriptors = service.buildRuntimeDescriptors({
      workspaceId: "workspace_1",
      appSlug: "dataforseo",
      connection: dataforseoConnection(),
      selectedCapabilities: [
        "serp_search",
        "rank_verification",
        "backlink_summary",
        "backlink_lookup",
        "backlink_verification",
        "page_inspection",
      ],
    });

    expect(descriptors.map((tool) => tool.functionName)).toEqual(
      expect.arrayContaining([
        "dataforseo_google_organic_serp",
        "dataforseo_verify_ranking",
        "dataforseo_backlinks_summary",
        "dataforseo_find_backlinks",
        "dataforseo_verify_backlink",
        "dataforseo_inspect_page",
      ]),
    );
    const serialized = JSON.stringify(descriptors);
    expect(serialized).toContain("clawchat_connector_token_proxy");
    expect(serialized).toContain("server_side_token_proxy");
    expect(serialized).not.toContain("DATAFORSEO_API_PASSWORD");
    expect(serialized).not.toContain("dataforseo-password");
  });

  it("builds LinkedIn descriptors without token material", () => {
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn() } as any,
      {} as any,
      { health: jest.fn() } as any,
      { health: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo(),
      repo(),
    );

    const descriptors = service.buildRuntimeDescriptors({
      workspaceId: "workspace_1",
      appSlug: "linkedin",
      connection: linkedInConnection(),
      selectedCapabilities: ["identity", "draft", "publish"],
    });

    expect(descriptors.map((tool) => tool.functionName)).toEqual(
      expect.arrayContaining([
        "linkedin_profile_get",
        "linkedin_post_draft",
        "linkedin_text_post_create",
      ]),
    );
    const serialized = JSON.stringify(descriptors);
    expect(serialized).toContain("clawchat_connector_token_proxy");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("clientSecret");
  });

  it("creates LinkedIn drafts locally without a provider call", async () => {
    const connection = linkedInConnection();
    const linkedInApi = { createTextPost: jest.fn(), getMe: jest.fn() };
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn() } as any,
      {
        getConnectionWithSecrets: jest.fn(async () => connection),
        refreshIfNeeded: jest.fn(async () => ({
          accessToken: "linkedin-token",
        })),
      } as any,
      { health: jest.fn() } as any,
      { health: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo(),
      repo(),
      linkedInApi as any,
    );

    const result = await service.executeTool({
      workspaceId: "workspace_1",
      dispatchId: "dispatch_1",
      agentId: "agent_1",
      userId: null,
      appSlug: "linkedin",
      toolName: "linkedin_post_draft",
      connectionId: connection.id,
      installMetadata: { approvalProfileId: "dangerously_skip_permissions" },
      input: { text: "Post text" },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      text: "Post text",
      characterCount: 9,
      providerCallMade: false,
    });
    expect(linkedInApi.createTextPost).not.toHaveBeenCalled();
  });

  it("returns credential_missing when Exa API key is absent", async () => {
    const connection = exaConnection();
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn(() => ({})) } as any,
      { getConnectionWithSecrets: jest.fn(async () => connection) } as any,
      { search: jest.fn() } as any,
      { health: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo(),
      repo(),
    );

    const result = await service.executeTool({
      workspaceId: "workspace_1",
      dispatchId: "dispatch_1",
      agentId: "agent_1",
      userId: null,
      appSlug: "exa-search",
      toolName: "exa.search",
      connectionId: connection.id,
      input: { query: "site:example.com directories" },
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("credential_missing");
  });

  it("returns credential_missing when DataForSEO credentials are absent", async () => {
    const connection = dataforseoConnection();
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn(() => ({})) } as any,
      { getConnectionWithSecrets: jest.fn(async () => connection) } as any,
      { health: jest.fn() } as any,
      { googleOrganicSerp: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo(),
      repo(),
    );

    const result = await service.executeTool({
      workspaceId: "workspace_1",
      dispatchId: "dispatch_1",
      agentId: "agent_1",
      userId: null,
      appSlug: "dataforseo",
      toolName: "dataforseo.googleOrganicSerp",
      connectionId: connection.id,
      input: { query: "site:example.com" },
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("credential_missing");
  });

  it("checks DataForSEO connection health without exposing credentials", async () => {
    const connection = dataforseoConnection();
    const audit = { record: jest.fn() };
    const health = jest.fn(async () => ({ result: [] }));
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      {
        decrypt: jest.fn(() => ({
          DATAFORSEO_API_LOGIN: "dataforseo-login",
          DATAFORSEO_API_PASSWORD: "dataforseo-password",
        })),
      } as any,
      { getConnectionWithSecrets: jest.fn(async () => connection) } as any,
      { health: jest.fn() } as any,
      { health } as any,
      {} as any,
      audit as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo({ save: jest.fn(async (value) => value) }),
      repo(),
    );

    const result = await service.health(
      "workspace_1",
      "dataforseo",
      connection.id,
    );

    expect(result.status).toBe("ready");
    expect(health).toHaveBeenCalledWith({
      login: "dataforseo-login",
      password: "dataforseo-password",
      baseUrl: null,
    });
    expect(JSON.stringify(result)).not.toContain("dataforseo-password");
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
      "dataforseo-password",
    );
  });

  it("routes generic marketplace dispatches to DataForSEO SERP with redacted audit metadata", async () => {
    const connection = dataforseoConnection();
    const audit = { record: jest.fn() };
    const googleOrganicSerp = jest.fn(async () => ({
      keyword: "rank tracker",
      items: [
        {
          type: "organic",
          rank_absolute: 1,
          url: "https://example.com/rank-tracker",
          domain: "example.com",
          title: "Example Rank Tracker",
          description: "Track rankings.",
        },
      ],
    }));
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      {
        decrypt: jest.fn(() => ({
          DATAFORSEO_API_LOGIN: "dataforseo-login",
          DATAFORSEO_API_PASSWORD: "dataforseo-password",
        })),
      } as any,
      { getConnectionWithSecrets: jest.fn(async () => connection) } as any,
      { health: jest.fn() } as any,
      { googleOrganicSerp } as any,
      {} as any,
      audit as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo({
        findOne: jest.fn(async () => ({
          id: "dispatch_1",
          workspaceId: "workspace_1",
          agentId: "agent_1",
          messageId: "msg_1",
        })),
      }),
      repo({
        findOne: jest.fn(async () => ({ id: "msg_1", senderId: "user_1" })),
      }),
      repo({
        findOne: jest.fn(async () => ({
          connectionId: connection.id,
          selectedCapabilities: ["serp_search"],
          installStatus: "installed",
        })),
      }),
      repo(),
      repo(),
    );

    const result = await service.executeDispatchTool({
      workspaceId: "workspace_1",
      dispatchId: "dispatch_1",
      appSlug: "dataforseo",
      toolName: "dataforseo_google_organic_serp",
      body: {
        arguments: { query: "rank tracker", locale: "en-us", depth: 10 },
      },
    });

    expect(result.ok).toBe(true);
    expect(googleOrganicSerp).toHaveBeenCalledWith(
      {
        login: "dataforseo-login",
        password: "dataforseo-password",
        baseUrl: null,
      },
      { query: "rank tracker", locale: "en-us", depth: 10 },
    );
    expect(JSON.stringify(result)).not.toContain("dataforseo-password");
    const serializedAudit = JSON.stringify(audit.record.mock.calls);
    expect(serializedAudit).toContain("marketplace.dataforseo.serp.executed");
    expect(serializedAudit).toContain("queryHash");
    expect(serializedAudit).not.toContain("rank tracker");
    expect(serializedAudit).not.toContain("dataforseo-password");
  });

  it("routes generic marketplace dispatches to Exa search with redacted audit metadata", async () => {
    const connection = exaConnection();
    const audit = { record: jest.fn() };
    const search = jest.fn(async () => ({
      results: [
        {
          title: "Example",
          url: "https://example.com",
          highlights: ["Directory result"],
          score: 0.9,
        },
      ],
    }));
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn(() => ({ EXA_API_KEY: "exa-test-key" })) } as any,
      { getConnectionWithSecrets: jest.fn(async () => connection) } as any,
      { search } as any,
      { health: jest.fn() } as any,
      {} as any,
      audit as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo({
        findOne: jest.fn(async () => ({
          id: "dispatch_1",
          workspaceId: "workspace_1",
          agentId: "agent_1",
          messageId: "msg_1",
        })),
      }),
      repo({
        findOne: jest.fn(async () => ({ id: "msg_1", senderId: "user_1" })),
      }),
      repo({
        findOne: jest.fn(async () => ({
          connectionId: connection.id,
          selectedCapabilities: ["search"],
          installStatus: "installed",
        })),
      }),
      repo(),
      repo(),
    );

    const result = await service.executeDispatchTool({
      workspaceId: "workspace_1",
      dispatchId: "dispatch_1",
      appSlug: "exa-search",
      toolName: "exa_search",
      body: { arguments: { query: "link prospects", numResults: 3 } },
    });

    expect(result.ok).toBe(true);
    expect(search).toHaveBeenCalledWith("exa-test-key", {
      query: "link prospects",
      numResults: 3,
    });
    const serializedAudit = JSON.stringify(audit.record.mock.calls);
    expect(serializedAudit).toContain("marketplace.exa.search.executed");
    expect(serializedAudit).toContain("queryHash");
    expect(serializedAudit).not.toContain("exa-test-key");
    expect(JSON.stringify(result)).not.toContain("exa-test-key");
  });

  it("requires approval for Exa research", async () => {
    const connection = exaConnection();
    const research = jest.fn();
    const pendingQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => null),
    };
    const approvalRepo = repo({
      createQueryBuilder: jest.fn(() => pendingQuery),
      save: jest.fn(async (value) => ({
        ...value,
        id: "approval-exa-research",
      })),
    });
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn(() => ({ EXA_API_KEY: "exa-test-key" })) } as any,
      { getConnectionWithSecrets: jest.fn(async () => connection) } as any,
      { research } as any,
      { health: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo(),
      approvalRepo,
    );

    const request = {
      workspaceId: "workspace_1",
      dispatchId: "dispatch_1",
      agentId: "agent_1",
      userId: null,
      appSlug: "exa-search",
      toolName: "exa.research",
      connectionId: connection.id,
      input: { query: "competitor landscape" },
    };
    const result = await service.executeTool(request);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("approval_required");
    expect(result.error?.details).toEqual(
      expect.objectContaining({
        approvalId: "approval-exa-research",
        reusedPendingApproval: false,
      }),
    );
    expect(approvalRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedByAgentId: "agent_1",
        workspaceId: "workspace_1",
        metadata: {
          connectorExecution: buildConnectorExecutionApprovalContext(
            request,
            "deep_research",
            "exa-search",
          ),
        },
      }),
    );
    expect(research).not.toHaveBeenCalled();
  });

  it("executes Exa research once with an exact approved context", async () => {
    const connection = exaConnection();
    const research = jest.fn(async () => ({
      researchId: "research-1",
      status: "completed",
      output: "Bounded result",
    }));
    const request = {
      workspaceId: "workspace_1",
      dispatchId: "dispatch_1",
      agentId: "agent_1",
      userId: null,
      appSlug: "exa-search",
      toolName: "exa.research",
      connectionId: connection.id,
      input: {
        approvalId: "approval-exa-research",
        query: "competitor landscape",
      },
    };
    const approval = {
      id: "approval-exa-research",
      workspaceId: "workspace_1",
      status: "approved",
      requestedByAgentId: "agent_1",
      resolvedAt: new Date(),
      resolvedByUserId: "reviewer_1",
      expiresAt: new Date(Date.now() + 60_000),
      metadata: {
        connectorExecution: buildConnectorExecutionApprovalContext(
          request,
          "deep_research",
          "exa-search",
        ),
      },
    };
    const claim = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => ({ affected: 1 })),
    };
    const approvalRepo = repo({
      findOne: jest.fn(async () => approval),
      createQueryBuilder: jest.fn(() => claim),
      update: jest.fn(async () => ({ affected: 1 })),
    });
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      { decrypt: jest.fn(() => ({ EXA_API_KEY: "exa-test-key" })) } as any,
      { getConnectionWithSecrets: jest.fn(async () => connection) } as any,
      { research } as any,
      { health: jest.fn() } as any,
      {} as any,
      { record: jest.fn() } as any,
      { resolveToolRequestsFromConnection: jest.fn() } as any,
      repo(),
      repo(),
      repo(),
      repo(),
      approvalRepo,
    );

    const result = await service.executeTool(request);

    expect(result.ok).toBe(true);
    expect(research).toHaveBeenCalledTimes(1);
    expect(claim.execute).toHaveBeenCalledTimes(1);
    expect(approvalRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "approval-exa-research",
        status: "executing",
      }),
      expect.objectContaining({ status: "executed" }),
    );
  });
});

describe("Aircall connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers exactly two high-risk company reads with the provider-required scope and no PKCE or refresh claim", () => {
    const manifest = new MarketplaceConnectorRegistry().get("aircall");
    expect(manifest).toBe(AIRCALL_CONNECTOR_MANIFEST);
    expect(AIRCALL_SCOPES).toEqual(["public_api"]);
    expect(manifest?.auth.oauth).toMatchObject({
      pkce: false,
      supportsRefresh: false,
    });
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_aircall_get_company",
      "relay_aircall_list_numbers",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "aircall_safe",
      "dangerously_skip_permissions",
    ]);
  });

  it("uses fixed first-page routes and emits only privacy-masked number summaries", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          numbers: [
            {
              id: 9,
              name: "Support",
              digits: "+441234567890",
              country: "gb",
              availability_status: "open",
              users: [{ email: "blocked@example.com" }],
              messages: { welcome: "blocked" },
              live_recording_activated: true,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new AircallApiAdapter().listNumbers("token");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.aircall.io/v1/numbers?page=1&per_page=10",
    );
    expect(result).toEqual({
      numbers: [
        {
          name: "Support",
          phoneNumber: "+••••7890",
          country: "GB",
          availabilityStatus: "open",
        },
      ],
      count: 1,
      truncated: false,
    });
    expect(JSON.stringify(result)).not.toContain("blocked@example.com");
    expect(JSON.stringify(result)).not.toContain("441234567890");
  });

  it("validates exact integration/company binding and enforces safe transport failures", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            integration: {
              id: 11,
              company_id: 22,
              active: true,
              installer: { email: "blocked@example.com" },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            company: { name: "Relay Co", users_count: 4, numbers_count: 2 },
          }),
          { status: 200 },
        ),
      );
    await expect(
      new AircallApiAdapter().getIntegrationBinding("token"),
    ).resolves.toEqual({
      integrationId: "11",
      companyId: "22",
      companyName: "Relay Co",
      usersCount: 4,
      numbersCount: 2,
      active: true,
    });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://api.aircall.io/v1/integrations/me",
      "https://api.aircall.io/v1/company",
    ]);
    await expect(
      new AircallApiAdapter().listNumbers("bad\r\ntoken"),
    ).rejects.toMatchObject<Partial<AircallApiError>>({
      code: "credential_missing",
    });
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await expect(
      new AircallApiAdapter().listNumbers("token"),
    ).rejects.toMatchObject<Partial<AircallApiError>>({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});

describe("Quo (formerly OpenPhone) connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers one customer-key phone-number read with identical Safe and danger authority", () => {
    const manifest = new MarketplaceConnectorRegistry().get("openphone");
    expect(manifest).toBe(OPENPHONE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.oauth).toBeUndefined();
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_openphone_list_phone_numbers",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "openphone_safe",
      "dangerously_skip_permissions",
    ]);
    expect(manifest?.approvalProfiles[0].allowedActions).toEqual(
      manifest?.approvalProfiles[1].allowedActions,
    );
    expect(manifest?.approvalProfiles[0].blockedActions).toEqual(
      manifest?.approvalProfiles[1].blockedActions,
    );
  });

  it("uses the fixed endpoint and raw Authorization value while excluding sensitive adjacent fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "pn_sensitive",
              name: "Support",
              formattedNumber: "+44 1234 567890",
              number: "+441234567890",
              forward: "+441111111111",
              users: [
                {
                  name: "Blocked",
                  email: "blocked@example.com",
                  role: "owner",
                },
              ],
              restrictions: { calling: "blocked" },
              portRequestId: "port_sensitive",
              createdAt: "2026-01-01T00:00:00Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new OpenPhoneApiAdapter().listPhoneNumbers({
      apiKey: "customer-workspace-key",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.openphone.com/v1/phone-numbers",
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "customer-workspace-key",
    );
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).not.toContain("Bearer");
    expect(result).toEqual({
      numbers: [{ name: "Support", phoneNumber: "+••••7890" }],
      count: 1,
      truncated: false,
    });
    expect(JSON.stringify(result)).not.toContain("pn_sensitive");
    expect(JSON.stringify(result)).not.toContain("blocked@example.com");
    expect(JSON.stringify(result)).not.toContain("441234567890");
    expect(JSON.stringify(result)).not.toContain("port_sensitive");
  });

  it("rejects unsafe transport and deletes only Relay's encrypted key on disconnect", async () => {
    await expect(
      new OpenPhoneApiAdapter().listPhoneNumbers({ apiKey: "bad\r\nkey" }),
    ).rejects.toMatchObject<Partial<OpenPhoneApiError>>({
      code: "credential_missing",
    });
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(new Response("not-json", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 429 }));
    const adapter = new OpenPhoneApiAdapter();
    await expect(
      adapter.listPhoneNumbers({ apiKey: "customer-key" }),
    ).rejects.toMatchObject<Partial<OpenPhoneApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      adapter.listPhoneNumbers({ apiKey: "customer-key" }),
    ).rejects.toMatchObject<Partial<OpenPhoneApiError>>({
      code: "provider_rate_limited",
      statusCode: 429,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "openphone-connection",
      workspaceId: "workspace_1",
      appSlug: "openphone",
      displayName: "Quo workspace",
      environment: "default",
      authType: "api_key",
      credentialNames: ["OPENPHONE_API_KEY"],
      selectedCapabilities: ["phone_number_read"],
      status: "ready",
      lastValidatedAt: new Date("2026-07-18T00:00:00.000Z"),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { keyValidated: true },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date("2026-07-18T00:00:00.000Z"),
      updatedAt: new Date("2026-07-18T00:00:00.000Z"),
      secretCiphertext: "encrypted",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
    };
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "openphone",
      "openphone-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        id: "openphone-connection",
        status: "needs_credentials",
        lastErrorCode: "openphone_api_key_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRevocationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.openphone.api_key.disconnected",
        metadata: {
          encryptedCredentialDeleted: true,
          providerRevocationRequired: true,
        },
      }),
    );
  });
});

describe("Twilio connector", () => {
  const credentials = {
    accountSid: `AC${"1".repeat(32)}`,
    apiKeySid: `SK${"2".repeat(32)}`,
    apiKeySecret: "synthetic-restricted-key-secret",
  };
  afterEach(() => jest.restoreAllMocks());

  it("registers one Restricted-key status read with identical Safe and danger authority", () => {
    const manifest = new MarketplaceConnectorRegistry().get("twilio");
    expect(manifest).toBe(TWILIO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.oauth).toBeUndefined();
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_twilio_list_message_statuses",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "twilio_safe",
      "dangerously_skip_permissions",
    ]);
    expect(manifest?.approvalProfiles[0].allowedActions).toEqual(
      manifest?.approvalProfiles[1].allowedActions,
    );
    expect(manifest?.approvalProfiles[0].blockedActions).toEqual(
      manifest?.approvalProfiles[1].blockedActions,
    );
  });

  it("uses one fixed Basic-authenticated route and excludes message content and identifiers", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [
            {
              sid: "SMsensitive",
              account_sid: credentials.accountSid,
              messaging_service_sid: "MGsensitive",
              body: "private message body",
              num_media: "1",
              from: "+441234567890",
              to: "+15551234567",
              direction: "outbound-api",
              status: "delivered",
              price: "-0.01",
              error_code: 30003,
              error_message: "private failure",
              uri: "/private",
              date_sent: "2026-07-18T05:00:00Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new TwilioApiAdapter().listMessageStatuses(
      credentials,
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json?PageSize=10&Page=0`,
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from(`${credentials.apiKeySid}:${credentials.apiKeySecret}`).toString("base64")}`,
    );
    expect(result).toEqual({
      messageStatuses: [
        {
          direction: "outbound-api",
          status: "delivered",
          from: "••••7890",
          to: "••••4567",
          date: "2026-07-18T05:00:00.000Z",
        },
      ],
      count: 1,
      truncated: false,
    });
    for (const forbidden of [
      "SMsensitive",
      "MGsensitive",
      "private message body",
      "private failure",
      "441234567890",
      "15551234567",
      "30003",
      "-0.01",
      "/private",
    ])
      expect(JSON.stringify(result)).not.toContain(forbidden);
  });

  it("rejects malformed credentials and deletes only Relay's encrypted key copy", async () => {
    await expect(
      new TwilioApiAdapter().listMessageStatuses({
        ...credentials,
        apiKeySid: "not-a-key-sid",
      }),
    ).rejects.toMatchObject<Partial<TwilioApiError>>({
      code: "credential_missing",
    });
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(new Response("not-json", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 429 }));
    const adapter = new TwilioApiAdapter();
    await expect(
      adapter.listMessageStatuses(credentials),
    ).rejects.toMatchObject<Partial<TwilioApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      adapter.listMessageStatuses(credentials),
    ).rejects.toMatchObject<Partial<TwilioApiError>>({
      code: "provider_rate_limited",
      statusCode: 429,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "twilio-connection",
      workspaceId: "workspace_1",
      appSlug: "twilio",
      displayName: "Twilio account 1111",
      environment: "default",
      authType: "api_key",
      credentialNames: [
        "TWILIO_ACCOUNT_SID",
        "TWILIO_API_KEY_SID",
        "TWILIO_API_KEY_SECRET",
      ],
      selectedCapabilities: ["message_status_read"],
      status: "ready",
      lastValidatedAt: new Date("2026-07-18T00:00:00.000Z"),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { keyValidated: true },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date("2026-07-18T00:00:00.000Z"),
      updatedAt: new Date("2026-07-18T00:00:00.000Z"),
      secretCiphertext: "encrypted",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
    };
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "twilio",
      "twilio-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        id: "twilio-connection",
        status: "needs_credentials",
        lastErrorCode: "twilio_api_key_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRevocationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.twilio.api_key.disconnected",
      }),
    );
  });
});

describe("Vonage connector", () => {
  const credentials = {
    apiKey: "12345678",
    apiSecret: "syntheticSecondary9A",
  };
  afterEach(() => jest.restoreAllMocks());

  it("registers one customer-secret balance read with identical Safe and danger authority", () => {
    const manifest = new MarketplaceConnectorRegistry().get("vonage");
    expect(manifest).toBe(VONAGE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.oauth).toBeUndefined();
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_vonage_get_account_balance",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "vonage_safe",
      "dangerously_skip_permissions",
    ]);
    expect(manifest?.approvalProfiles[0].allowedActions).toEqual(
      manifest?.approvalProfiles[1].allowedActions,
    );
    expect(manifest?.approvalProfiles[0].blockedActions).toEqual(
      manifest?.approvalProfiles[1].blockedActions,
    );
  });

  it("uses one fixed Basic-authenticated balance route and emits only bounded financial state", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          value: 10.281234,
          autoReload: false,
          api_key: "sensitive-key",
          account_id: "sensitive-account",
          request_id: "sensitive-request",
          secret: "sensitive-secret",
          top_up_reference: "sensitive-payment",
        }),
        { status: 200 },
      ),
    );
    const result = await new VonageApiAdapter().getBalance(credentials);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://rest.nexmo.com/account/get-balance",
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString("base64")}`,
    );
    expect(result).toEqual({ balanceEUR: 10.2812, autoReloadEnabled: false });
    for (const forbidden of [
      "sensitive-key",
      "sensitive-account",
      "sensitive-request",
      "sensitive-secret",
      "sensitive-payment",
    ])
      expect(JSON.stringify(result)).not.toContain(forbidden);
  });

  it("rejects malformed credentials and deletes only Relay's encrypted secret copy", async () => {
    await expect(
      new VonageApiAdapter().getBalance({
        ...credentials,
        apiSecret: "short",
      }),
    ).rejects.toMatchObject<Partial<VonageApiError>>({
      code: "credential_missing",
    });
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(new Response("not-json", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 429 }));
    const adapter = new VonageApiAdapter();
    await expect(adapter.getBalance(credentials)).rejects.toMatchObject<
      Partial<VonageApiError>
    >({ code: "provider_validation_error" });
    await expect(adapter.getBalance(credentials)).rejects.toMatchObject<
      Partial<VonageApiError>
    >({ code: "provider_rate_limited", statusCode: 429 });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "vonage-connection",
      workspaceId: "workspace_1",
      appSlug: "vonage",
      displayName: "Vonage API account 5678",
      environment: "default",
      authType: "api_key",
      credentialNames: ["VONAGE_API_KEY", "VONAGE_API_SECRET"],
      selectedCapabilities: ["account_balance_read"],
      status: "ready",
      lastValidatedAt: new Date("2026-07-18T00:00:00.000Z"),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { keyValidated: true },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date("2026-07-18T00:00:00.000Z"),
      updatedAt: new Date("2026-07-18T00:00:00.000Z"),
      secretCiphertext: "encrypted",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
    };
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "vonage",
      "vonage-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        id: "vonage-connection",
        status: "needs_credentials",
        lastErrorCode: "vonage_api_secret_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRevocationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.vonage.api_secret.disconnected",
      }),
    );
  });
});

describe("MessageBird connector", () => {
  const credentials = {
    organizationId: "123e4567-e89b-42d3-a456-426614174000",
    workspaceId: "223e4567-e89b-42d3-a456-426614174000",
    accessKey: "SyntheticBirdAccessKey123456789",
  };
  afterEach(() => jest.restoreAllMocks());

  it("registers one role-bound workspace read with identical Safe and danger authority", () => {
    const manifest = new MarketplaceConnectorRegistry().get("messagebird");
    expect(manifest).toBe(MESSAGEBIRD_CONNECTOR_MANIFEST);
    expect(manifest?.name).toBe("Bird (formerly MessageBird)");
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.oauth).toBeUndefined();
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_messagebird_get_workspace_status",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "messagebird_safe",
      "dangerously_skip_permissions",
    ]);
    expect(manifest?.approvalProfiles[0].allowedActions).toEqual(
      manifest?.approvalProfiles[1].allowedActions,
    );
    expect(manifest?.approvalProfiles[0].blockedActions).toEqual(
      manifest?.approvalProfiles[1].blockedActions,
    );
  });

  it("uses one fixed AccessKey workspace route and emits only lifecycle status", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: credentials.workspaceId,
          organizationId: credentials.organizationId,
          status: "active",
          name: "sensitive-workspace-name",
          description: "sensitive-description",
          configuration: { domain: "sensitive.example" },
          dataPolicy: { regions: ["sensitive-region"] },
        }),
        { status: 200 },
      ),
    );
    const result = await new MessageBirdApiAdapter().getWorkspaceStatus(
      credentials,
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.bird.com/organizations/${credentials.organizationId}/workspaces/${credentials.workspaceId}`,
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `AccessKey ${credentials.accessKey}`,
    );
    expect(result).toEqual({ workspaceStatus: "active" });
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });

  it("rejects malformed bindings and deletes only Relay's encrypted key copy", async () => {
    await expect(
      new MessageBirdApiAdapter().getWorkspaceStatus({
        ...credentials,
        workspaceId: "not-a-uuid",
      }),
    ).rejects.toMatchObject<Partial<MessageBirdApiError>>({
      code: "credential_missing",
    });
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(new Response("not-json", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 429 }));
    const adapter = new MessageBirdApiAdapter();
    await expect(adapter.getWorkspaceStatus(credentials)).rejects.toMatchObject<
      Partial<MessageBirdApiError>
    >({ code: "provider_validation_error" });
    await expect(adapter.getWorkspaceStatus(credentials)).rejects.toMatchObject<
      Partial<MessageBirdApiError>
    >({ code: "provider_rate_limited", statusCode: 429 });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "messagebird-connection",
      workspaceId: "workspace_1",
      appSlug: "messagebird",
      displayName: "Bird workspace 4000",
      environment: "default",
      authType: "api_key",
      credentialNames: [
        "MESSAGEBIRD_ORGANIZATION_ID",
        "MESSAGEBIRD_WORKSPACE_ID",
        "MESSAGEBIRD_ACCESS_KEY",
      ],
      selectedCapabilities: ["workspace_status_read"],
      status: "ready",
      lastValidatedAt: new Date("2026-07-18T00:00:00.000Z"),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { accessKeyValidated: true },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date("2026-07-18T00:00:00.000Z"),
      updatedAt: new Date("2026-07-18T00:00:00.000Z"),
      secretCiphertext: "encrypted",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
    };
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "messagebird",
      "messagebird-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        id: "messagebird-connection",
        status: "needs_credentials",
        lastErrorCode: "messagebird_access_key_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRevocationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.messagebird.access_key.disconnected",
      }),
    );
  });
});

describe("FRED connector", () => {
  const credentials = { apiKey: "abcdefghijklmnopqrstuvwx12345678" };
  afterEach(() => jest.restoreAllMocks());

  it("registers two bounded reads with identical Safe and danger authority", () => {
    const manifest = new MarketplaceConnectorRegistry().get("fred");
    expect(manifest).toBe(FRED_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.auth.oauth).toBeUndefined();
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_fred_search_series",
      "relay_fred_get_series_observations",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "fred_safe",
      "dangerously_skip_permissions",
    ]);
    expect(manifest?.approvalProfiles[0].allowedActions).toEqual(
      manifest?.approvalProfiles[1].allowedActions,
    );
    expect(manifest?.approvalProfiles[0].blockedActions).toEqual(
      manifest?.approvalProfiles[1].blockedActions,
    );
  });

  it("uses only fixed bounded search and observation routes with reduced output", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            seriess: [
              {
                id: "CPIAUCSL",
                title: "Consumer Price Index",
                frequency: "Monthly",
                units: "Index",
                popularity: 95,
                notes: "excluded notes",
                realtime_start: "2026-01-01",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            observations: [
              {
                date: "2026-01-01",
                value: "325.0",
                realtime_start: "2026-01-01",
              },
              { date: "2025-12-01", value: "." },
            ],
          }),
          { status: 200 },
        ),
      );
    const adapter = new FredApiAdapter();
    const search = await adapter.searchSeries(credentials, "consumer prices");
    const observations = await adapter.getSeriesObservations(
      credentials,
      "CPIAUCSL",
      2,
    );
    const searchURL = new URL(String(fetchMock.mock.calls[0][0]));
    expect(`${searchURL.origin}${searchURL.pathname}`).toBe(
      "https://api.stlouisfed.org/fred/series/search",
    );
    expect(Object.fromEntries(searchURL.searchParams)).toEqual({
      api_key: credentials.apiKey,
      search_text: "consumer prices",
      file_type: "json",
      limit: "10",
      order_by: "popularity",
      sort_order: "desc",
    });
    const observationsURL = new URL(String(fetchMock.mock.calls[1][0]));
    expect(`${observationsURL.origin}${observationsURL.pathname}`).toBe(
      "https://api.stlouisfed.org/fred/series/observations",
    );
    expect(Object.fromEntries(observationsURL.searchParams)).toEqual({
      api_key: credentials.apiKey,
      series_id: "CPIAUCSL",
      file_type: "json",
      limit: "2",
      sort_order: "desc",
    });
    expect(search).toEqual({
      query: "consumer prices",
      series: [
        {
          id: "CPIAUCSL",
          title: "Consumer Price Index",
          frequency: "Monthly",
          units: "Index",
          popularity: 95,
        },
      ],
    });
    expect(observations).toEqual({
      seriesId: "CPIAUCSL",
      observations: [
        { date: "2026-01-01", value: "325.0" },
        { date: "2025-12-01", value: null },
      ],
    });
    expect(JSON.stringify({ search, observations })).not.toContain(
      "realtime_start",
    );
    expect(JSON.stringify(search)).not.toContain("excluded notes");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed on invalid inputs, provider errors, and disconnects Relay's key copy", async () => {
    const adapter = new FredApiAdapter();
    await expect(adapter.searchSeries(credentials, "x")).rejects.toMatchObject<
      Partial<FredApiError>
    >({ code: "provider_validation_error" });
    await expect(
      adapter.getSeriesObservations(credentials, "../bad", 10),
    ).rejects.toMatchObject<Partial<FredApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      adapter.getSeriesObservations(credentials, "CPIAUCSL", 26),
    ).rejects.toMatchObject<Partial<FredApiError>>({
      code: "provider_validation_error",
    });
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new FredApiAdapter().searchSeries(credentials, "inflation"),
    ).rejects.toMatchObject<Partial<FredApiError>>({
      code: "provider_rate_limited",
      statusCode: 429,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "fred-connection",
      workspaceId: "workspace_1",
      appSlug: "fred",
      displayName: "FRED API key 5678",
      environment: "default",
      authType: "api_key",
      credentialNames: ["FRED_API_KEY"],
      selectedCapabilities: ["series_search", "series_observations_read"],
      status: "ready",
      lastValidatedAt: new Date("2026-07-18T00:00:00.000Z"),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { apiKeyValidated: true },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date("2026-07-18T00:00:00.000Z"),
      updatedAt: new Date("2026-07-18T00:00:00.000Z"),
      secretCiphertext: "encrypted",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
    };
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "fred",
      "fred-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        id: "fred-connection",
        status: "needs_credentials",
        lastErrorCode: "fred_api_key_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRevocationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.fred.api_key.disconnected",
      }),
    );
  });
});

describe("Apollo GraphQL Studio connector", () => {
  const credentials = {
    apiKey: "service:relay-dedicated-graph-key",
    graphId: "relay-graph",
    variant: "current",
  };
  afterEach(() => jest.restoreAllMocks());

  it("registers only two fixed metadata reads with identical Safe and danger authority", () => {
    const manifest = new MarketplaceConnectorRegistry().get(
      "apollo-graphql-studio",
    );
    expect(manifest).toBe(APOLLO_GRAPHQL_STUDIO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_apollo_graphos_get_graph_artifact",
      "relay_apollo_graphos_get_launch_status",
    ]);
    expect(manifest?.approvalProfiles[0].allowedActions).toEqual(
      manifest?.approvalProfiles[1].allowedActions,
    );
    expect(manifest?.approvalProfiles[0].blockedActions).toEqual(
      manifest?.approvalProfiles[1].blockedActions,
    );
  });

  it("uses only fixed GraphOS documents and reduces artifact and launch output", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              graphArtifactTagLocation: {
                repository: "relay-graph",
                tag: "current",
                extra: "excluded",
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              graphArtifactByTag: {
                location: {
                  digest: "sha256:abc",
                  uri: "oci://registry.example/relay@sha256:abc",
                  extra: "excluded",
                },
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              graph: {
                variant: { launch: { status: "COMPLETED", extra: "excluded" } },
              },
            },
          }),
          { status: 200 },
        ),
      );
    const adapter = new ApolloGraphOsApiAdapter();
    const artifact = await adapter.getGraphArtifact(credentials);
    const launch = await adapter.getLaunchStatus(credentials, "launch_123");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toBe("https://api.apollographql.com/graphql");
      expect(call[1]).toEqual(
        expect.objectContaining({
          method: "POST",
          redirect: "error",
          cache: "no-store",
          headers: expect.objectContaining({ "x-api-key": credentials.apiKey }),
        }),
      );
      const init = call[1] as RequestInit;
      const body = JSON.parse(String(init.body));
      expect(body).toEqual({
        query: expect.any(String),
        variables: expect.any(Object),
      });
      expect(body.query).not.toMatch(/mutation|__schema|__type/i);
    }
    expect(artifact).toEqual({
      graphId: "relay-graph",
      variant: "current",
      repository: "relay-graph",
      tag: "current",
      digest: "sha256:abc",
      uri: "oci://registry.example/relay@sha256:abc",
    });
    expect(launch).toEqual({
      graphId: "relay-graph",
      variant: "current",
      launchId: "launch_123",
      status: "COMPLETED",
    });
    expect(JSON.stringify({ artifact, launch })).not.toContain("excluded");
  });

  it("fails closed on invalid identifiers and provider errors without retry", async () => {
    const adapter = new ApolloGraphOsApiAdapter();
    await expect(
      adapter.getLaunchStatus(credentials, "../bad"),
    ).rejects.toMatchObject<Partial<ApolloGraphOsApiError>>({
      code: "provider_validation_error",
    });
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue(
        new Response(
          JSON.stringify({ errors: [{ message: "API key is invalid" }] }),
          { status: 200 },
        ),
      );
    await expect(
      new ApolloGraphOsApiAdapter().getLaunchStatus(credentials, "launch_123"),
    ).rejects.toMatchObject<Partial<ApolloGraphOsApiError>>({
      code: "token_expired",
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("disconnects by deleting Relay's encrypted copy and requiring provider revocation", async () => {
    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "apollo-connection",
      workspaceId: "workspace_1",
      appSlug: "apollo-graphql-studio",
      displayName: "relay-graph@current",
      environment: "default",
      authType: "api_key",
      credentialNames: [
        "APOLLO_GRAPHOS_API_KEY",
        "APOLLO_GRAPH_ID",
        "APOLLO_GRAPH_VARIANT",
      ],
      selectedCapabilities: [
        "graph_artifact_metadata_read",
        "launch_status_read",
      ],
      status: "ready",
      lastValidatedAt: new Date("2026-07-18T00:00:00.000Z"),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { graphApiKeyValidated: true },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date("2026-07-18T00:00:00.000Z"),
      updatedAt: new Date("2026-07-18T00:00:00.000Z"),
      secretCiphertext: "encrypted",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
    };
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "apollo-graphql-studio",
      "apollo-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        status: "needs_credentials",
        lastErrorCode: "apollo_graphos_api_key_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRevocationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.apollo_graphos.api_key.disconnected",
      }),
    );
  });
});

describe("Hunter.io connector", () => {
  const credentials = { apiKey: "hunter-dedicated-test-key-123456" };
  afterEach(() => jest.restoreAllMocks());

  it("registers two automatic reads and one Safe-approved credit action", () => {
    const manifest = new MarketplaceConnectorRegistry().get("hunter-io");
    expect(manifest).toBe(HUNTER_IO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_hunter_get_account_usage",
      "relay_hunter_get_domain_email_count",
      "relay_hunter_verify_email",
    ]);
    expect(
      manifest?.approvalProfiles[0].allowedActions.map((action) => action.id),
    ).toEqual(["hunter_account_usage_get", "hunter_domain_email_count_get"]);
    expect(
      manifest?.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual(["hunter_email_verify"]);
    expect(
      manifest?.approvalProfiles[1].allowedActions.map((action) => action.id),
    ).toContain("hunter_email_verify");
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("uses fixed X-API-KEY reads and strips identity, contacts, sources and email", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              first_name: "Excluded",
              last_name: "Person",
              email: "excluded@example.com",
              team_id: 7,
              plan_name: "Growth",
              plan_level: 2,
              reset_date: "2026-08-01",
              requests: {
                credits: { used: 1.5, available: 100 },
                searches: { used: 2, available: 50 },
                verifications: { used: 3, available: 60 },
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              total: 81,
              personal_emails: 65,
              generic_emails: 16,
              department: { executive: 10 },
              seniority: { senior: 5 },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              status: "valid",
              score: 100,
              email: "person@example.com",
              regexp: true,
              gibberish: false,
              disposable: false,
              webmail: false,
              mx_records: true,
              smtp_server: true,
              smtp_check: true,
              accept_all: false,
              block: false,
              sources: [{ uri: "https://source.example" }],
            },
          }),
          { status: 200 },
        ),
      );
    const adapter = new HunterApiAdapter();
    const account = await adapter.getAccountUsage(credentials);
    const counts = await adapter.getDomainEmailCount(
      credentials,
      "Example.COM",
    );
    const verification = await adapter.verifyEmail(
      credentials,
      "Person@Example.com",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://api.hunter.io/v2/account",
      "https://api.hunter.io/v2/email-count?domain=example.com",
      "https://api.hunter.io/v2/email-verifier?email=person%40example.com",
    ]);
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit;
      expect(init).toEqual(
        expect.objectContaining({
          method: "GET",
          redirect: "error",
          cache: "no-store",
          headers: expect.objectContaining({ "X-API-KEY": credentials.apiKey }),
        }),
      );
      expect(String(call[0])).not.toContain(credentials.apiKey);
    }
    expect(account).toEqual({
      planName: "Growth",
      planLevel: 2,
      resetDate: "2026-08-01",
      requests: {
        credits: { used: 1.5, available: 100 },
        searches: { used: 2, available: 50 },
        verifications: { used: 3, available: 60 },
      },
    });
    expect(counts).toEqual({
      domain: "example.com",
      total: 81,
      personalEmails: 65,
      genericEmails: 16,
    });
    expect(verification).toEqual({
      completed: true,
      status: "valid",
      score: 100,
      checks: {
        regexp: true,
        gibberish: false,
        disposable: false,
        webmail: false,
        mxRecords: true,
        smtpServer: true,
        smtpCheck: true,
        acceptAll: false,
        blocked: false,
      },
    });
    expect(JSON.stringify({ account, counts, verification })).not.toMatch(
      /Excluded|excluded@example|team_id|department|seniority|person@example|source\.example/,
    );
  });

  it("fails closed on invalid inputs, privacy denials and pending verification without retry", async () => {
    const adapter = new HunterApiAdapter();
    await expect(
      adapter.getDomainEmailCount(credentials, "../bad"),
    ).rejects.toMatchObject<Partial<HunterApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      adapter.verifyEmail(credentials, "not-an-email"),
    ).rejects.toMatchObject<Partial<HunterApiError>>({
      code: "provider_validation_error",
    });
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: {} }), { status: 202 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [{ id: "claimed_email" }] }), {
          status: 451,
        }),
      );
    await expect(
      new HunterApiAdapter().verifyEmail(credentials, "pending@example.com"),
    ).resolves.toEqual({ completed: false, status: "pending" });
    await expect(
      new HunterApiAdapter().verifyEmail(credentials, "claimed@example.com"),
    ).rejects.toMatchObject<Partial<HunterApiError>>({
      code: "provider_validation_error",
      statusCode: 451,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("disconnects by deleting Relay's encrypted copy and requiring provider key deletion", async () => {
    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "hunter-connection",
      workspaceId: "workspace_1",
      appSlug: "hunter-io",
      displayName: "Hunter API key 3456",
      environment: "default",
      authType: "api_key",
      credentialNames: ["HUNTER_API_KEY"],
      selectedCapabilities: [
        "account_usage_read",
        "domain_email_count_read",
        "email_verification",
      ],
      status: "ready",
      lastValidatedAt: new Date("2026-07-18T00:00:00.000Z"),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { apiKeyValidated: true },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date("2026-07-18T00:00:00.000Z"),
      updatedAt: new Date("2026-07-18T00:00:00.000Z"),
      secretCiphertext: "encrypted",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
    };
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "hunter-io",
      "hunter-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        status: "needs_credentials",
        lastErrorCode: "hunter_api_key_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRevocationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.hunter.api_key.disconnected",
      }),
    );
  });
});

describe("Snov.io connector", () => {
  const credentials = {
    clientId: "synthetic-snov-api-user-1234",
    clientSecret: "synthetic-snov-api-secret-5678",
  };
  const token = (suffix: string) => ({
    access_token: `synthetic-snov-access-token-${suffix}`,
    token_type: "Bearer",
    expires_in: 3600,
  });
  afterEach(() => jest.restoreAllMocks());

  it("registers one Safe-approved start and one automatic task-result read", () => {
    const manifest = new MarketplaceConnectorRegistry().get("snov-io");
    expect(manifest).toBe(SNOV_IO_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_snov_start_email_verification",
      "relay_snov_get_email_verification_result",
    ]);
    expect(
      manifest?.approvalProfiles[0].allowedActions.map((action) => action.id),
    ).toEqual(["snov_email_verification_result_get"]);
    expect(
      manifest?.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual(["snov_email_verification_start"]);
    expect(
      manifest?.approvalProfiles[1].allowedActions.map((action) => action.id),
    ).toEqual([
      "snov_email_verification_start",
      "snov_email_verification_result_get",
    ]);
    expect(manifest?.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("uses fixed client-credential and single-email routes with reduced output", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(token("start")), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { task_hash: "task_hash_start_1234567890" },
            meta: { emails: ["person@example.com"] },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(token("result")), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "completed",
            data: [
              {
                email: "person@example.com",
                result: {
                  smtp_status: "valid",
                  is_valid_format: true,
                  is_disposable: false,
                  is_webmail: false,
                  is_gibberish: false,
                  extra_private_field: "excluded",
                },
              },
            ],
            meta: {
              emails: ["person@example.com"],
              task_hash: "task_hash_start_1234567890",
            },
          }),
          { status: 200 },
        ),
      );
    const adapter = new SnovApiAdapter();
    const started = await adapter.startEmailVerification(
      credentials,
      "Person@Example.com",
    );
    const result = await adapter.getEmailVerificationResult(
      credentials,
      "task_hash_start_1234567890",
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://api.snov.io/v1/oauth/access_token",
      "https://api.snov.io/v2/email-verification/start",
      "https://api.snov.io/v1/oauth/access_token",
      "https://api.snov.io/v2/email-verification/result?task_hash=task_hash_start_1234567890",
    ]);
    const tokenRequest = fetchMock.mock.calls[0][1] as RequestInit;
    expect(tokenRequest.headers).not.toEqual(
      expect.objectContaining({ Authorization: expect.any(String) }),
    );
    expect(String(tokenRequest.body)).toContain(
      "grant_type=client_credentials",
    );
    expect(String(tokenRequest.body)).toContain(
      `client_id=${credentials.clientId}`,
    );
    expect(String(tokenRequest.body)).toContain(
      `client_secret=${credentials.clientSecret}`,
    );
    const startRequest = fetchMock.mock.calls[1][1] as RequestInit;
    expect(startRequest).toEqual(
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer synthetic-snov-access-token-start",
        }),
      }),
    );
    expect(String(startRequest.body)).toBe("emails%5B%5D=person%40example.com");
    expect(String(startRequest.body)).not.toContain("webhook");
    const resultRequest = fetchMock.mock.calls[3][1] as RequestInit;
    expect(resultRequest.method).toBe("GET");
    expect(resultRequest.body).toBeUndefined();
    expect(started).toEqual({
      taskHash: "task_hash_start_1234567890",
      submitted: true,
      maxEmails: 1,
    });
    expect(result).toEqual({
      taskHash: "task_hash_start_1234567890",
      completed: true,
      status: "valid",
      reason: null,
      doNotProcess: false,
      checks: {
        validFormat: true,
        disposable: false,
        webmail: false,
        gibberish: false,
      },
    });
    expect(JSON.stringify({ started, result })).not.toMatch(
      /person@example|extra_private_field|emails/,
    );
  });

  it("fails closed on invalid input and preserves pending and hidden-owner state without retry", async () => {
    const adapter = new SnovApiAdapter();
    await expect(
      adapter.startEmailVerification(credentials, "not-an-email"),
    ).rejects.toMatchObject<Partial<SnovApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      adapter.getEmailVerificationResult(credentials, "../bad"),
    ).rejects.toMatchObject<Partial<SnovApiError>>({
      code: "provider_validation_error",
    });
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(token("pending")), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "in_progress", data: [] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(token("hidden")), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "completed",
            data: [
              {
                email: "claimed@example.com",
                result: {
                  smtp_status: "unknown",
                  unknown_status_reason: "hidden_by_owner",
                  is_valid_format: true,
                  is_disposable: false,
                  is_webmail: false,
                  is_gibberish: false,
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const networkAdapter = new SnovApiAdapter();
    await expect(
      networkAdapter.getEmailVerificationResult(
        credentials,
        "pending_task_hash_1234567890",
      ),
    ).resolves.toEqual({
      taskHash: "pending_task_hash_1234567890",
      completed: false,
    });
    await expect(
      networkAdapter.getEmailVerificationResult(
        credentials,
        "hidden_task_hash_1234567890",
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        completed: true,
        status: "unknown",
        reason: "hidden_by_owner",
        doNotProcess: true,
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("disconnects by deleting Relay credentials and requiring provider rotation", async () => {
    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "snov-connection",
      workspaceId: "workspace_1",
      appSlug: "snov-io",
      displayName: "Snov.io API user 1234",
      environment: "default",
      authType: "api_key",
      credentialNames: ["SNOV_CLIENT_ID", "SNOV_CLIENT_SECRET"],
      selectedCapabilities: [
        "email_verification_start",
        "email_verification_result_read",
      ],
      status: "ready",
      lastValidatedAt: new Date("2026-07-18T00:00:00.000Z"),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { clientCredentialsValidated: true },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date("2026-07-18T00:00:00.000Z"),
      updatedAt: new Date("2026-07-18T00:00:00.000Z"),
      secretCiphertext: "encrypted",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
    };
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "snov-io",
      "snov-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        status: "needs_credentials",
        lastErrorCode: "snov_client_credentials_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRotationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.snov.client_credentials.disconnected",
      }),
    );
  });
});

describe("Lusha connector", () => {
  const credentials = { apiKey: "synthetic-lusha-api-key-1234567890" };
  afterEach(() => jest.restoreAllMocks());

  it("registers exactly one automatic account-governance read in both profiles", () => {
    const manifest = new MarketplaceConnectorRegistry().get("lusha");
    expect(manifest).toBe(LUSHA_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_lusha_get_account_usage",
    ]);
    for (const profile of manifest?.approvalProfiles ?? []) {
      expect(profile.allowedActions.map((action) => action.id)).toEqual([
        "lusha_account_usage_get",
      ]);
      expect(profile.approvalRequiredActions).toEqual([]);
      expect(profile.blockedActions).toHaveLength(3);
    }
  });

  it("uses only the fixed parameterless V3 usage route and returns a bounded governance snapshot", async () => {
    const providerResponse = {
      credits: { total: 10_000, used: 1_500, remaining: 8_500 },
      rateLimits: {
        daily: { limit: 1_000, used: 10, remaining: 990 },
        minute: { limit: 5, used: 1, remaining: 4 },
      },
      plan: {
        category: "professional",
        renewalType: "annual",
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2027-01-01T00:00:00.000Z",
      },
      pricing: {
        api_search: { credits: 1 },
        revealEmail: { credits: 1 },
      },
      contacts: [{ email: "must-not-pass@example.com" }],
    };
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(providerResponse), { status: 200 }),
      );
    const adapter = new LushaApiAdapter();
    await expect(adapter.getAccountUsage(credentials)).resolves.toEqual({
      credits: providerResponse.credits,
      rateLimits: providerResponse.rateLimits,
      plan: providerResponse.plan,
      pricing: providerResponse.pricing,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.lusha.com/v3/account/usage",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers: expect.objectContaining({
          api_key: credentials.apiKey,
        }),
      }),
    );
  });

  it("rejects missing credentials and schema drift without retry", async () => {
    const adapter = new LushaApiAdapter();
    await expect(
      adapter.getAccountUsage({ apiKey: "short" }),
    ).rejects.toMatchObject<Partial<LushaApiError>>({
      code: "credential_missing",
    });
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          credits: { total: 10, used: 1, remaining: 9 },
          rateLimits: { "../unexpected": 5 },
          plan: {
            category: "professional",
            renewalType: "annual",
            startDate: "2026-01-01T00:00:00.000Z",
            endDate: "2027-01-01T00:00:00.000Z",
          },
          pricing: {},
        }),
        { status: 200 },
      ),
    );
    const networkAdapter = new LushaApiAdapter();
    await expect(
      networkAdapter.getAccountUsage(credentials),
    ).rejects.toMatchObject<Partial<LushaApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes Relay's encrypted key copy and requires provider rotation on disconnect", async () => {
    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "lusha-connection",
      workspaceId: "workspace_1",
      appSlug: "lusha",
      displayName: "Lusha professional key 7890",
      environment: "default",
      authType: "api_key",
      credentialNames: ["LUSHA_API_KEY"],
      secretCiphertext: "encrypted-lusha-key",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
      status: "connected",
      lastValidatedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { lushaApiOrigin: "https://api.lusha.com" },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    connectionRepo.save.mockImplementation(async (value: unknown) => value);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "lusha",
      "lusha-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        status: "needs_credentials",
        lastErrorCode: "lusha_api_key_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRotationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.lusha.api_key.disconnected",
      }),
    );
  });
});

describe("LeadIQ connector", () => {
  const credentials = { apiKey: "c3ludGhldGljLWxlYWRpcS1rZXktMTIzNDU2" };
  afterEach(() => jest.restoreAllMocks());

  it("registers exactly one automatic no-credit governance read in both profiles", () => {
    const manifest = new MarketplaceConnectorRegistry().get("leadiq");
    expect(manifest).toBe(LEADIQ_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_leadiq_get_account_usage",
    ]);
    for (const profile of manifest?.approvalProfiles ?? []) {
      expect(profile.allowedActions.map((action) => action.id)).toEqual([
        "leadiq_account_usage_get",
      ]);
      expect(profile.approvalRequiredActions).toEqual([]);
      expect(profile.blockedActions).toHaveLength(3);
    }
  });

  it("uses only the fixed parameterless GraphQL account query and reduces the response", async () => {
    const providerResponse = {
      data: {
        account: {
          plans: [
            {
              name: "Universal Annual",
              product: "Universal",
              status: "Active",
              nextBillingPeriod: "2027-01-01T00:00:00.000Z",
            },
          ],
          dataHubPlan: null,
          universalPlan: {
            name: "Universal Annual",
            product: "Universal",
            status: "Active",
            nextBillingPeriod: "2027-01-01T00:00:00.000Z",
            available: 10_000,
            used: 1_500,
            contacts: [{ email: "must-not-pass@example.com" }],
          },
        },
      },
    };
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(providerResponse), { status: 200 }),
      );
    const adapter = new LeadIqApiAdapter();
    await expect(adapter.getAccountUsage(credentials)).resolves.toEqual({
      plans: providerResponse.data.account.plans,
      dataHubPlan: null,
      universalPlan: {
        name: "Universal Annual",
        product: "Universal",
        status: "Active",
        nextBillingPeriod: "2027-01-01T00:00:00.000Z",
        available: 10_000,
        used: 1_500,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.leadiq.com/graphql",
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init).toEqual(
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Basic ${credentials.apiKey}`,
        }),
      }),
    );
    expect(JSON.parse(String(init.body))).toEqual({
      query:
        "query RelayAccount { account { plans { name product status nextBillingPeriod } dataHubPlan { name product status nextBillingPeriod available used } universalPlan { name product status nextBillingPeriod available used } } }",
    });
  });

  it("rejects missing credentials and GraphQL schema drift without retry", async () => {
    const adapter = new LeadIqApiAdapter();
    await expect(
      adapter.getAccountUsage({ apiKey: "not base64" }),
    ).rejects.toMatchObject<Partial<LeadIqApiError>>({
      code: "credential_missing",
    });
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { account: { plans: "changed" } } }),
          { status: 200 },
        ),
      );
    await expect(
      new LeadIqApiAdapter().getAccountUsage(credentials),
    ).rejects.toMatchObject<Partial<LeadIqApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes Relay's encrypted key copy and requires provider rotation on disconnect", async () => {
    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "leadiq-connection",
      workspaceId: "workspace_1",
      appSlug: "leadiq",
      displayName: "LeadIQ account key NDU2",
      environment: "default",
      authType: "api_key",
      credentialNames: ["LEADIQ_API_KEY"],
      secretCiphertext: "encrypted-leadiq-key",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
      status: "connected",
      lastValidatedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { leadIqApiEndpoint: "https://api.leadiq.com/graphql" },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    connectionRepo.save.mockImplementation(async (value: unknown) => value);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "leadiq",
      "leadiq-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        status: "needs_credentials",
        lastErrorCode: "leadiq_api_key_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRotationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.leadiq.api_key.disconnected",
      }),
    );
  });
});

describe("Seamless.AI connector", () => {
  const credentials = { apiKey: "synthetic-seamless-api-key-1234567890" };
  afterEach(() => jest.restoreAllMocks());

  it("registers exactly one bounded company-only search in both profiles", () => {
    const manifest = new MarketplaceConnectorRegistry().get("seamless-ai");
    expect(manifest).toBe(SEAMLESS_AI_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_seamless_search_companies",
    ]);
    for (const profile of manifest?.approvalProfiles ?? []) {
      expect(profile.allowedActions.map((action) => action.id)).toEqual([
        "seamless_company_search",
      ]);
      expect(profile.approvalRequiredActions).toEqual([]);
      expect(profile.blockedActions).toHaveLength(3);
    }
  });

  it("pins the production endpoint, one filter, five-result cap, and reduced output", async () => {
    const providerResponse = {
      data: [
        {
          searchResultId: "cmp_sr_123",
          name: "Example Company",
          domain: "example.com",
          city: "London",
          state: "England",
          country: "United Kingdom",
          description: "Example company description",
          industries: ["Computer Software"],
          staffCountRange: "51 - 200",
          companyType: "Private",
          stockTicker: null,
          street1: "must not pass",
          annualRevenue: "must not pass",
          technologies: ["must not pass"],
          contacts: [{ email: "must-not-pass@example.com" }],
        },
      ],
      supplementalData: { isMore: true, nextToken: "must-not-pass" },
    };
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(providerResponse), {
        status: 200,
        headers: { "X-PublicAPI-Credits": "42" },
      }),
    );
    const adapter = new SeamlessAiApiAdapter();
    await expect(
      adapter.searchCompanies(credentials, {
        companyDomain: "example.com",
        matchType: "exact",
        limit: 5,
      }),
    ).resolves.toEqual({
      companies: [
        {
          searchResultId: "cmp_sr_123",
          name: "Example Company",
          domain: "example.com",
          city: "London",
          state: "England",
          country: "United Kingdom",
          description: "Example company description",
          industries: ["Computer Software"],
          staffCountRange: "51 - 200",
          companyType: "Private",
          stockTicker: null,
        },
      ],
      resultCount: 1,
      researchCreditsRemaining: 42,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.seamless.ai/api/client/v1/search/companies",
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init).toEqual(
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers: expect.objectContaining({ Token: credentials.apiKey }),
      }),
    );
    expect(JSON.parse(String(init.body))).toEqual({
      limit: 5,
      companyDomain: ["example.com"],
    });
  });

  it("rejects broad input, bad credentials, and schema drift without retry", async () => {
    const adapter = new SeamlessAiApiAdapter();
    await expect(
      adapter.searchCompanies({ apiKey: "short" }, { companyName: "Example" }),
    ).rejects.toMatchObject<Partial<SeamlessAiApiError>>({
      code: "credential_missing",
    });
    await expect(
      adapter.searchCompanies(credentials, {
        companyName: "Example",
        nextToken: "forbidden",
      }),
    ).rejects.toMatchObject<Partial<SeamlessAiApiError>>({
      code: "provider_validation_error",
    });
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: "changed" }), { status: 200 }),
      );
    await expect(
      new SeamlessAiApiAdapter().searchCompanies(credentials, {
        companyName: "Example",
      }),
    ).rejects.toMatchObject<Partial<SeamlessAiApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes Relay's encrypted key copy and requires provider rotation on disconnect", async () => {
    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "seamless-connection",
      workspaceId: "workspace_1",
      appSlug: "seamless-ai",
      displayName: "Seamless.AI key 7890",
      environment: "default",
      authType: "api_key",
      credentialNames: ["SEAMLESS_API_KEY"],
      secretCiphertext: "encrypted-seamless-key",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
      status: "connected",
      lastValidatedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { seamlessAiApiOrigin: "https://api.seamless.ai" },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    connectionRepo.save.mockImplementation(async (value: unknown) => value);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "seamless-ai",
      "seamless-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        status: "needs_credentials",
        lastErrorCode: "seamless_api_key_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRotationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.seamless_ai.api_key.disconnected",
      }),
    );
  });
});

describe("RocketReach connector", () => {
  const credentials = { apiKey: "synthetic-rocketreach-api-key-1234567890" };
  afterEach(() => jest.restoreAllMocks());

  it("registers exactly one automatic account-governance read in both profiles", () => {
    const manifest = new MarketplaceConnectorRegistry().get("rocketreach");
    expect(manifest).toBe(ROCKETREACH_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_rocketreach_get_account_usage",
    ]);
    for (const profile of manifest?.approvalProfiles ?? []) {
      expect(profile.allowedActions.map((action) => action.id)).toEqual([
        "rocketreach_account_usage_get",
      ]);
      expect(profile.approvalRequiredActions).toEqual([]);
      expect(profile.blockedActions).toHaveLength(3);
    }
  });

  it("uses only the fixed Universal account endpoint and strips identity and secrets", async () => {
    const providerResponse = {
      id: 123456,
      first_name: "Must",
      last_name: "Not Pass",
      email: "must-not-pass@example.com",
      state: "registered",
      plan: {
        id: 99,
        name: "Universal Annual",
        lookup_limit: 1000,
        export_limit: 500,
      },
      api_key: "must-not-pass-provider-secret",
      api_key_domain: null,
      daily_api_num_calls: 5,
      daily_api_limit: "1000",
      credit_usage: {
        credits_allocated: 10_000,
        credits_used: 1_500,
        credits_remaining: 8_500,
        last_synced: "2026-07-18T10:00:00Z",
      },
      credit_usage_by_action: [
        {
          credit_action: "PersonSearch",
          attempted_count: 20,
          succeeded_count: 18,
          credits_used: 20,
          last_synced: "2026-07-18T10:00:00Z",
        },
      ],
      rate_limits: [
        {
          action: "PersonSearch",
          duration: "minute",
          limit: 30,
          used: 5,
          remaining: 25,
        },
      ],
    };
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(providerResponse), { status: 200 }),
      );
    const adapter = new RocketReachApiAdapter();
    await expect(adapter.getAccountUsage(credentials)).resolves.toEqual({
      state: "registered",
      plan: {
        name: "Universal Annual",
        lookupLimit: 1000,
        exportLimit: 500,
      },
      dailyApiCalls: 5,
      dailyApiLimit: "1000",
      creditUsage: {
        allocated: 10_000,
        used: 1_500,
        remaining: 8_500,
        lastSynced: "2026-07-18T10:00:00Z",
      },
      creditUsageByAction: [
        {
          action: "PersonSearch",
          attempted: 20,
          succeeded: 18,
          creditsUsed: 20,
          lastSynced: "2026-07-18T10:00:00Z",
        },
      ],
      rateLimits: [
        {
          action: "PersonSearch",
          duration: "minute",
          limit: 30,
          used: 5,
          remaining: 25,
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.rocketreach.co/api/v2/universal/account/",
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers: expect.objectContaining({
          "Api-Key": credentials.apiKey,
        }),
      }),
    );
    expect(init.body).toBeUndefined();
  });

  it("rejects missing credentials and schema drift without retry", async () => {
    const adapter = new RocketReachApiAdapter();
    await expect(
      adapter.getAccountUsage({ apiKey: "not valid key" }),
    ).rejects.toMatchObject<Partial<RocketReachApiError>>({
      code: "credential_missing",
    });
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ state: "registered", plan: "changed" }), {
        status: 200,
      }),
    );
    await expect(
      new RocketReachApiAdapter().getAccountUsage(credentials),
    ).rejects.toMatchObject<Partial<RocketReachApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes Relay's encrypted key copy and requires provider rotation on disconnect", async () => {
    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "rocketreach-connection",
      workspaceId: "workspace_1",
      appSlug: "rocketreach",
      displayName: "RocketReach account key 7890",
      environment: "default",
      authType: "api_key",
      credentialNames: ["ROCKETREACH_API_KEY"],
      secretCiphertext: "encrypted-rocketreach-key",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
      status: "connected",
      lastValidatedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: {
        rocketReachApiEndpoint:
          "https://api.rocketreach.co/api/v2/universal/account/",
      },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    connectionRepo.save.mockImplementation(async (value: unknown) => value);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "rocketreach",
      "rocketreach-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        status: "needs_credentials",
        lastErrorCode: "rocketreach_api_key_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRotationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.rocketreach.api_key.disconnected",
      }),
    );
  });
});

describe("UpLead connector", () => {
  const credentials = { apiKey: "synthetic-uplead-api-key-1234567890" };
  afterEach(() => jest.restoreAllMocks());

  it("registers exactly one automatic credit-balance read in both profiles", () => {
    const manifest = new MarketplaceConnectorRegistry().get("uplead");
    expect(manifest).toBe(UPLEAD_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_uplead_get_credit_balance",
    ]);
    for (const profile of manifest?.approvalProfiles ?? []) {
      expect(profile.allowedActions.map((action) => action.id)).toEqual([
        "uplead_credit_balance_get",
      ]);
      expect(profile.approvalRequiredActions).toEqual([]);
      expect(profile.blockedActions).toHaveLength(3);
    }
  });

  it("uses only the fixed credits endpoint and strips account email", async () => {
    const providerResponse = {
      data: {
        email: "must-not-pass@example.com",
        credits: 100,
        contacts: [{ email: "also-must-not-pass@example.com" }],
      },
      userInfo: { availableCredits: 999 },
    };
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(providerResponse), { status: 200 }),
      );
    const adapter = new UpLeadApiAdapter();
    await expect(adapter.getCreditBalance(credentials)).resolves.toEqual({
      remainingCredits: 100,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.uplead.com/v2/credits",
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: credentials.apiKey,
        }),
      }),
    );
    expect(init.body).toBeUndefined();
  });

  it("rejects missing credentials and schema drift without retry", async () => {
    const adapter = new UpLeadApiAdapter();
    await expect(
      adapter.getCreditBalance({ apiKey: "not valid key" }),
    ).rejects.toMatchObject<Partial<UpLeadApiError>>({
      code: "credential_missing",
    });
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { credits: "100" } }), {
        status: 200,
      }),
    );
    await expect(
      new UpLeadApiAdapter().getCreditBalance(credentials),
    ).rejects.toMatchObject<Partial<UpLeadApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes Relay's encrypted key copy and requires provider rotation on disconnect", async () => {
    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "uplead-connection",
      workspaceId: "workspace_1",
      appSlug: "uplead",
      displayName: "UpLead credit account key 7890",
      environment: "default",
      authType: "api_key",
      credentialNames: ["UPLEAD_API_KEY"],
      secretCiphertext: "encrypted-uplead-key",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
      status: "connected",
      lastValidatedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { upLeadApiEndpoint: "https://api.uplead.com/v2/credits" },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    connectionRepo.save.mockImplementation(async (value: unknown) => value);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "uplead",
      "uplead-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        status: "needs_credentials",
        lastErrorCode: "uplead_api_key_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRotationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.uplead.api_key.disconnected",
      }),
    );
  });
});

describe("Wiza connector", () => {
  const credentials = { apiKey: "synthetic-wiza-api-key-1234567890" };
  afterEach(() => jest.restoreAllMocks());

  it("registers exactly one automatic credit-balances read in both profiles", () => {
    const manifest = new MarketplaceConnectorRegistry().get("wiza");
    expect(manifest).toBe(WIZA_CONNECTOR_MANIFEST);
    expect(manifest?.auth.type).toBe("api_key");
    expect(manifest?.tools.map((tool) => tool.name)).toEqual([
      "relay_wiza_get_credit_balances",
    ]);
    for (const profile of manifest?.approvalProfiles ?? []) {
      expect(profile.allowedActions.map((action) => action.id)).toEqual([
        "wiza_credit_balances_get",
      ]);
      expect(profile.approvalRequiredActions).toEqual([]);
      expect(profile.blockedActions).toHaveLength(3);
    }
  });

  it("uses only the fixed credits endpoint and normalizes documented balances", async () => {
    const providerResponse = {
      credits: {
        email_credits: "unlimited",
        phone_credits: 100,
        export_credits: 0,
        api_credits: 250,
        contacts: [{ email: "must-not-pass@example.com" }],
      },
      assigned_user: { email: "must-not-pass@example.com" },
    };
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(providerResponse), { status: 200 }),
      );
    const adapter = new WizaApiAdapter();
    await expect(adapter.getCreditBalances(credentials)).resolves.toEqual({
      emailCredits: "unlimited",
      phoneCredits: 100,
      exportCredits: 0,
      apiCredits: 250,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://wiza.co/api/meta/credits",
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${credentials.apiKey}`,
        }),
      }),
    );
    expect(init.body).toBeUndefined();
  });

  it("rejects missing credentials and schema drift without retry", async () => {
    const adapter = new WizaApiAdapter();
    await expect(
      adapter.getCreditBalances({ apiKey: "not valid key" }),
    ).rejects.toMatchObject<Partial<WizaApiError>>({
      code: "credential_missing",
    });
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          credits: {
            email_credits: "infinite",
            phone_credits: 1,
            export_credits: 1,
            api_credits: 1,
          },
        }),
        { status: 200 },
      ),
    );
    await expect(
      new WizaApiAdapter().getCreditBalances(credentials),
    ).rejects.toMatchObject<Partial<WizaApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes Relay's encrypted key copy and requires provider rotation on disconnect", async () => {
    const { service, connectionRepo, auditLogService } =
      connectorOAuthHarness();
    const connection = {
      id: "wiza-connection",
      workspaceId: "workspace_1",
      appSlug: "wiza",
      displayName: "Wiza credit account key 7890",
      environment: "default",
      authType: "api_key",
      credentialNames: ["WIZA_API_KEY"],
      secretCiphertext: "encrypted-wiza-key",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
      status: "connected",
      lastValidatedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { wizaApiEndpoint: "https://wiza.co/api/meta/credits" },
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    service.getConnectionWithSecrets = jest.fn(async () => connection);
    connectionRepo.save.mockImplementation(async (value: unknown) => value);
    const disconnected = await service.disconnect(
      "workspace_1",
      "user_1",
      "wiza",
      "wiza-connection",
    );
    expect(disconnected).toEqual(
      expect.objectContaining({
        status: "needs_credentials",
        lastErrorCode: "wiza_api_key_disconnected",
      }),
    );
    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        metadata: expect.objectContaining({ providerRotationRequired: true }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.wiza.api_key.disconnected",
      }),
    );
  });
});

describe("Nextdoor execution approval", () => {
  function serviceWithApproval(approval: Record<string, unknown>) {
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => ({ affected: 1 })),
    };
    const approvalRepo = repo({
      findOne: jest.fn(async () => approval),
      createQueryBuilder: jest.fn(() => queryBuilder),
    });
    const service = new MarketplaceConnectorExecutionService(
      new MarketplaceConnectorRegistry(),
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { record: jest.fn() } as any,
      {} as any,
      repo(),
      repo(),
      repo(),
      repo(),
      approvalRepo,
    );
    return { service, approvalRepo, queryBuilder };
  }

  it("binds exact text, profile connection, agent, expiry, and atomically claims approval", async () => {
    const base = {
      id: "approval-1",
      workspaceId: "workspace-1",
      status: "approved",
      resolvedAt: new Date(),
      resolvedByUserId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
    };
    const initial = serviceWithApproval(base);
    const textHash = (initial.service as any).hash("Hello neighbours");
    const approval = {
      ...base,
      metadata: {
        provider: "nextdoor",
        action: "nextdoor_text_post_publish",
        connectionId: "connection-1",
        requestingAgentId: "agent-1",
        exactText: "Hello neighbours",
        textHash,
      },
    };
    const { service, queryBuilder } = serviceWithApproval(approval);
    const result = await (service as any).requireNextdoorPublishApproval(
      {
        workspaceId: "workspace-1",
        connectionId: "connection-1",
        agentId: "agent-1",
        input: { approvalId: "approval-1" },
        installMetadata: { approvalProfileId: "nextdoor_safe" },
      },
      { id: "connection-1" },
      "Hello neighbours",
    );

    expect(result).toBe(approval);
    expect(approval.status).toBe("executing");
    expect(queryBuilder.execute).toHaveBeenCalledTimes(1);

    approval.status = "approved";
    approval.metadata.exactText = "Different text";
    await expect(
      (service as any).requireNextdoorPublishApproval(
        {
          workspaceId: "workspace-1",
          connectionId: "connection-1",
          agentId: "agent-1",
          input: { approvalId: "approval-1" },
          installMetadata: { approvalProfileId: "nextdoor_safe" },
        },
        { id: "connection-1" },
        "Hello neighbours",
      ),
    ).rejects.toThrow("payload does not match");
  });
});

describe("NextdoorApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("lists only bounded own posts for the exact server-bound profile", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () =>
        new TextEncoder().encode(
          JSON.stringify({
            posts: [
              {
                guid: "s1",
                body_text: "First",
                share_link: "https://nextdoor.com/p/s1",
              },
              {
                share_id: "s2",
                body_text: "Second",
                share_url: "http://unsafe.example/s2",
              },
            ],
          }),
        ).buffer,
    } as any);

    const posts = await new NextdoorApiAdapter().listOwnPosts(
      "access-token",
      "secure-profile-id",
      1,
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nextdoor.com/external/api/partner/v1/post/?secure_profile_id=secure-profile-id",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
    expect(posts).toEqual([
      expect.objectContaining({
        postId: "s1",
        bodyExcerpt: "First",
        shareUrl: "https://nextdoor.com/p/s1",
      }),
    ]);
  });

  it("publishes only body_text and the server-bound secure profile id", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () =>
        new TextEncoder().encode(
          JSON.stringify({ guid: "s1", body_text: "Hello" }),
        ).buffer,
    } as any);

    const result = await new NextdoorApiAdapter().createTextPost(
      "access-token",
      "secure-profile-id",
      "Hello",
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nextdoor.com/external/api/partner/v1/post/create/",
    );
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body)).toEqual({
      secure_profile_id: "secure-profile-id",
      body_text: "Hello",
    });
    expect(result).toEqual(
      expect.objectContaining({ postId: "s1", bodyExcerpt: "Hello" }),
    );
  });

  it("normalizes local drafts and rejects oversized provider responses", async () => {
    const adapter = new NextdoorApiAdapter();
    expect(adapter.prepareTextPost("  Cafe\u0301 update  ")).toEqual({
      text: "Café update",
      byteCount: 12,
      providerSideEffect: false,
    });
    jest.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": String(512 * 1024 + 1) }),
      arrayBuffer: jest.fn(),
    } as any);
    await expect(adapter.listOwnPosts("token", "profile", 10)).rejects.toEqual(
      expect.objectContaining<Partial<NextdoorApiError>>({
        code: "provider_validation_error",
        message: "Nextdoor response exceeded the allowed size",
      }),
    );
  });

  it("maps provider failures to bounded safe errors", async () => {
    jest.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers(),
      arrayBuffer: async () =>
        new TextEncoder().encode("provider detail that must not escape").buffer,
    } as any);

    await expect(
      new NextdoorApiAdapter().listOwnPosts("token", "profile", 10),
    ).rejects.toEqual(
      expect.objectContaining<Partial<NextdoorApiError>>({
        code: "provider_rate_limited",
        message: "Nextdoor request failed with 429",
        statusCode: 429,
      }),
    );
  });
});

describe("MeetupApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("executes only the fixed event query with one validated event id", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () =>
        new TextEncoder().encode(
          JSON.stringify({
            data: {
              event: {
                id: "evt_123",
                title: "Compiler Club",
                description: "Monthly meetup",
                dateTime: "2026-07-20T18:00:00Z",
                eventUrl:
                  "https://www.meetup.com/compiler-club/events/evt_123/",
              },
            },
          }),
        ).buffer,
    } as any);

    const event = await new MeetupApiAdapter().getEvent(
      "access-token",
      "evt_123",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.meetup.com/gql-ext");
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body)).toEqual({
      query:
        "query RelayMeetupEvent($eventId: ID!) { event(id: $eventId) { id title description dateTime eventUrl } }",
      variables: { eventId: "evt_123" },
    });
    expect(event).toEqual({
      eventId: "evt_123",
      title: "Compiler Club",
      description: "Monthly meetup",
      dateTime: "2026-07-20T18:00:00Z",
      eventUrl: "https://www.meetup.com/compiler-club/events/evt_123/",
    });
  });

  it("rejects raw or malformed event identifiers before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any);
    await expect(
      new MeetupApiAdapter().getEvent("token", "evt) { introspection {"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MeetupApiError>>({
        code: "provider_validation_error",
        message: "eventId is invalid",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps GraphQL rate-limit errors without retrying or exposing provider detail", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () =>
        new TextEncoder().encode(
          JSON.stringify({
            errors: [
              {
                message: "sensitive detail",
                extensions: { code: "RATE_LIMITED", reset: 12345 },
              },
            ],
          }),
        ).buffer,
    } as any);
    await expect(
      new MeetupApiAdapter().getEvent("token", "evt_123"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MeetupApiError>>({
        code: "provider_rate_limited",
        message: "Meetup request was rate limited",
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects mismatched events and oversized responses", async () => {
    const adapter = new MeetupApiAdapter();
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        arrayBuffer: async () =>
          new TextEncoder().encode(
            JSON.stringify({
              data: { event: { id: "other", title: "Wrong event" } },
            }),
          ).buffer,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": String(512 * 1024 + 1) }),
        arrayBuffer: jest.fn(),
      } as any);
    await expect(adapter.getEvent("token", "evt_123")).rejects.toEqual(
      expect.objectContaining<Partial<MeetupApiError>>({
        code: "provider_validation_error",
        message: "Meetup returned a different event than requested",
      }),
    );
    await expect(adapter.getEvent("token", "evt_123")).rejects.toEqual(
      expect.objectContaining<Partial<MeetupApiError>>({
        code: "provider_validation_error",
        message: "Meetup response exceeded the allowed size",
      }),
    );
  });
});

describe("EventbriteApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("checks Organization membership before listing at most ten owned Events", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        arrayBuffer: async () =>
          new TextEncoder().encode(
            JSON.stringify({
              organizations: [{ id: "42", name: "Relay Events" }],
              pagination: { has_more_items: true },
            }),
          ).buffer,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        arrayBuffer: async () =>
          new TextEncoder().encode(
            JSON.stringify({
              events: [
                {
                  id: "99",
                  name: {
                    text: "Compiler Night",
                    html: "<b>Compiler Night</b>",
                  },
                  summary: "A useful event",
                  url: "https://www.eventbrite.com/e/99",
                  start: {
                    utc: "2026-07-20T18:00:00Z",
                    local: "2026-07-20T19:00:00",
                    timezone: "Europe/London",
                  },
                  end: {
                    utc: "2026-07-20T20:00:00Z",
                    local: "2026-07-20T21:00:00",
                    timezone: "Europe/London",
                  },
                  status: "live",
                  online_event: false,
                },
              ],
            }),
          ).buffer,
      } as any);
    const events = await new EventbriteApiAdapter().listOrganizationEvents(
      "token",
      "42",
      10,
    );
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://www.eventbriteapi.com/v3/users/me/organizations/",
      "https://www.eventbriteapi.com/v3/organizations/42/events/",
    ]);
    expect(events).toEqual([
      expect.objectContaining({
        eventId: "99",
        name: "Compiler Night",
        summary: "A useful event",
        status: "live",
        onlineEvent: false,
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain("<b>");
  });

  it("uses only the bounded venue expansion for one numeric Event ID", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () =>
        new TextEncoder().encode(
          JSON.stringify({
            id: "99",
            name: { text: "Compiler Night" },
            url: "https://www.eventbrite.com/e/99",
            start: {
              utc: "2026-07-20T18:00:00Z",
              local: "2026-07-20T19:00:00",
              timezone: "Europe/London",
            },
            end: {
              utc: "2026-07-20T20:00:00Z",
              local: "2026-07-20T21:00:00",
              timezone: "Europe/London",
            },
            venue: {
              name: "Town Hall",
              address: {
                address_1: "1 High Street",
                city: "London",
                country: "GB",
              },
            },
          }),
        ).buffer,
    } as any);
    const event = await new EventbriteApiAdapter().getEvent("token", "99");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.eventbriteapi.com/v3/events/99/?expand=venue",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
    expect(event).toEqual(
      expect.objectContaining({
        eventId: "99",
        name: "Compiler Night",
        venue: expect.objectContaining({
          name: "Town Hall",
          city: "London",
          country: "GB",
        }),
      }),
    );
  });

  it("rejects malformed IDs before network access and maps safe rate errors", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any);
    await expect(
      new EventbriteApiAdapter().getEvent("token", "99?expand=attendees"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<EventbriteApiError>>({
        code: "provider_validation_error",
        message: "eventId must be a numeric Eventbrite ID",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers(),
      arrayBuffer: async () =>
        new TextEncoder().encode("private detail").buffer,
    } as any);
    await expect(
      new EventbriteApiAdapter().listOrganizations("token", 10),
    ).rejects.toEqual(
      expect.objectContaining<Partial<EventbriteApiError>>({
        code: "provider_rate_limited",
        message: "Eventbrite request failed with 429",
        statusCode: 429,
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects mismatched Events and oversized responses", async () => {
    const adapter = new EventbriteApiAdapter();
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        arrayBuffer: async () =>
          new TextEncoder().encode(
            JSON.stringify({
              id: "100",
              name: { text: "Wrong Event" },
              url: "https://www.eventbrite.com/e/wrong-event-tickets-100",
            }),
          ).buffer,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": String(512 * 1024 + 1) }),
        arrayBuffer: jest.fn(),
      } as any);
    await expect(adapter.getEvent("token", "99")).rejects.toEqual(
      expect.objectContaining<Partial<EventbriteApiError>>({
        code: "provider_validation_error",
        message: "Eventbrite returned a different Event than requested",
      }),
    );
    await expect(adapter.getEvent("token", "99")).rejects.toEqual(
      expect.objectContaining<Partial<EventbriteApiError>>({
        code: "provider_validation_error",
        message: "Eventbrite response exceeded the allowed size",
      }),
    );
  });
});

describe("LumaApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  const response = (body: unknown, status = 200, headers = new Headers()) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      headers,
      arrayBuffer: async () =>
        new TextEncoder().encode(JSON.stringify(body)).buffer,
    }) as any;

  const event = (overrides: Record<string, unknown> = {}) => ({
    id: "evt-compiler-night",
    calendar_id: "cal-relay",
    platform: "luma",
    access: "manage",
    name: "Compiler Night",
    description: "A useful bounded Event.",
    start_at: "2026-07-20T18:00:00.000Z",
    end_at: "2026-07-20T20:00:00.000Z",
    timezone: "Europe/London",
    url: "https://luma.com/compiler-night",
    visibility: "private",
    location_type: "offline",
    location_visibility: "guests-only",
    geo_address_json: {
      city: "London",
      region: "England",
      country: "United Kingdom",
      full_address: "Secret venue, 1 Private Road",
    },
    meeting_url: "https://meet.example/private",
    hosts: [{ email: "host@example.com" }],
    guest_counts: { approved: { guests: 42 } },
    ...overrides,
  });

  it("binds one API key to an exact user and Calendar without returning private identity fields", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        response({
          id: "usr-relay",
          name: "Relay Host",
          email: "host@example.com",
        }),
      )
      .mockResolvedValueOnce(
        response({
          id: "cal-relay",
          name: "Relay Events",
          url: "https://luma.com/relay-events",
          description: "Technical community events",
          is_personal: false,
          location: {
            city: "London",
            region: "England",
            country: "United Kingdom",
            country_code: "GB",
            timezone: "Europe/London",
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          id: "usr-relay",
          name: "Relay Host",
          email: "host@example.com",
        }),
      );
    const adapter = new LumaApiAdapter();
    const identity = await adapter.health({ apiKey: "calendar-key" });
    const user = await adapter.getUser({
      apiKey: "calendar-key",
      boundUserId: identity.userId,
      boundCalendarId: identity.calendarId,
    });
    expect(identity).toEqual(
      expect.objectContaining({
        userId: "usr-relay",
        calendarId: "cal-relay",
        calendarName: "Relay Events",
        apiOrigin: "https://public-api.luma.com",
      }),
    );
    expect(user).toEqual({
      name: "Relay Host",
      verified: true,
      userBindingVerified: true,
    });
    expect(JSON.stringify(user)).not.toContain("usr-relay");
    expect(JSON.stringify(user)).not.toContain("host@example.com");
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers: expect.objectContaining({
          "x-luma-api-key": "calendar-key",
          "User-Agent": "RelayConsole-Luma/1.0",
        }),
      }),
    );
  });

  it("uses fixed approved/manage-only Event filters and redacts private Event fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValueOnce(
      response({
        entries: [event()],
        has_more: true,
        next_cursor: "secret-cursor",
      }),
    );
    const result = await new LumaApiAdapter().listCalendarEvents(
      {
        apiKey: "calendar-key",
        boundUserId: "usr-relay",
        boundCalendarId: "cal-relay",
      },
      {
        after: "2026-07-01T00:00:00Z",
        before: "2026-08-01T00:00:00Z",
        limit: 10,
      },
    );
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe(
      "https://public-api.luma.com/v1/calendars/events/list",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      after: "2026-07-01T00:00:00Z",
      pagination_limit: "10",
      platforms: "luma",
      access: "manage",
      status: "approved",
      sort_column: "start_at",
      sort_direction: "asc",
      before: "2026-08-01T00:00:00Z",
    });
    expect(result).toEqual({
      events: [
        expect.objectContaining({
          eventId: "evt-compiler-night",
          name: "Compiler Night",
          locationVisibility: "guests-only",
          location: {
            city: "London",
            region: "England",
            country: "United Kingdom",
          },
        }),
      ],
      truncated: true,
    });
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "secret-cursor",
      "Secret venue",
      "meet.example",
      "host@example.com",
      "guest_counts",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("rejects malformed IDs, cross-Calendar Events, oversized responses, and rate limits safely", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any);
    const adapter = new LumaApiAdapter();
    await expect(
      adapter.getEvent(
        {
          apiKey: "calendar-key",
          boundUserId: "usr-relay",
          boundCalendarId: "cal-relay",
        },
        "evt-good?include=guests",
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<LumaApiError>>({
        code: "provider_validation_error",
        message: "eventId must be a Luma evt- identifier",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock
      .mockResolvedValueOnce(response(event({ calendar_id: "cal-other" })))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": String(512 * 1024 + 1) }),
        arrayBuffer: jest.fn(),
      } as any)
      .mockResolvedValueOnce(
        response({ error: "private provider detail" }, 429),
      );
    const credentials = {
      apiKey: "calendar-key",
      boundUserId: "usr-relay",
      boundCalendarId: "cal-relay",
    };
    await expect(
      adapter.getEvent(credentials, "evt-compiler-night"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<LumaApiError>>({
        message: "Luma Calendar binding changed",
      }),
    );
    await expect(
      adapter.getEvent(credentials, "evt-compiler-night"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<LumaApiError>>({
        message: "Luma response exceeded the allowed size",
      }),
    );
    await expect(
      adapter.listCalendarEvents(credentials, {
        after: "2026-07-01T00:00:00Z",
        limit: 10,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<LumaApiError>>({
        code: "provider_rate_limited",
        message: "Luma returned HTTP 429",
      }),
    );
  });
});

describe("HopinApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  const response = (body: unknown, status = 200, headers = new Headers()) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      headers,
      arrayBuffer: async () =>
        new TextEncoder().encode(JSON.stringify(body)).buffer,
    }) as any;
  const eventResource = (
    id = "event-1",
    overrides: Record<string, unknown> = {},
  ) => ({
    id,
    type: "event",
    attributes: {
      id,
      name: "Relay Summit",
      description: "A bounded Event.",
      published: true,
      status: "live",
      timeStart: "2026-08-01T09:00:00Z",
      timeEnd: "2026-08-01T17:00:00Z",
      timezone: "Europe/London",
      type: "virtual",
      venueType: "online",
      slug: "relay-summit",
      metadata: { private: "secret" },
      ...overrides,
    },
  });

  it("binds the current Events API token to one exact Organization without returning email or ID", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue(
      response({
        data: {
          id: "org-relay",
          type: "organization",
          attributes: {
            id: "org-relay",
            name: "Relay Events",
            email: "private@example.com",
            twitter: "private",
          },
        },
      }),
    );
    const adapter = new HopinApiAdapter();
    const identity = await adapter.health({
      accessToken: "customer-token",
      organizationId: "org-relay",
    });
    const organization = await adapter.getOrganization({
      accessToken: "customer-token",
      organizationId: "org-relay",
    });
    expect(identity).toEqual({
      organizationId: "org-relay",
      organizationName: "Relay Events",
      apiOrigin: "https://api.events.ringcentral.com",
    });
    expect(organization).toEqual({
      name: "Relay Events",
      verified: true,
      organizationBindingVerified: true,
    });
    expect(JSON.stringify(organization)).not.toContain("org-relay");
    expect(JSON.stringify(organization)).not.toContain("private@example.com");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.events.ringcentral.com/v1/organizations/org-relay",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer customer-token",
          "User-Agent": "RelayConsole-RingCentral-Events/1.0",
        }),
      }),
    );
  });

  it("uses first-page Organization Event bounds and strips metadata and pagination links", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue(
      response({
        data: [eventResource()],
        meta: { count: 30 },
        links: { next: "https://evil.example/token" },
      }),
    );
    const result = await new HopinApiAdapter().listOrganizationEvents(
      { accessToken: "customer-token", organizationId: "org-relay" },
      10,
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.events.ringcentral.com/v1/organizations/org-relay/events?page=1&perPage=10",
    );
    expect(result).toEqual({
      events: [
        expect.objectContaining({
          eventId: "event-1",
          name: "Relay Summit",
          slug: "relay-summit",
        }),
      ],
      truncated: true,
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("evil.example");
  });

  it("requires first-page Organization membership, redacts Schedule speakers, and maps size/rate errors safely", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any);
    const adapter = new HopinApiAdapter();
    fetchMock.mockResolvedValueOnce(
      response({ data: [eventResource("event-other")], meta: { count: 1 } }),
    );
    await expect(
      adapter.getEvent(
        { accessToken: "customer-token", organizationId: "org-relay" },
        "event-1",
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<HopinApiError>>({
        code: "provider_validation_error",
        message: "Event is not on the bound Organization's first bounded page",
      }),
    );
    fetchMock
      .mockResolvedValueOnce(
        response({ data: [eventResource()], meta: { count: 1 } }),
      )
      .mockResolvedValueOnce(
        response({
          data: [
            {
              id: "schedule-1",
              type: "scheduleItem",
              attributes: {
                id: "schedule-1",
                name: "Opening",
                description: "Welcome",
                area: "stage",
                areaName: "Main Stage",
                timeStart: "2026-08-01T09:00:00Z",
                timeEnd: "2026-08-01T10:00:00Z",
                speakers: [{ email: "speaker@example.com" }],
                backstageUuid: "private-uuid",
              },
            },
          ],
          meta: { count: 1 },
          links: { next: "secret" },
        }),
      );
    const schedule = await adapter.listEventScheduleItems(
      { accessToken: "customer-token", organizationId: "org-relay" },
      "event-1",
      10,
    );
    expect(schedule).toEqual({
      scheduleItems: [
        expect.objectContaining({
          scheduleItemId: "schedule-1",
          name: "Opening",
          areaName: "Main Stage",
        }),
      ],
      truncated: false,
    });
    expect(JSON.stringify(schedule)).not.toContain("speaker@example.com");
    expect(JSON.stringify(schedule)).not.toContain("private-uuid");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": String(512 * 1024 + 1) }),
      arrayBuffer: jest.fn(),
    });
    await expect(
      adapter.health({
        accessToken: "customer-token",
        organizationId: "org-relay",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<HopinApiError>>({
        code: "provider_validation_error",
        message: "RingCentral Events response exceeded the allowed size",
      }),
    );
    fetchMock.mockResolvedValueOnce(response({ errors: [] }, 429));
    await expect(
      adapter.health({
        accessToken: "customer-token",
        organizationId: "org-relay",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<HopinApiError>>({
        code: "provider_rate_limited",
        statusCode: 429,
      }),
    );
  });
});

describe("TwistApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses only fixed bounded workspace, channel, inbox, thread and comment endpoints", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ id: 11, name: "Relay Workspace" }]),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              id: 22,
              workspace_id: 11,
              name: "Engineering",
              description: "Build coordination",
              archived: false,
            },
          ]),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              id: 33,
              workspace_id: 11,
              channel_id: 22,
              title: "Release plan",
              snippet: "Next release",
              creator: 44,
            },
          ]),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            id: 33,
            workspace_id: 11,
            channel_id: 22,
            title: "Release plan",
            content: "Ship safely",
            creator: 44,
          }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              id: 55,
              thread_id: 33,
              content: "Looks good",
              creator: 44,
            },
          ]),
      } as any);
    const adapter = new TwistApiAdapter();
    await expect(adapter.listWorkspaces("token", 20)).resolves.toEqual([
      { workspaceId: "11", name: "Relay Workspace" },
    ]);
    await expect(adapter.listChannels("token", "11", 50)).resolves.toEqual([
      expect.objectContaining({
        channelId: "22",
        workspaceId: "11",
        name: "Engineering",
      }),
    ]);
    await expect(adapter.listInboxThreads("token", "11", 20)).resolves.toEqual([
      expect.objectContaining({
        threadId: "33",
        workspaceId: "11",
        channelId: "22",
      }),
    ]);
    await expect(
      adapter.getThreadWithComments("token", "33", 30),
    ).resolves.toEqual({
      thread: expect.objectContaining({
        threadId: "33",
        title: "Release plan",
      }),
      comments: [expect.objectContaining({ commentId: "55", threadId: "33" })],
      commentCount: 1,
    });
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://api.twist.com/api/v3/workspaces/get",
      "https://api.twist.com/api/v3/channels/get?workspace_id=11",
      "https://api.twist.com/api/v3/inbox/get?workspace_id=11&limit=20&order_by=desc&archive_filter=active",
      "https://api.twist.com/api/v3/threads/getone?id=33",
      "https://api.twist.com/api/v3/comments/get?thread_id=33",
    ]);
    expect(
      fetchMock.mock.calls.every(
        (call) =>
          (call[1] as RequestInit).method === "GET" &&
          (call[1] as RequestInit).redirect === "error",
      ),
    ).toBe(true);
  });

  it("rejects malformed IDs before network access and maps safe rate errors", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any);
    await expect(
      new TwistApiAdapter().getThreadWithComments("token", "33?raw=true", 30),
    ).rejects.toEqual(
      expect.objectContaining<Partial<TwistApiError>>({
        code: "provider_validation_error",
        message: "threadId must be a numeric Twist ID",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "private provider detail",
    } as any);
    await expect(
      new TwistApiAdapter().listWorkspaces("token", 20),
    ).rejects.toEqual(
      expect.objectContaining<Partial<TwistApiError>>({
        code: "provider_rate_limited",
        message: "Twist request failed with 429",
        statusCode: 429,
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ZohoMailApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses only the bound regional account, folder and filtered-message endpoints", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: { code: 200 },
            data: [
              {
                accountId: "81001",
                primaryEmailAddress: "reader@example.eu",
                displayName: "Relay Reader",
                accountStatus: "active",
              },
            ],
          }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: { code: 200 },
            data: [
              {
                folderId: "82001",
                folderName: "Inbox",
                folderPath: "/Inbox",
                folderType: "Inbox",
                unreadCount: 3,
              },
            ],
          }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: { code: 200 },
            data: [
              {
                messageId: "83001",
                folderId: "82001",
                threadId: "84001",
                subject: "Regional readiness",
                summary: "Review readiness",
                sender: "Zoho Teammate",
                fromAddress: "teammate@example.eu",
                toAddress: "&quot;Relay Reader&quot;&lt;reader@example.eu&gt;",
                receivedTime: "1783947600000",
                status: "0",
                hasAttachment: "1",
              },
            ],
          }),
      } as any);
    const adapter = new ZohoMailApiAdapter();
    await expect(
      adapter.listAccounts("token", "https://mail.zoho.eu"),
    ).resolves.toEqual([
      expect.objectContaining({
        accountId: "81001",
        email: "reader@example.eu",
      }),
    ]);
    await expect(
      adapter.listFolders("token", "https://mail.zoho.eu", "81001"),
    ).resolves.toEqual([
      expect.objectContaining({ folderId: "82001", folderName: "Inbox" }),
    ]);
    await expect(
      adapter.listMessages(
        "token",
        "https://mail.zoho.eu",
        "81001",
        "82001",
        25,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        messageId: "83001",
        folderId: "82001",
        threadId: "84001",
        toAddress: '"Relay Reader"<reader@example.eu>',
        hasAttachment: true,
      }),
    ]);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://mail.zoho.eu/api/accounts",
      "https://mail.zoho.eu/api/accounts/81001/folders",
      "https://mail.zoho.eu/api/accounts/81001/messages/view?folderId=82001&limit=25&includeto=true",
    ]);
    expect(
      fetchMock.mock.calls.every((call) => {
        const init = call[1] as RequestInit;
        return (
          init.method === "GET" &&
          init.redirect === "error" &&
          (init.headers as Record<string, string>).Authorization ===
            "Zoho-oauthtoken token"
        );
      }),
    ).toBe(true);
  });

  it("reads one message through three fixed endpoints and sanitizes content without downloading attachments", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: { code: 200 },
            data: {
              messageId: "83001",
              folderId: "82001",
              threadId: "84001",
              subject: "<b>Regional readiness</b>",
              sender: "Zoho Teammate",
              fromAddress: "teammate@example.eu",
              toAddress: "reader@example.eu",
              receivedTime: "1783947600000",
              status: "0",
              hasAttachment: "1",
            },
          }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: { code: 200 },
            data: {
              messageId: "83001",
              content:
                "<style>private-style</style><script>private-script</script><p>Review &amp; approve.</p>",
            },
          }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: { code: 200 },
            data: {
              messageId: "83001",
              attachments: [
                {
                  attachmentId: "85001",
                  attachmentName: "readiness.txt",
                  attachmentSize: 256,
                  binaryContent: "must-not-pass",
                },
              ],
              inline: [{ attachmentId: "86001", cid: "private-inline" }],
            },
          }),
      } as any);
    const result = await new ZohoMailApiAdapter().getMessage(
      "token",
      "https://mail.zoho.eu",
      "81001",
      "82001",
      "83001",
    );
    expect(result).toEqual(
      expect.objectContaining({
        messageId: "83001",
        subject: "Regional readiness",
        contentText: "Review & approve.",
        attachments: [
          {
            attachmentId: "85001",
            attachmentName: "readiness.txt",
            attachmentSize: 256,
          },
        ],
        attachmentCount: 1,
        inlineContentIncluded: false,
        providerRequestCount: 3,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private-script");
    expect(JSON.stringify(result)).not.toContain("private-style");
    expect(JSON.stringify(result)).not.toContain("must-not-pass");
    expect(JSON.stringify(result)).not.toContain("private-inline");
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://mail.zoho.eu/api/accounts/81001/folders/82001/messages/83001/details",
      "https://mail.zoho.eu/api/accounts/81001/folders/82001/messages/83001/content",
      "https://mail.zoho.eu/api/accounts/81001/folders/82001/messages/83001/attachmentinfo?includeInline=false",
    ]);
  });

  it("rejects arbitrary regions and malformed IDs before network access and maps safe rate errors", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any);
    await expect(
      new ZohoMailApiAdapter().listAccounts(
        "token",
        "https://attacker.example",
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ZohoMailApiError>>({
        code: "provider_validation_error",
        message: "Zoho Mail regional origin is not allowlisted",
      }),
    );
    await expect(
      new ZohoMailApiAdapter().listFolders(
        "token",
        "https://mail.zoho.eu",
        "81001?raw=true",
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ZohoMailApiError>>({
        code: "provider_validation_error",
        message: "accountId must be a numeric Zoho Mail ID",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "private provider detail",
    } as any);
    await expect(
      new ZohoMailApiAdapter().listAccounts("token", "https://mail.zoho.eu"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ZohoMailApiError>>({
        code: "provider_rate_limited",
        message: "Zoho Mail request failed with 429",
        statusCode: 429,
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("RingCentralApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses only first-page Simple self-extension call logs and strips sensitive fields", async () => {
    const responseBody = {
      records: [
        {
          id: "call_1",
          sessionId: "session_1",
          startTime: "2026-07-12T20:00:00Z",
          duration: 30,
          direction: "Inbound",
          from: { phoneNumber: "+442079460123", name: "A".repeat(140) },
          to: { phoneNumber: "1001", name: "Relay" },
          recording: { id: "secret" },
          legs: [{ message: "secret" }],
        },
      ],
      navigation: { nextPage: { uri: "never-follow" } },
    };
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue(
        new Response(JSON.stringify(responseBody), { status: 200 }),
      );
    const result = await new RingCentralApiAdapter().listCallLog("token", 7);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/call-log?view=Simple&perPage=7",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
      }),
    );
    expect(result.records[0]).toEqual(
      expect.objectContaining({
        id: "call_1",
        from: { phoneNumber: "+••••0123" },
        to: { phoneNumber: "••••1001" },
      }),
    );
    expect(result.truncated).toBe(true);
    expect(JSON.stringify(result)).not.toContain("recording");
    expect(JSON.stringify(result)).not.toContain("legs");
    expect(JSON.stringify(result)).not.toContain("session_1");
    expect(JSON.stringify(result)).not.toContain("Relay");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("preflights detail against the first ten records and makes at most two requests", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ records: [{ id: "call_1", direction: "Inbound" }] }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "call_1",
            startTime: "2026-07-12T20:00:00Z",
            direction: "Inbound",
            from: { phoneNumber: "+442079460123", name: "Private caller" },
          }),
          { status: 200 },
        ),
      );
    const record = await new RingCentralApiAdapter().getCallLogRecord(
      "token",
      "call_1",
    );
    expect(record).toEqual(
      expect.objectContaining({
        id: "call_1",
        from: { phoneNumber: "+••••0123" },
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/call-log/call_1?view=Simple",
    );
    expect(JSON.stringify(record)).not.toContain("Private caller");
  });

  it("rejects unsafe and out-of-first-ten record IDs before detail access", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any);
    await expect(
      new RingCentralApiAdapter().getCallLogRecord(
        "token",
        "../raw?view=Detailed",
      ),
    ).rejects.toBeInstanceOf(RingCentralApiError);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ records: [{ id: "call_1" }] }), {
        status: 200,
      }),
    );
    await expect(
      new RingCentralApiAdapter().getCallLogRecord("token", "call_2"),
    ).rejects.toMatchObject<Partial<RingCentralApiError>>({
      code: "provider_validation_error",
      statusCode: 403,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enforces response caps and surfaces rate limiting without retry", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValueOnce(
      new Response("{}", {
        status: 200,
        headers: { "content-length": String(512 * 1024 + 1) },
      }),
    );
    await expect(
      new RingCentralApiAdapter().listCallLog("token", 1),
    ).rejects.toMatchObject<Partial<RingCentralApiError>>({
      code: "provider_validation_error",
    });
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await expect(
      new RingCentralApiAdapter().listCallLog("token", 1),
    ).rejects.toMatchObject<Partial<RingCentralApiError>>({
      code: "provider_rate_limited",
      statusCode: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("DialpadApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses only the current own-user Caller ID schema, excludes forwarding numbers and privacy-masks deduplicated results", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 101,
          caller_id: "+442079460123",
          primary_phone: "+442079460123",
          phone_numbers: ["+442079460123", "+442079460456"],
          office_main_line: "+442079460789",
          groups: [{ caller_id: "+442079460999", display_name: "Support" }],
          forwarding_numbers: ["+442079461111"],
        }),
        { status: 200 },
      ),
    );
    const result = await new DialpadApiAdapter().getCallerIds("token");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://dialpad.com/api/v2/users/me/caller_id",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
      }),
    );
    expect(result).toEqual({
      callerIds: [
        {
          label: "Primary phone",
          type: "primary",
          phoneNumber: "+••••0123",
          active: true,
        },
        {
          label: "User phone",
          type: "user",
          phoneNumber: "+••••0456",
          active: false,
        },
        {
          label: "Office main line",
          type: "office",
          phoneNumber: "+••••0789",
          active: false,
        },
        {
          label: "Support",
          type: "group",
          phoneNumber: "+••••0999",
          active: false,
        },
      ],
      count: 4,
      truncated: false,
      activeCallerIdBlocked: false,
    });
    expect(JSON.stringify(result)).not.toContain("+442079460");
    expect(JSON.stringify(result)).not.toContain("1111");
    expect(JSON.stringify(result)).not.toContain('"id"');
  });
  it("reports provider blocked active Caller ID without inventing a choice", async () => {
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue(
        new Response(JSON.stringify({ caller_id: "blocked" }), { status: 200 }),
      );
    await expect(
      new DialpadApiAdapter().getCallerIds("token"),
    ).resolves.toEqual({
      callerIds: [],
      count: 0,
      truncated: false,
      activeCallerIdBlocked: true,
    });
  });
  it("caps Caller ID choices at ten and reports truncation", async () => {
    jest.spyOn(global, "fetch" as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          phone_numbers: Array.from(
            { length: 12 },
            (_, index) => `+44207946${String(index).padStart(4, "0")}`,
          ),
        }),
        { status: 200 },
      ),
    );
    const result = await new DialpadApiAdapter().getCallerIds("token");
    expect(result.callerIds).toHaveLength(10);
    expect(result).toEqual(
      expect.objectContaining({ count: 10, truncated: true }),
    );
  });
  it("rejects malformed successful JSON and invalid access tokens", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue(new Response("not-json", { status: 200 }));
    await expect(
      new DialpadApiAdapter().getCallerIds("token"),
    ).rejects.toMatchObject<Partial<DialpadApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      new DialpadApiAdapter().getCallerIds("bad\r\ntoken"),
    ).rejects.toMatchObject<Partial<DialpadApiError>>({
      code: "credential_missing",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("fails closed when Dialpad returns no useful caller-ID choices", async () => {
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(
      new DialpadApiAdapter().getCallerIds("token"),
    ).rejects.toBeInstanceOf(DialpadApiError);
  });
  it("enforces response caps and surfaces rate limiting without retry", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValueOnce(
      new Response("{}", {
        status: 200,
        headers: { "content-length": String(512 * 1024 + 1) },
      }),
    );
    await expect(
      new DialpadApiAdapter().getCallerIds("token"),
    ).rejects.toMatchObject<Partial<DialpadApiError>>({
      code: "provider_validation_error",
    });
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await expect(
      new DialpadApiAdapter().getCallerIds("token"),
    ).rejects.toMatchObject<Partial<DialpadApiError>>({
      code: "provider_rate_limited",
      statusCode: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("OutlookGraphAdapter", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lists only bounded signed-in Inbox message summaries", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          value: [
            { id: "msg_1", subject: "Plan", body: { content: "blocked" } },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new OutlookGraphAdapter().listInboxMessages("token", {
      maxResults: 5,
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/v1.0/me/mailFolders/inbox/messages");
    expect(url.searchParams.get("$top")).toBe("5");
    expect(url.searchParams.has("$search")).toBe(false);
    expect(result).toMatchObject({
      resultCount: 1,
      selfMailboxOnly: true,
      writesEnabled: false,
      nextPageFollowed: false,
    });
    expect(JSON.stringify(result)).not.toContain("blocked");
  });

  it("gets explicit messages as bounded plain text without attachments", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "msg_1",
          subject: "Plan",
          body: { content: "Text body", contentType: "text" },
          attachments: [{ name: "blocked.pdf" }],
        }),
        { status: 200 },
      ),
    );
    const result = await new OutlookGraphAdapter().getMessage("token", {
      messageId: "msg_1",
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Prefer).toBe(
      'outlook.body-content-type="text"',
    );
    expect(result.message).toMatchObject({
      body: "Text body",
      bodyContentType: "text",
      attachmentsReturned: false,
      htmlReturned: false,
    });
    expect(JSON.stringify(result)).not.toContain("blocked.pdf");
  });

  it("fails closed before Graph for invalid inputs", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any);
    await expect(
      new OutlookGraphAdapter().getMessage("token", {
        messageId: "../other-user",
      }),
    ).rejects.toBeInstanceOf(OutlookGraphError);
    await expect(
      new OutlookGraphAdapter().listRootMailFolders("token", {
        maxResults: 26,
      }),
    ).rejects.toBeInstanceOf(OutlookGraphError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ExaApiAdapter", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("maps search to the Exa search endpoint without exposing the API key in the body", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ results: [] }),
    } as any);

    await new ExaApiAdapter().search("exa-test-key", {
      query: "AI directories",
      type: "fast",
      numResults: 30,
      includeDomains: ["example.com"],
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.exa.ai/search");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(
      "exa-test-key",
    );
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      query: "AI directories",
      type: "fast",
      numResults: 25,
      includeDomains: ["example.com"],
    });
    expect(JSON.stringify(body)).not.toContain("exa-test-key");
  });

  it("maps getContents to the Exa contents endpoint with bounded URL count", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ results: [] }),
    } as any);

    await new ExaApiAdapter().getContents("exa-test-key", {
      urls: Array.from(
        { length: 12 },
        (_, index) => `https://example.com/${index}`,
      ),
      text: true,
      subpages: 20,
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.exa.ai/contents");
    const body = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    );
    expect(body.urls).toHaveLength(10);
    expect(body.subpages).toBe(5);
    expect(body.text).toBe(true);
  });

  it("maps findSimilar to the Exa findSimilar endpoint", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ results: [] }),
    } as any);

    await new ExaApiAdapter().findSimilar("exa-test-key", {
      url: "https://example.com/good-directory",
      numResults: 5,
      excludeDomains: ["spam.example"],
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.exa.ai/findSimilar");
    const body = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    );
    expect(body).toMatchObject({
      url: "https://example.com/good-directory",
      numResults: 5,
      excludeDomains: ["spam.example"],
    });
    expect(body.query).toBeUndefined();
  });

  it("maps answer to the Exa answer endpoint", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ answer: "Answer", citations: [] }),
    } as any);

    await new ExaApiAdapter().answer("exa-test-key", {
      query: "What is Exa?",
      text: true,
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.exa.ai/answer");
    const body = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    );
    expect(body).toEqual({ query: "What is Exa?", text: true });
  });

  it("maps research to Exa deep reasoning search", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ results: [] }),
    } as any);

    await new ExaApiAdapter().research("exa-test-key", {
      instructions: "Research competitors",
      numResults: 15,
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.exa.ai/search");
    const body = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    );
    expect(body.query).toBe("Research competitors");
    expect(body.type).toBe("deep-reasoning");
    expect(body.numResults).toBe(10);
    expect(body.contents).toBeDefined();
  });

  it("maps Exa API failures to safe standard errors", async () => {
    jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ message: "Rate limited" }),
    } as any);

    await expect(
      new ExaApiAdapter().search("exa-test-key", { query: "x" }),
    ).rejects.toMatchObject(
      new ExaApiError("provider_rate_limited", "Rate limited", 429),
    );
  });
});

describe("DataForSeoApiAdapter", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("maps Google organic SERP to DataForSEO live advanced with Basic Auth and clamps depth", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            tasks: [
              {
                status_code: 20000,
                result: [
                  {
                    location_code: 2840,
                    country_iso_code: "US",
                    location_type: "Country",
                  },
                ],
              },
            ],
          }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            tasks: [
              {
                status_code: 20000,
                result: [{ keyword: "rank tracker", items: [] }],
              },
            ],
          }),
      } as any);

    await new DataForSeoApiAdapter().googleOrganicSerp(
      { login: "dataforseo-login", password: "dataforseo-password" },
      {
        query: "rank tracker",
        locale: "en-us",
        depth: 500,
        device: "desktop",
        tag: "test",
      },
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.dataforseo.com/v3/serp/google/locations/us",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
    );
    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("dataforseo-login:dataforseo-password", "utf8").toString("base64")}`,
    );
    const body = JSON.parse(String(init.body));
    expect(body[0]).toMatchObject({
      keyword: "rank tracker",
      language_code: "en",
      location_code: 2840,
      device: "desktop",
      depth: 50,
      tag: "test",
    });
    expect(String(init.body)).not.toContain("dataforseo-password");
  });

  it("maps DataForSEO task errors to safe standard errors", async () => {
    jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          tasks: [
            { status_code: 40203, status_message: "Rate limit exceeded" },
          ],
        }),
    } as any);

    await expect(
      new DataForSeoApiAdapter().health({
        login: "dataforseo-login",
        password: "dataforseo-password",
      }),
    ).rejects.toMatchObject(
      new DataForSeoApiError(
        "provider_rate_limited",
        "DataForSEO Google locations lookup for US failed with 40203: Rate limit exceeded",
        400,
      ),
    );
  });

  it("registers the bounded Kajabi Communities access connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("kajabi-communities");
    expect(manifest).toBe(KAJABI_COMMUNITIES_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "KAJABI_COMMUNITIES_CLIENT_ID",
          secret: false,
        }),
        expect.objectContaining({
          name: "KAJABI_COMMUNITIES_CLIENT_SECRET",
          secret: true,
        }),
      ]),
    );
    expect(
      registry.getTool("kajabi-communities", "kajabi_communities_contact_list")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("kajabi-communities", "kajabi_communities_offer_grant")
        ?.inputSchema.additionalProperties,
    ).toBe(false);
    expect(
      manifest?.approvalProfiles
        .find(({ id }) => id === "dangerously_skip_permissions")
        ?.allowedActions.map(({ id }) => id),
    ).toEqual(
      expect.arrayContaining([
        "kajabi_communities_product_get",
        "kajabi_communities_offer_grant",
        "kajabi_communities_offer_revoke",
      ]),
    );
  });

  it("registers the bounded Circle Admin API v2 connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("circle");
    expect(manifest).toBe(CIRCLE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "CIRCLE_ADMIN_V2_API_TOKEN",
          secret: true,
        }),
      ]),
    );
    expect(
      registry.getTool("circle", "circle_community_get")?.approvalRequired,
    ).toBe(false);
    expect(
      registry.getTool("circle", "circle_member_list")?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("circle", "circle_space_member_add")?.inputSchema
        .additionalProperties,
    ).toBe(false);
    expect(
      manifest?.approvalProfiles
        .find(({ id }) => id === "dangerously_skip_permissions")
        ?.allowedActions.map(({ id }) => id),
    ).toEqual(
      expect.arrayContaining([
        "circle_post_list",
        "circle_member_get",
        "circle_space_member_add",
        "circle_access_group_member_remove",
      ]),
    );
  });

  it("registers the bounded Mighty Networks Admin API connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("mighty-networks");
    expect(manifest).toBe(MIGHTY_NETWORKS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "MIGHTY_NETWORKS_ADMIN_API_TOKEN",
          secret: true,
        }),
        expect.objectContaining({
          name: "MIGHTY_NETWORKS_NETWORK_ID",
          secret: false,
        }),
      ]),
    );
    expect(
      registry.getTool("mighty-networks", "mighty_networks_network_get")
        ?.approvalRequired,
    ).toBe(false);
    expect(
      registry.getTool("mighty-networks", "mighty_networks_member_list")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("mighty-networks", "mighty_networks_space_member_add")
        ?.inputSchema.additionalProperties,
    ).toBe(false);
    expect(
      manifest?.approvalProfiles
        .find(({ id }) => id === "dangerously_skip_permissions")
        ?.allowedActions.map(({ id }) => id),
    ).toEqual(
      expect.arrayContaining([
        "mighty_networks_post_list",
        "mighty_networks_member_get",
        "mighty_networks_space_member_add",
        "mighty_networks_space_member_remove",
      ]),
    );
  });

  it("registers the exact-site bounded Discourse connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("discourse");
    expect(manifest).toBe(DISCOURSE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "DISCOURSE_BASE_URL", secret: false }),
        expect.objectContaining({ name: "DISCOURSE_API_KEY", secret: true }),
        expect.objectContaining({
          name: "DISCOURSE_API_USERNAME",
          secret: false,
        }),
      ]),
    );
    expect(
      registry.getTool("discourse", "discourse_site_get")?.approvalRequired,
    ).toBe(false);
    expect(
      registry.getTool("discourse", "discourse_group_member_list")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("discourse", "discourse_group_member_add")?.inputSchema
        .additionalProperties,
    ).toBe(false);
    expect(
      manifest?.approvalProfiles
        .find(({ id }) => id === "dangerously_skip_permissions")
        ?.allowedActions.map(({ id }) => id),
    ).toEqual(
      expect.arrayContaining([
        "discourse_group_list",
        "discourse_topic_list",
        "discourse_group_member_add",
        "discourse_group_member_remove",
      ]),
    );
  });

  it("registers the exact-site bounded Vanilla Forums connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("vanilla-forums");
    expect(manifest).toBe(VANILLA_FORUMS_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "VANILLA_FORUMS_BASE_URL",
          secret: false,
        }),
        expect.objectContaining({
          name: "VANILLA_FORUMS_ACCESS_TOKEN",
          secret: true,
        }),
      ]),
    );
    expect(
      registry.getTool("vanilla-forums", "vanilla_forums_actor_get")
        ?.approvalRequired,
    ).toBe(false);
    expect(
      registry.getTool("vanilla-forums", "vanilla_forums_discussion_list")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("vanilla-forums", "vanilla_forums_user_list")
        ?.inputSchema.additionalProperties,
    ).toBe(false);
    expect(
      manifest?.approvalProfiles
        .find(({ id }) => id === "dangerously_skip_permissions")
        ?.allowedActions.map(({ id }) => id),
    ).toEqual(
      expect.arrayContaining([
        "vanilla_forums_category_list",
        "vanilla_forums_discussion_list",
        "vanilla_forums_user_list",
      ]),
    );
  });

  it("registers the exact-Network bounded Bettermode connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("bettermode");
    expect(manifest).toBe(BETTERMODE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "BETTERMODE_REGION", secret: false }),
        expect.objectContaining({
          name: "BETTERMODE_NETWORK_ID",
          secret: false,
        }),
        expect.objectContaining({
          name: "BETTERMODE_MEMBER_ID",
          secret: false,
        }),
        expect.objectContaining({
          name: "BETTERMODE_ACCESS_TOKEN",
          secret: true,
        }),
      ]),
    );
    expect(
      registry.getTool("bettermode", "bettermode_network_get")
        ?.approvalRequired,
    ).toBe(false);
    expect(
      registry.getTool("bettermode", "bettermode_member_list")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("bettermode", "bettermode_space_member_add")?.inputSchema
        .additionalProperties,
    ).toBe(false);
    expect(
      manifest?.approvalProfiles
        .find(({ id }) => id === "dangerously_skip_permissions")
        ?.allowedActions.map(({ id }) => id),
    ).toEqual(
      expect.arrayContaining([
        "bettermode_member_list",
        "bettermode_post_list",
        "bettermode_space_member_add",
        "bettermode_space_member_remove",
      ]),
    );
  });

  it("registers the contact-bound bounded Higher Logic connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("higher-logic");
    expect(manifest).toBe(HIGHER_LOGIC_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "HIGHER_LOGIC_REGION", secret: false }),
        expect.objectContaining({
          name: "HIGHER_LOGIC_CONTACT_KEY",
          secret: false,
        }),
        expect.objectContaining({
          name: "HIGHER_LOGIC_IAM_KEY",
          secret: true,
        }),
        expect.objectContaining({
          name: "HIGHER_LOGIC_API_PASSWORD",
          secret: true,
        }),
      ]),
    );
    expect(
      registry.getTool("higher-logic", "higher_logic_actor_get")
        ?.approvalRequired,
    ).toBe(false);
    expect(
      registry.getTool("higher-logic", "higher_logic_discussion_list")
        ?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("higher-logic", "higher_logic_event_list")?.inputSchema
        .additionalProperties,
    ).toBe(false);
    expect(
      manifest?.approvalProfiles
        .find(({ id }) => id === "dangerously_skip_permissions")
        ?.allowedActions.map(({ id }) => id),
    ).toEqual(
      expect.arrayContaining([
        "higher_logic_actor_get",
        "higher_logic_discussion_list",
        "higher_logic_event_list",
      ]),
    );
  });

  it("registers the exact-tenant bounded Hivebrite connector", () => {
    const registry = new MarketplaceConnectorRegistry();
    const manifest = registry.get("hivebrite");
    expect(manifest).toBe(HIVEBRITE_CONNECTOR_MANIFEST);
    expect(manifest?.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "HIVEBRITE_BASE_URL", secret: false }),
        expect.objectContaining({ name: "HIVEBRITE_ADMIN_ID", secret: false }),
        expect.objectContaining({
          name: "HIVEBRITE_ACCESS_TOKEN",
          secret: true,
        }),
      ]),
    );
    expect(
      registry.getTool("hivebrite", "hivebrite_group_list")?.approvalRequired,
    ).toBe(false);
    expect(
      registry.getTool("hivebrite", "hivebrite_event_list")?.approvalRequired,
    ).toBe(true);
    expect(
      registry.getTool("hivebrite", "hivebrite_company_list")?.inputSchema
        .additionalProperties,
    ).toBe(false);
    expect(
      manifest?.approvalProfiles
        .find(({ id }) => id === "dangerously_skip_permissions")
        ?.allowedActions.map(({ id }) => id),
    ).toEqual(
      expect.arrayContaining([
        "hivebrite_admin_get",
        "hivebrite_event_list",
        "hivebrite_company_list",
      ]),
    );
  });
});
