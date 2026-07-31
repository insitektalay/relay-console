import { Injectable } from "@nestjs/common";
import { canonicalMarketplaceProviderSlug } from "../catalog/marketplace-provider-aliases";
import { DATAFORSEO_CONNECTOR_MANIFEST } from "./dataforseo/dataforseo.connector";
import { EXA_CONNECTOR_MANIFEST } from "./exa/exa.connector";
import { LINKEDIN_CONNECTOR_MANIFEST } from "./linkedin/linkedin.connector";
import { OUTLOOK_CONNECTOR_MANIFEST } from "./outlook/outlook.connector";
import { MICROSOFT_TEAMS_CONNECTOR_MANIFEST } from "./microsoft-teams/microsoft-teams.connector";
import { ONEDRIVE_CONNECTOR_MANIFEST } from "./onedrive/onedrive.connector";
import { GOOGLE_VAULT_CONNECTOR_MANIFEST } from "./google-vault/google-vault.connector";
import { GOOGLE_DRIVE_CONNECTOR_MANIFEST } from "./google-drive/google-drive.connector";
import { GOOGLE_DOCS_CONNECTOR_MANIFEST } from "./google-docs/google-docs.connector";
import { GOOGLE_SHEETS_CONNECTOR_MANIFEST } from "./google-sheets/google-sheets.connector";
import { GOOGLE_SLIDES_CONNECTOR_MANIFEST } from "./google-slides/google-slides.connector";
import { GOOGLE_FORMS_CONNECTOR_MANIFEST } from "./google-forms/google-forms.connector";
import { GOOGLE_TASKS_CONNECTOR_MANIFEST } from "./google-tasks/google-tasks.connector";
import { GOOGLE_CONTACTS_CONNECTOR_MANIFEST } from "./google-contacts/google-contacts.connector";
import { GOOGLE_PHOTOS_CONNECTOR_MANIFEST } from "./google-photos/google-photos.connector";
import { GOOGLE_MEET_CONNECTOR_MANIFEST } from "./google-meet/google-meet.connector";
import { GOOGLE_CHAT_CONNECTOR_MANIFEST } from "./google-chat/google-chat.connector";
import { GOOGLE_ADS_CONNECTOR_MANIFEST } from "./google-ads/google-ads.connector";
import { GOOGLE_ANALYTICS_CONNECTOR_MANIFEST } from "./google-analytics/google-analytics.connector";
import { GOOGLE_SEARCH_CONSOLE_CONNECTOR_MANIFEST } from "./google-search-console/google-search-console.connector";
import { GOOGLE_BUSINESS_PROFILE_CONNECTOR_MANIFEST } from "./google-business-profile/google-business-profile.connector";
import { GOOGLE_MERCHANT_CENTER_CONNECTOR_MANIFEST } from "./google-merchant-center/google-merchant-center.connector";
import { YOUTUBE_CONNECTOR_MANIFEST } from "./youtube/youtube.connector";
import { GOOGLE_CLASSROOM_CONNECTOR_MANIFEST } from "./google-classroom/google-classroom.connector";
import { GOOGLE_MAPS_PLATFORM_CONNECTOR_MANIFEST } from "./google-maps-platform/google-maps-platform.connector";
import { THREADS_CONNECTOR_MANIFEST } from "./threads/threads.connector";
import { PINTEREST_CONNECTOR_MANIFEST } from "./pinterest/pinterest.connector";
import { TUMBLR_CONNECTOR_MANIFEST } from "./tumblr/tumblr.connector";
import { MASTODON_CONNECTOR_MANIFEST } from "./mastodon/mastodon.connector";
import { ADOBE_ACROBAT_SIGN_CONNECTOR_MANIFEST } from "./adobe-acrobat-sign/adobe-acrobat-sign.connector";
import { SIGNNOW_CONNECTOR_MANIFEST } from "./signnow/signnow.connector";
import { SIGNREQUEST_CONNECTOR_MANIFEST } from "./signrequest/signrequest.connector";
import { SIGNEASY_CONNECTOR_MANIFEST } from "./signeasy/signeasy.connector";
import { ONESPAN_SIGN_CONNECTOR_MANIFEST } from "./onespan-sign/onespan-sign.connector";
import { RIGHTSIGNATURE_CONNECTOR_MANIFEST } from "./rightsignature/rightsignature.connector";
import { GETACCEPT_CONNECTOR_MANIFEST } from "./getaccept/getaccept.connector";
import { QWILR_CONNECTOR_MANIFEST } from "./qwilr/qwilr.connector";
import { PROPOSIFY_CONNECTOR_MANIFEST } from "./proposify/proposify.connector";
import { BETTER_PROPOSALS_CONNECTOR_MANIFEST } from "./better-proposals/better-proposals.connector";
import { CONCORD_CONNECTOR_MANIFEST } from "./concord/concord.connector";
import { JURO_CONNECTOR_MANIFEST } from "./juro/juro.connector";
import { IRONCLAD_CONNECTOR_MANIFEST } from "./ironclad/ironclad.connector";
import { LINKSQUARES_CONNECTOR_MANIFEST } from "./linksquares/linksquares.connector";
import { SPOTDRAFT_CONNECTOR_MANIFEST } from "./spotdraft/spotdraft.connector";
import { CONTRACTBOOK_CONNECTOR_MANIFEST } from "./contractbook/contractbook.connector";
import { LOGROCKET_CONNECTOR_MANIFEST } from "./logrocket/logrocket.connector";
import { SMARTLOOK_CONNECTOR_MANIFEST } from "./smartlook/smartlook.connector";
import { CRAZY_EGG_CONNECTOR_MANIFEST } from "./crazy-egg/crazy-egg.connector";
import { APPCUES_CONNECTOR_MANIFEST } from "./appcues/appcues.connector";
import { USERFLOW_CONNECTOR_MANIFEST } from "./userflow/userflow.connector";
import { USERPILOT_CONNECTOR_MANIFEST } from "./userpilot/userpilot.connector";
import { CHAMELEON_CONNECTOR_MANIFEST } from "./chameleon/chameleon.connector";
import { VITALLY_CONNECTOR_MANIFEST } from "./vitally/vitally.connector";
import { GAINSIGHT_CONNECTOR_MANIFEST } from "./gainsight/gainsight.connector";
import { TOTANGO_CONNECTOR_MANIFEST } from "./totango/totango.connector";
import { CUSTIFY_CONNECTOR_MANIFEST } from "./custify/custify.connector";
import { PLANHAT_CONNECTOR_MANIFEST } from "./planhat/planhat.connector";
import { CLIENTSUCCESS_CONNECTOR_MANIFEST } from "./clientsuccess/clientsuccess.connector";
import { FRESHSALES_CONNECTOR_MANIFEST } from "./freshsales/freshsales.connector";
import { INSIGHTLY_CONNECTOR_MANIFEST } from "./insightly/insightly.connector";
import { NIMBLE_CONNECTOR_MANIFEST } from "./nimble/nimble.connector";
import { CAPSULE_CRM_CONNECTOR_MANIFEST } from "./capsule-crm/capsule-crm.connector";
import { KEAP_CONNECTOR_MANIFEST } from "./keap/keap.connector";
import type { MarketplaceConnectorManifest } from "./types";
import { BLUESKY_CONNECTOR_MANIFEST } from "./bluesky/bluesky.connector";
import { NEXTDOOR_CONNECTOR_MANIFEST } from "./nextdoor/nextdoor.connector";
import { MEETUP_CONNECTOR_MANIFEST } from "./meetup/meetup.connector";
import { EVENTBRITE_CONNECTOR_MANIFEST } from "./eventbrite/eventbrite.connector";
import { GOLDCAST_CONNECTOR_MANIFEST } from "./goldcast/goldcast.connector";
import { AIRMEET_CONNECTOR_MANIFEST } from "./airmeet/airmeet.connector";
import { SPLASH_CONNECTOR_MANIFEST } from "./splash/splash.connector";
import { CVENT_CONNECTOR_MANIFEST } from "./cvent/cvent.connector";
import { BIZZABO_CONNECTOR_MANIFEST } from "./bizzabo/bizzabo.connector";
import { EVENTZILLA_CONNECTOR_MANIFEST } from "./eventzilla/eventzilla.connector";
import { TICKET_TAILOR_CONNECTOR_MANIFEST } from "./ticket-tailor/ticket-tailor.connector";
import { HUMANITIX_CONNECTOR_MANIFEST } from "./humanitix/humanitix.connector";
import { BUILDIUM_CONNECTOR_MANIFEST } from "./buildium/buildium.connector";
import { SESSIONIZE_CONNECTOR_MANIFEST } from "./sessionize/sessionize.connector";
import { PRETIX_CONNECTOR_MANIFEST } from "./pretix/pretix.connector";
import { DONORBOX_CONNECTOR_MANIFEST } from "./donorbox/donorbox.connector";
import { LUMA_CONNECTOR_MANIFEST } from "./luma/luma.connector";
import { HOPIN_CONNECTOR_MANIFEST } from "./hopin/hopin.connector";
import { WEBEX_CONNECTOR_MANIFEST } from "./webex/webex.connector";
import { GOTO_MEETING_CONNECTOR_MANIFEST } from "./goto-meeting/goto-meeting.connector";
import { RINGCENTRAL_CONNECTOR_MANIFEST } from "./ringcentral/ringcentral.connector";
import { DIALPAD_CONNECTOR_MANIFEST } from "./dialpad/dialpad.connector";
import { AIRCALL_CONNECTOR_MANIFEST } from "./aircall/aircall.connector";
import { OPENPHONE_CONNECTOR_MANIFEST } from "./openphone/openphone.connector";
import { TWILIO_CONNECTOR_MANIFEST } from "./twilio/twilio.connector";
import { VONAGE_CONNECTOR_MANIFEST } from "./vonage/vonage.connector";
import { MESSAGEBIRD_CONNECTOR_MANIFEST } from "./messagebird/messagebird.connector";
import { FRED_CONNECTOR_MANIFEST } from "./fred/fred.connector";
import { APOLLO_GRAPHQL_STUDIO_CONNECTOR_MANIFEST } from "./apollo-graphql-studio/apollo-graphql-studio.connector";
import { HUNTER_IO_CONNECTOR_MANIFEST } from "./hunter-io/hunter-io.connector";
import { SNOV_IO_CONNECTOR_MANIFEST } from "./snov-io/snov-io.connector";
import { LUSHA_CONNECTOR_MANIFEST } from "./lusha/lusha.connector";
import { LEADIQ_CONNECTOR_MANIFEST } from "./leadiq/leadiq.connector";
import { SEAMLESS_AI_CONNECTOR_MANIFEST } from "./seamless-ai/seamless-ai.connector";
import { ROCKETREACH_CONNECTOR_MANIFEST } from "./rocketreach/rocketreach.connector";
import { UPLEAD_CONNECTOR_MANIFEST } from "./uplead/uplead.connector";
import { WIZA_CONNECTOR_MANIFEST } from "./wiza/wiza.connector";
import { LINE_CONNECTOR_MANIFEST } from "./line/line.connector";
import { TWIST_CONNECTOR_MANIFEST } from "./twist/twist.connector";
import { ZOHO_MAIL_CONNECTOR_MANIFEST } from "./zoho-mail/zoho-mail.connector";
import { SLACK_CONNECTOR_MANIFEST } from "./slack/slack.connector";
import { GITHUB_CONNECTOR_MANIFEST } from "./github/github.connector";
import { GITLAB_CONNECTOR_MANIFEST } from "./gitlab/gitlab.connector";
import { BITBUCKET_CONNECTOR_MANIFEST } from "./bitbucket/bitbucket.connector";
import { NOTION_CONNECTOR_MANIFEST } from "./notion/notion.connector";
import { LINEAR_CONNECTOR_MANIFEST } from "./linear/linear.connector";
import { ASANA_CONNECTOR_MANIFEST } from "./asana/asana.connector";
import { TRELLO_CONNECTOR_MANIFEST } from "./trello/trello.connector";
import { CLICKUP_CONNECTOR_MANIFEST } from "./clickup/clickup.connector";
import { MONDAY_COM_CONNECTOR_MANIFEST } from "./monday-com/monday-com.connector";
import { AIRTABLE_CONNECTOR_MANIFEST } from "./airtable/airtable.connector";
import { CODA_CONNECTOR_MANIFEST } from "./coda/coda.connector";
import { CRAFT_CONNECTOR_MANIFEST } from "./craft/craft.connector";
import { TELEGRAM_PERSONAL_BOTS_CONNECTOR_MANIFEST } from "./telegram-personal-bots/telegram-personal-bots.connector";
import { LOCAL_WORDPRESS_ORG_CONNECTOR_MANIFEST } from "./local-wordpress-org/local-wordpress-org.connector";
import { MATOMO_SELF_HOSTED_CONNECTOR_MANIFEST } from "./matomo-self-hosted/matomo-self-hosted.connector";
import { PLAUSIBLE_SELF_HOSTED_CONNECTOR_MANIFEST } from "./plausible-self-hosted/plausible-self-hosted.connector";
import { UMAMI_SELF_HOSTED_CONNECTOR_MANIFEST } from "./umami-self-hosted/umami-self-hosted.connector";
import { GHOST_SELF_HOSTED_CONNECTOR_MANIFEST } from "./ghost-self-hosted/ghost-self-hosted.connector";
import { XRAY_TEST_MANAGEMENT_CONNECTOR_MANIFEST } from "./xray-test-management/xray-test-management.connector";
import { STRUCTURE_FOR_JIRA_CONNECTOR_MANIFEST } from "./structure-for-jira/structure-for-jira.connector";
import { PRODUCTPLAN_CONNECTOR_MANIFEST } from "./productplan/productplan.connector";
import { CRAFT_IO_CONNECTOR_MANIFEST } from "./craft-io/craft-io.connector";
import { AIRFOCUS_CONNECTOR_MANIFEST } from "./airfocus/airfocus.connector";
import { FAVRO_CONNECTOR_MANIFEST } from "./favro/favro.connector";
import { PLANVIEW_AGILEPLACE_CONNECTOR_MANIFEST } from "./planview-agileplace/planview-agileplace.connector";
import { LIQUIDPLANNER_CONNECTOR_MANIFEST } from "./liquidplanner/liquidplanner.connector";
import { WORKFRONT_PLANNING_CONNECTOR_MANIFEST } from "./workfront-planning/workfront-planning.connector";
import { KANTATA_OX_CONNECTOR_MANIFEST } from "./kantata-ox/kantata-ox.connector";
import { ACCELO_CONNECTOR_MANIFEST } from "./accelo/accelo.connector";
import { AVAZA_CONNECTOR_MANIFEST } from "./avaza/avaza.connector";
import { ANYTYPE_CONNECTOR_MANIFEST } from "./anytype/anytype.connector";
import { DROPBOX_CONNECTOR_MANIFEST } from "./dropbox/dropbox.connector";
import { BOX_CONNECTOR_MANIFEST } from "./box/box.connector";
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
import { REFLECT_CONNECTOR_MANIFEST } from "./reflect/reflect.connector";
import { READWISE_CONNECTOR_MANIFEST } from "./readwise/readwise.connector";
import { RAINDROP_IO_CONNECTOR_MANIFEST } from "./raindrop-io/raindrop-io.connector";
import { INSTAPAPER_CONNECTOR_MANIFEST } from "./instapaper/instapaper.connector";
import { FEEDLY_CONNECTOR_MANIFEST } from "./feedly/feedly.connector";
import { INOREADER_CONNECTOR_MANIFEST } from "./inoreader/inoreader.connector";
import { README_CONNECTOR_MANIFEST } from "./readme/readme.connector";
import { GURU_CONNECTOR_MANIFEST } from "./guru/guru.connector";
import { SLITE_CONNECTOR_MANIFEST } from "./slite/slite.connector";
import { SLAB_CONNECTOR_MANIFEST } from "./slab/slab.connector";
import { CONFLUENCE_CONNECTOR_MANIFEST } from "./confluence/confluence.connector";
import { QUIP_CONNECTOR_MANIFEST } from "./quip/quip.connector";
import { NUCLINO_CONNECTOR_MANIFEST } from "./nuclino/nuclino.connector";
import { DOCUMENT360_CONNECTOR_MANIFEST } from "./document360/document360.connector";
import { ARCHBEE_CONNECTOR_MANIFEST } from "./archbee/archbee.connector";
import { TETTRA_CONNECTOR_MANIFEST } from "./tettra/tettra.connector";
import { KNOWLEDGEOWL_CONNECTOR_MANIFEST } from "./knowledgeowl/knowledgeowl.connector";
import { SCRIBE_CONNECTOR_MANIFEST } from "./scribe/scribe.connector";
import { VIDYARD_CONNECTOR_MANIFEST } from "./vidyard/vidyard.connector";
import { VIMEO_CONNECTOR_MANIFEST } from "./vimeo/vimeo.connector";
import { WISTIA_CONNECTOR_MANIFEST } from "./wistia/wistia.connector";
import { FRAME_IO_CONNECTOR_MANIFEST } from "./frame-io/frame-io.connector";
import { DESCRIPT_CONNECTOR_MANIFEST } from "./descript/descript.connector";
import { REV_CONNECTOR_MANIFEST } from "./rev/rev.connector";
import { BUZZSPROUT_CONNECTOR_MANIFEST } from "./buzzsprout/buzzsprout.connector";
import { CAPTIVATE_FM_CONNECTOR_MANIFEST } from "./captivate-fm/captivate-fm.connector";
import { TRANSISTOR_FM_CONNECTOR_MANIFEST } from "./transistor-fm/transistor-fm.connector";
import { RIVERSIDE_FM_CONNECTOR_MANIFEST } from "./riverside-fm/riverside-fm.connector";
import { RESTREAM_CONNECTOR_MANIFEST } from "./restream/restream.connector";
import { COMMON_ROOM_CONNECTOR_MANIFEST } from "./common-room/common-room.connector";
import { SLACK_ENTERPRISE_GRID_CONNECTOR_MANIFEST } from "./slack-enterprise-grid/slack-enterprise-grid.connector";
import { SLACK_CANVAS_CONNECTOR_MANIFEST } from "./slack-canvas/slack-canvas.connector";
import { SLACK_LISTS_CONNECTOR_MANIFEST } from "./slack-lists/slack-lists.connector";
import { TEAMS_PHONE_CONNECTOR_MANIFEST } from "./teams-phone/teams-phone.connector";
import { ZOOM_PHONE_CONNECTOR_MANIFEST } from "./zoom-phone/zoom-phone.connector";
import { ZOOM_ROOMS_CONNECTOR_MANIFEST } from "./zoom-rooms/zoom-rooms.connector";
import { ZOOM_WEBINARS_CONNECTOR_MANIFEST } from "./zoom-webinars/zoom-webinars.connector";
import { ZOOM_EVENTS_CONNECTOR_MANIFEST } from "./zoom-events/zoom-events.connector";
import { WEBEX_CALLING_CONNECTOR_MANIFEST } from "./webex-calling/webex-calling.connector";
import { GOTO_WEBINAR_CONNECTOR_MANIFEST } from "./goto-webinar/goto-webinar.connector";
import { LIVESTORM_CONNECTOR_MANIFEST } from "./livestorm/livestorm.connector";
import { DEMIO_CONNECTOR_MANIFEST } from "./demio/demio.connector";
import { BIGMARKER_CONNECTOR_MANIFEST } from "./bigmarker/bigmarker.connector";
import { OTTER_AI_CONNECTOR_MANIFEST } from "./otter-ai/otter-ai.connector";
import { FIREFLIES_AI_CONNECTOR_MANIFEST } from "./fireflies-ai/fireflies-ai.connector";
import { FATHOM_CONNECTOR_MANIFEST } from "./fathom/fathom.connector";
import { BONSAI_CONNECTOR_MANIFEST } from "./bonsai/bonsai.connector";
import { TL_DV_CONNECTOR_MANIFEST } from "./tl-dv/tl-dv.connector";
import { GRAIN_CONNECTOR_MANIFEST } from "./grain/grain.connector";
import { WHIMSICAL_CONNECTOR_MANIFEST } from "./whimsical/whimsical.connector";
import { DRAW_IO_CONNECTOR_MANIFEST } from "./draw-io/draw-io.connector";
import { MINDMEISTER_CONNECTOR_MANIFEST } from "./mindmeister/mindmeister.connector";
import { XMIND_CONNECTOR_MANIFEST } from "./xmind/xmind.connector";
import { ADOBE_ANALYTICS_CONNECTOR_MANIFEST } from "./adobe-analytics/adobe-analytics.connector";
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
import { PADLET_CONNECTOR_MANIFEST } from "./padlet/padlet.connector";
import { DROPBOX_PAPER_CONNECTOR_MANIFEST } from "./dropbox-paper/dropbox-paper.connector";
import { ZOHO_WORKDRIVE_CONNECTOR_MANIFEST } from "./zoho-workdrive/zoho-workdrive.connector";
import { EGNYTE_CONNECTOR_MANIFEST } from "./egnyte/egnyte.connector";
import { SHAREFILE_CONNECTOR_MANIFEST } from "./sharefile/sharefile.connector";
import { DEPUTY_CONNECTOR_MANIFEST } from "./deputy/deputy.connector";
import { HOMEBASE_CONNECTOR_MANIFEST } from "./homebase/homebase.connector";
import { SEVEN_SHIFTS_CONNECTOR_MANIFEST } from "./seven-shifts/seven-shifts.connector";
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
import { ONTRAPORT_CONNECTOR_MANIFEST } from "./ontraport/ontraport.connector";
import { BITRIX24_CONNECTOR_MANIFEST } from "./bitrix24/bitrix24.connector";
import { AGILE_CRM_CONNECTOR_MANIFEST } from "./agile-crm/agile-crm.connector";
import { STREAK_CONNECTOR_MANIFEST } from "./streak/streak.connector";
import { LESS_ANNOYING_CRM_CONNECTOR_MANIFEST } from "./less-annoying-crm/less-annoying-crm.connector";
import { NUTSHELL_CONNECTOR_MANIFEST } from "./nutshell/nutshell.connector";
import { TEAMLEADER_CONNECTOR_MANIFEST } from "./teamleader/teamleader.connector";
import { SCORO_CONNECTOR_MANIFEST } from "./scoro/scoro.connector";
import { ODOO_CONNECTOR_MANIFEST } from "./odoo/odoo.connector";
import { NETSUITE_CONNECTOR_MANIFEST } from "./netsuite/netsuite.connector";
import { SAGE_ACCOUNTING_CONNECTOR_MANIFEST } from "./sage-accounting/sage-accounting.connector";
import { SAGE_INTACCT_CONNECTOR_MANIFEST } from "./sage-intacct/sage-intacct.connector";
import { MYOB_CONNECTOR_MANIFEST } from "./myob/myob.connector";
import { KASHFLOW_CONNECTOR_MANIFEST } from "./kashflow/kashflow.connector";
import { ZOHO_BOOKS_CONNECTOR_MANIFEST } from "./zoho-books/zoho-books.connector";
import { ZOHO_INVOICE_CONNECTOR_MANIFEST } from "./zoho-invoice/zoho-invoice.connector";
import { ZOHO_EXPENSE_CONNECTOR_MANIFEST } from "./zoho-expense/zoho-expense.connector";
import { ZOHO_DESK_CONNECTOR_MANIFEST } from "./zoho-desk/zoho-desk.connector";
import { ZOHO_PROJECTS_CONNECTOR_MANIFEST } from "./zoho-projects/zoho-projects.connector";
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
import { MY_HOURS_CONNECTOR_MANIFEST } from "./my-hours/my-hours.connector";
import { PAPERFORM_CONNECTOR_MANIFEST } from "./paperform/paperform.connector";
import { JOTFORM_CONNECTOR_MANIFEST } from "./jotform/jotform.connector";
import { FORMSTACK_CONNECTOR_MANIFEST } from "./formstack/formstack.connector";
import { SURVEYMONKEY_CONNECTOR_MANIFEST } from "./surveymonkey/surveymonkey.connector";
import { FILLOUT_CONNECTOR_MANIFEST } from "./fillout/fillout.connector";
import { TALLY_CONNECTOR_MANIFEST } from "./tally/tally.connector";
import { MAILCHIMP_CONNECTOR_MANIFEST } from "./mailchimp/mailchimp.connector";
import { KLAVIYO_CONNECTOR_MANIFEST } from "./klaviyo/klaviyo.connector";
import { CONVERTKIT_CONNECTOR_MANIFEST } from "./convertkit/convertkit.connector";
import { CAMPAIGN_MONITOR_CONNECTOR_MANIFEST } from "./campaign-monitor/campaign-monitor.connector";
import { CONSTANT_CONTACT_CONNECTOR_MANIFEST } from "./constant-contact/constant-contact.connector";
import { ACTIVECAMPAIGN_CONNECTOR_MANIFEST } from "./activecampaign/activecampaign.connector";
import { CUSTOMER_IO_CONNECTOR_MANIFEST } from "./customer-io/customer-io.connector";
import { BRAZE_CONNECTOR_MANIFEST } from "./braze/braze.connector";
import { SEGMENT_PERSONAS_CONNECTOR_MANIFEST } from "./segment-personas/segment-personas.connector";
import { MIXPANEL_CONNECTOR_MANIFEST } from "./mixpanel/mixpanel.connector";
import { AMPLITUDE_CONNECTOR_MANIFEST } from "./amplitude/amplitude.connector";
import { PENDO_CONNECTOR_MANIFEST } from "./pendo/pendo.connector";
import { POSTHOG_CONNECTOR_MANIFEST } from "./posthog/posthog.connector";
import { SENTRY_CONNECTOR_MANIFEST } from "./sentry/sentry.connector";
import { COGNITO_FORMS_CONNECTOR_MANIFEST } from "./cognito-forms/cognito-forms.connector";
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
import { FIRSTPROMOTER_CONNECTOR_MANIFEST } from "./firstpromoter/firstpromoter.connector";
import { APOLLO_IO_CONNECTOR_MANIFEST } from "./apollo-io/apollo-io.connector";
import { OUTREACH_CONNECTOR_MANIFEST } from "./outreach/outreach.connector";
import { SALESLOFT_CONNECTOR_MANIFEST } from "./salesloft/salesloft.connector";
import { GONG_CONNECTOR_MANIFEST } from "./gong/gong.connector";
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
import { PCLOUD_CONNECTOR_MANIFEST } from "./pcloud/pcloud.connector";
import { TRESORIT_CONNECTOR_MANIFEST } from "./tresorit/tresorit.connector";
import { HIGHTAIL_CONNECTOR_MANIFEST } from "./hightail/hightail.connector";
import { FILESTACK_CONNECTOR_MANIFEST } from "./filestack/filestack.connector";
import { IMGIX_CONNECTOR_MANIFEST } from "./imgix/imgix.connector";
import { BYNDER_CONNECTOR_MANIFEST } from "./bynder/bynder.connector";
import { BRANDFOLDER_CONNECTOR_MANIFEST } from "./brandfolder/brandfolder.connector";
import { CANTO_CONNECTOR_MANIFEST } from "./canto/canto.connector";
import { FRONTIFY_CONNECTOR_MANIFEST } from "./frontify/frontify.connector";
import { ASSET_BANK_CONNECTOR_MANIFEST } from "./asset-bank/asset-bank.connector";
import { WIDEN_COLLECTIVE_CONNECTOR_MANIFEST } from "./widen-collective/widen-collective.connector";
import { KONTAINER_CONNECTOR_MANIFEST } from "./kontainer/kontainer.connector";
import { JIRA_ALIGN_CONNECTOR_MANIFEST } from "./jira-align/jira-align.connector";
import { ATLASSIAN_COMPASS_CONNECTOR_MANIFEST } from "./atlassian-compass/atlassian-compass.connector";
import { DAMINION_CONNECTOR_MANIFEST } from "./daminion/daminion.connector";
import { MS_PROJECT_CONNECTOR_MANIFEST } from "./ms-project/ms-project.connector";
import { MICROSOFT_DYNAMICS_365_SALES_CONNECTOR_MANIFEST } from "./microsoft-dynamics-365-sales/microsoft-dynamics-365-sales.connector";
import { MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_CONNECTOR_MANIFEST } from "./microsoft-dynamics-365-customer-service/microsoft-dynamics-365-customer-service.connector";
import { MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_CONNECTOR_MANIFEST } from "./microsoft-dynamics-365-business-central/microsoft-dynamics-365-business-central.connector";
import { MICROSOFT_ENTRA_ID_CONNECTOR_MANIFEST } from "./microsoft-entra-id/microsoft-entra-id.connector";
import { YAMMER_CONNECTOR_MANIFEST } from "./yammer/yammer.connector";
import { VIVA_LEARNING_CONNECTOR_MANIFEST } from "./viva-learning/viva-learning.connector";
import { JIRA_CONNECTOR_MANIFEST } from "./jira/jira.connector";
import { JIRA_SERVICE_MANAGEMENT_CONNECTOR_MANIFEST } from "./jira-service-management/jira-service-management.connector";
import { PRODUCTBOARD_CONNECTOR_MANIFEST } from "./productboard/productboard.connector";
import { AHA_CONNECTOR_MANIFEST } from "./aha/aha.connector";
import { ROADMUNK_CONNECTOR_MANIFEST } from "./roadmunk/roadmunk.connector";
import { SHORTCUT_CONNECTOR_MANIFEST } from "./shortcut/shortcut.connector";
import { HIVE_CONNECTOR_MANIFEST } from "./hive/hive.connector";
import { NIFTY_CONNECTOR_MANIFEST } from "./nifty/nifty.connector";
import { PAYMO_CONNECTOR_MANIFEST } from "./paymo/paymo.connector";
import { KRAKEN_CONNECTOR_MANIFEST } from "./kraken/kraken.connector";
import { BINANCE_CONNECTOR_MANIFEST } from "./binance/binance.connector";
import { GEMINI_CONNECTOR_MANIFEST } from "./gemini/gemini.connector";
import { PROOFHUB_CONNECTOR_MANIFEST } from "./proofhub/proofhub.connector";
import { PROOF_CONNECTOR_MANIFEST } from "./proof/proof.connector";
import { TERMLY_CONNECTOR_MANIFEST } from "./termly/termly.connector";
import { COOKIEBOT_CONNECTOR_MANIFEST } from "./cookiebot/cookiebot.connector";
import { ONETRUST_CONNECTOR_MANIFEST } from "./onetrust/onetrust.connector";
import { SALESFORCE_MARKETING_CLOUD_CONNECTOR_MANIFEST } from "./salesforce-marketing-cloud/salesforce-marketing-cloud.connector";
import { SALESFORCE_COMMERCE_CLOUD_CONNECTOR_MANIFEST } from "./salesforce-commerce-cloud/salesforce-commerce-cloud.connector";
import { MARKETO_CONNECTOR_MANIFEST } from "./marketo/marketo.connector";
import { PARDOT_CONNECTOR_MANIFEST } from "./pardot/pardot.connector";
import { ELOQUA_CONNECTOR_MANIFEST } from "./eloqua/eloqua.connector";
import { DRIP_CONNECTOR_MANIFEST } from "./drip/drip.connector";
import { MAILERLITE_CONNECTOR_MANIFEST } from "./mailerlite/mailerlite.connector";
import { AWEBER_CONNECTOR_MANIFEST } from "./aweber/aweber.connector";
import { GETRESPONSE_CONNECTOR_MANIFEST } from "./getresponse/getresponse.connector";
import { MOOSEND_CONNECTOR_MANIFEST } from "./moosend/moosend.connector";
import { OMNISEND_CONNECTOR_MANIFEST } from "./omnisend/omnisend.connector";
import { MAILERCLOUD_CONNECTOR_MANIFEST } from "./mailercloud/mailercloud.connector";
import { BENCHMARK_EMAIL_CONNECTOR_MANIFEST } from "./benchmark-email/benchmark-email.connector";
import { EMMA_CONNECTOR_MANIFEST } from "./emma/emma.connector";
import { FLODESK_CONNECTOR_MANIFEST } from "./flodesk/flodesk.connector";
import { HOMEBREW_CONNECTOR_MANIFEST } from "./homebrew/homebrew.connector";
import { CALIBRE_CONNECTOR_MANIFEST } from "./calibre/calibre.connector";
import { PLEX_PERSONAL_MEDIA_SERVER_CONNECTOR_MANIFEST } from "./plex-personal-media-server/plex-personal-media-server.connector";
import { JELLYFIN_CONNECTOR_MANIFEST } from "./jellyfin/jellyfin.connector";
import { SYNOLOGY_DSM_CONNECTOR_MANIFEST } from "./synology-dsm/synology-dsm.connector";
import { WORDPRESS_WOOCOMMERCE_SELF_HOSTED_CONNECTOR_MANIFEST } from "./wordpress-woocommerce-self-hosted/wordpress-woocommerce-self-hosted.connector";
import { MAGENTO_SELF_HOSTED_CONNECTOR_MANIFEST } from "./magento-self-hosted/magento-self-hosted.connector";
import { PRESTASHOP_SELF_HOSTED_CONNECTOR_MANIFEST } from "./prestashop-self-hosted/prestashop-self-hosted.connector";
import { DRUPAL_CONNECTOR_MANIFEST } from "./drupal/drupal.connector";
import { JOOMLA_CONNECTOR_MANIFEST } from "./joomla/joomla.connector";
import { CONCRETE_CMS_CONNECTOR_MANIFEST } from "./concrete-cms/concrete-cms.connector";
import { CRAFT_CMS_CONNECTOR_MANIFEST } from "./craft-cms/craft-cms.connector";
import { STATAMIC_CONNECTOR_MANIFEST } from "./statamic/statamic.connector";
import { KIRBY_CMS_CONNECTOR_MANIFEST } from "./kirby-cms/kirby-cms.connector";
import { DIRECTUS_SELF_HOSTED_CONNECTOR_MANIFEST } from "./directus-self-hosted/directus-self-hosted.connector";
import { STRAPI_SELF_HOSTED_CONNECTOR_MANIFEST } from "./strapi-self-hosted/strapi-self-hosted.connector";
import { SUPABASE_SELF_HOSTED_CONNECTOR_MANIFEST } from "./supabase-self-hosted/supabase-self-hosted.connector";
import { MEISTERTASK_CONNECTOR_MANIFEST } from "./meistertask/meistertask.connector";
import { NOZBE_CONNECTOR_MANIFEST } from "./nozbe/nozbe.connector";
import { ANY_DO_CONNECTOR_MANIFEST } from "./any-do/any-do.connector";
import { REMEMBER_THE_MILK_CONNECTOR_MANIFEST } from "./remember-the-milk/remember-the-milk.connector";
import { HABITICA_CONNECTOR_MANIFEST } from "./habitica/habitica.connector";
import { AMAZING_MARVIN_CONNECTOR_MANIFEST } from "./amazing-marvin/amazing-marvin.connector";
import { AKIFLOW_CONNECTOR_MANIFEST } from "./akiflow/akiflow.connector";
import { SUNSAMA_CONNECTOR_MANIFEST } from "./sunsama/sunsama.connector";
import { MOTION_CONNECTOR_MANIFEST } from "./motion/motion.connector";
import { RECLAIM_AI_CONNECTOR_MANIFEST } from "./reclaim-ai/reclaim-ai.connector";
import { SAVVYCAL_CONNECTOR_MANIFEST } from "./savvycal/savvycal.connector";
import { YOUCANBOOKME_CONNECTOR_MANIFEST } from "./youcanbookme/youcanbookme.connector";
import { ACUITY_SCHEDULING_CONNECTOR_MANIFEST } from "./acuity-scheduling/acuity-scheduling.connector";
import { SIMPLYBOOK_ME_CONNECTOR_MANIFEST } from "./simplybook-me/simplybook-me.connector";
import { ONCEHUB_CONNECTOR_MANIFEST } from "./oncehub/oncehub.connector";
import { SALESFLARE_CONNECTOR_MANIFEST } from "./salesflare/salesflare.connector";
import { FOLK_CRM_CONNECTOR_MANIFEST } from "./folk-crm/folk-crm.connector";
import { ONEPAGECRM_CONNECTOR_MANIFEST } from "./onepagecrm/onepagecrm.connector";
import { FOLLOW_UP_BOSS_CONNECTOR_MANIFEST } from "./follow-up-boss/follow-up-boss.connector";
import { CHIME_CRM_CONNECTOR_MANIFEST } from "./chime-crm/chime-crm.connector";
import { REALLY_SIMPLE_SYSTEMS_CONNECTOR_MANIFEST } from "./really-simple-systems/really-simple-systems.connector";
import { VTIGER_CRM_CONNECTOR_MANIFEST } from "./vtiger-crm/vtiger-crm.connector";
import { SUITECRM_CLOUD_CONNECTOR_MANIFEST } from "./suitecrm-cloud/suitecrm-cloud.connector";
import { SUGARCRM_CONNECTOR_MANIFEST } from "./sugarcrm/sugarcrm.connector";
import { CREATIO_CONNECTOR_MANIFEST } from "./creatio/creatio.connector";
import { ATTIO_CONNECTOR_MANIFEST } from "./attio/attio.connector";
import { ZENDESK_SELL_CONNECTOR_MANIFEST } from "./zendesk-sell/zendesk-sell.connector";
import { KEAP_MAX_CLASSIC_CONNECTOR_MANIFEST } from "./keap-max-classic/keap-max-classic.connector";
import { SETMORE_CONNECTOR_MANIFEST } from "./setmore/setmore.connector";
import { PLUTIO_CONNECTOR_MANIFEST } from "./plutio/plutio.connector";
import { SHOOTPROOF_CONNECTOR_MANIFEST } from "./shootproof/shootproof.connector";
import { SMUGMUG_CONNECTOR_MANIFEST } from "./smugmug/smugmug.connector";
import { FLICKR_CONNECTOR_MANIFEST } from "./flickr/flickr.connector";
import { DRIBBBLE_CONNECTOR_MANIFEST } from "./dribbble/dribbble.connector";
import { DEVIANTART_CONNECTOR_MANIFEST } from "./deviantart/deviantart.connector";
import { BANDCAMP_CONNECTOR_MANIFEST } from "./bandcamp/bandcamp.connector";
import { MIXCLOUD_CONNECTOR_MANIFEST } from "./mixcloud/mixcloud.connector";
import { AUDIOMACK_CONNECTOR_MANIFEST } from "./audiomack/audiomack.connector";
import { AUDIUS_CONNECTOR_MANIFEST } from "./audius/audius.connector";
import { PODBEAN_CONNECTOR_MANIFEST } from "./podbean/podbean.connector";
import { MAILCHIMP_TRANSACTIONAL_CONNECTOR_MANIFEST } from "./mailchimp-transactional/mailchimp-transactional.connector";
import { MAILCHIMP_SURVEYS_CONNECTOR_MANIFEST } from "./mailchimp-surveys/mailchimp-surveys.connector";
import { KLAVIYO_SMS_CONNECTOR_MANIFEST } from "./klaviyo-sms/klaviyo-sms.connector";
import { ATTENTIVE_CONNECTOR_MANIFEST } from "./attentive/attentive.connector";
import { POSTSCRIPT_CONNECTOR_MANIFEST } from "./postscript/postscript.connector";
import { SENDLANE_CONNECTOR_MANIFEST } from "./sendlane/sendlane.connector";
import { ITERABLE_CONNECTOR_MANIFEST } from "./iterable/iterable.connector";
import { ITERABLE_SMS_CONNECTOR_MANIFEST } from "./iterable-sms/iterable-sms.connector";
import { ORTTO_CONNECTOR_MANIFEST } from "./ortto/ortto.connector";
import { VERO_CONNECTOR_MANIFEST } from "./vero/vero.connector";
import { MESSAGEGEARS_CONNECTOR_MANIFEST } from "./messagegears/messagegears.connector";
import { MAROPOST_CONNECTOR_MANIFEST } from "./maropost/maropost.connector";
import { EMARSYS_CONNECTOR_MANIFEST } from "./emarsys/emarsys.connector";
import { SAILTHRU_CONNECTOR_MANIFEST } from "./sailthru/sailthru.connector";
import { LISTRAK_CONNECTOR_MANIFEST } from "./listrak/listrak.connector";
import { DOTDIGITAL_CONNECTOR_MANIFEST } from "./dotdigital/dotdigital.connector";
import { ACOUSTIC_CAMPAIGN_CONNECTOR_MANIFEST } from "./acoustic-campaign/acoustic-campaign.connector";
import { BLOOMREACH_ENGAGEMENT_CONNECTOR_MANIFEST } from "./bloomreach-engagement/bloomreach-engagement.connector";
import { MOENGAGE_CONNECTOR_MANIFEST } from "./moengage/moengage.connector";
import { SALESFORCE_DATA_CLOUD_CONNECTOR_MANIFEST } from "./salesforce-data-cloud/salesforce-data-cloud.connector";
import { ADOBE_REAL_TIME_CDP_CONNECTOR_MANIFEST } from "./adobe-real-time-cdp/adobe-real-time-cdp.connector";
import { TWILIO_SEGMENT_ENGAGE_CONNECTOR_MANIFEST } from "./twilio-segment-engage/twilio-segment-engage.connector";
import { AMPLITUDE_EXPERIMENT_CONNECTOR_MANIFEST } from "./amplitude-experiment/amplitude-experiment.connector";
import { MIXPANEL_COHORTS_CONNECTOR_MANIFEST } from "./mixpanel-cohorts/mixpanel-cohorts.connector";
import { POSTHOG_FEATURE_FLAGS_CONNECTOR_MANIFEST } from "./posthog-feature-flags/posthog-feature-flags.connector";
import { STATSIG_CONNECTOR_MANIFEST } from "./statsig/statsig.connector";
import { LAUNCHDARKLY_CONNECTOR_MANIFEST } from "./launchdarkly/launchdarkly.connector";
import { SPLIT_IO_CONNECTOR_MANIFEST } from "./split-io/split-io.connector";
import { FLAGSMITH_CLOUD_CONNECTOR_MANIFEST } from "./flagsmith-cloud/flagsmith-cloud.connector";
import { CONFIGCAT_CONNECTOR_MANIFEST } from "./configcat/configcat.connector";
import { GROWTHBOOK_CLOUD_CONNECTOR_MANIFEST } from "./growthbook-cloud/growthbook-cloud.connector";
import { UNLEASH_CLOUD_CONNECTOR_MANIFEST } from "./unleash-cloud/unleash-cloud.connector";
import { OPTIMIZELY_ROLLOUTS_CONNECTOR_MANIFEST } from "./optimizely-rollouts/optimizely-rollouts.connector";
import { VWO_TESTING_CONNECTOR_MANIFEST } from "./vwo-testing/vwo-testing.connector";
import { AB_TASTY_FEATURE_EXPERIMENTATION_CONNECTOR_MANIFEST } from "./ab-tasty-feature-experimentation/ab-tasty-feature-experimentation.connector";
import { SQUARE_APPOINTMENTS_CONNECTOR_MANIFEST } from "./square-appointments/square-appointments.connector";
import { VAGARO_CONNECTOR_MANIFEST } from "./vagaro/vagaro.connector";
import { MINDBODY_CONNECTOR_MANIFEST } from "./mindbody/mindbody.connector";
import { JANE_APP_CONNECTOR_MANIFEST } from "./jane-app/jane-app.connector";
import { CLINIKO_CONNECTOR_MANIFEST } from "./cliniko/cliniko.connector";
import { PRACTICE_BETTER_CONNECTOR_MANIFEST } from "./practice-better/practice-better.connector";
import { HEALTHIE_CONNECTOR_MANIFEST } from "./healthie/healthie.connector";
import {
  CERNER_ORACLE_HEALTH_CONNECTOR_MANIFEST,
  ECLINICALWORKS_CONNECTOR_MANIFEST,
  EPIC_APP_ORCHARD_CONNECTOR_MANIFEST,
  MEDITECH_EXPANSE_CONNECTOR_MANIFEST,
  NEXTGEN_HEALTHCARE_CONNECTOR_MANIFEST,
} from "./ehr-fhir/ehr-fhir.connector";
import { CLOUDINARY_CONNECTOR_MANIFEST } from "./cloudinary/cloudinary.connector";
import { MURAL_CONNECTOR_MANIFEST } from "./mural/mural.connector";
import { FIGJAM_CONNECTOR_MANIFEST } from "./figjam/figjam.connector";
import { FIGMA_CONNECTOR_MANIFEST } from "./figma/figma.connector";
import { MIRO_CONNECTOR_MANIFEST } from "./miro/miro.connector";
import { CANVA_CONNECTOR_MANIFEST } from "./canva/canva.connector";
import { WEBFLOW_CONNECTOR_MANIFEST } from "./webflow/webflow.connector";
import { WORDPRESS_COM_CONNECTOR_MANIFEST } from "./wordpress-com/wordpress-com.connector";
import { GHOST_CONNECTOR_MANIFEST } from "./ghost/ghost.connector";
import { CONTENTFUL_CONNECTOR_MANIFEST } from "./contentful/contentful.connector";
import { SANITY_CONNECTOR_MANIFEST } from "./sanity/sanity.connector";
import { STRAPI_CLOUD_CONNECTOR_MANIFEST } from "./strapi-cloud/strapi-cloud.connector";
import { SHOPIFY_CONNECTOR_MANIFEST } from "./shopify/shopify.connector";
import { WOOCOMMERCE_CONNECTOR_MANIFEST } from "./woocommerce/woocommerce.connector";
import { STRIPE_CONNECTOR_MANIFEST } from "./stripe/stripe.connector";
import { PAYPAL_CONNECTOR_MANIFEST } from "./paypal/paypal.connector";
import { KAJABI_COMMUNITIES_CONNECTOR_MANIFEST } from "./kajabi-communities/kajabi-communities.connector";
import { CIRCLE_CONNECTOR_MANIFEST } from "./circle/circle.connector";
import { MIGHTY_NETWORKS_CONNECTOR_MANIFEST } from "./mighty-networks/mighty-networks.connector";
import { DISCOURSE_CONNECTOR_MANIFEST } from "./discourse/discourse.connector";
import { VANILLA_FORUMS_CONNECTOR_MANIFEST } from "./vanilla-forums/vanilla-forums.connector";
import { BETTERMODE_CONNECTOR_MANIFEST } from "./bettermode/bettermode.connector";
import { HIGHER_LOGIC_CONNECTOR_MANIFEST } from "./higher-logic/higher-logic.connector";
import { HIVEBRITE_CONNECTOR_MANIFEST } from "./hivebrite/hivebrite.connector";
import { XERO_CONNECTOR_MANIFEST } from "./xero/xero.connector";
import { QUICKBOOKS_CONNECTOR_MANIFEST } from "./quickbooks/quickbooks.connector";
import { FRESHBOOKS_CONNECTOR_MANIFEST } from "./freshbooks/freshbooks.connector";
import { WAVE_CONNECTOR_MANIFEST } from "./wave/wave.connector";
import { FREEAGENT_CONNECTOR_MANIFEST } from "./freeagent/freeagent.connector";
import { SALESFORCE_CONNECTOR_MANIFEST } from "./salesforce/salesforce.connector";
import { HUBSPOT_CONNECTOR_MANIFEST } from "./hubspot/hubspot.connector";
import { PIPEDRIVE_CONNECTOR_MANIFEST } from "./pipedrive/pipedrive.connector";
import { ZOHO_CONNECTOR_MANIFEST } from "./zoho/zoho.connector";
import { ZOHO_PEOPLE_CONNECTOR_MANIFEST } from "./zoho-people/zoho-people.connector";
import { ZOHO_CAMPAIGNS_CONNECTOR_MANIFEST } from "./zoho-campaigns/zoho-campaigns.connector";
import { ZOHO_ANALYTICS_CONNECTOR_MANIFEST } from "./zoho-analytics/zoho-analytics.connector";
import { COPPER_CONNECTOR_MANIFEST } from "./copper/copper.connector";
import { CLOSE_CONNECTOR_MANIFEST } from "./close/close.connector";
import { ZENDESK_CONNECTOR_MANIFEST } from "./zendesk/zendesk.connector";
import { SHAREPOINT_CONNECTOR_MANIFEST } from "./sharepoint/sharepoint.connector";
import { MICROSOFT_PLANNER_CONNECTOR_MANIFEST } from "./microsoft-planner/microsoft-planner.connector";
import { MICROSOFT_TO_DO_CONNECTOR_MANIFEST } from "./microsoft-to-do/microsoft-to-do.connector";
import { MICROSOFT_LISTS_CONNECTOR_MANIFEST } from "./microsoft-lists/microsoft-lists.connector";
import { ONENOTE_CONNECTOR_MANIFEST } from "./onenote/onenote.connector";
import { MICROSOFT_BOOKINGS_CONNECTOR_MANIFEST } from "./microsoft-bookings/microsoft-bookings.connector";
import { MICROSOFT_POWER_BI_CONNECTOR_MANIFEST } from "./microsoft-power-bi/microsoft-power-bi.connector";
import { MICROSOFT_DYNAMICS_365_CONNECTOR_MANIFEST } from "./microsoft-dynamics-365/microsoft-dynamics-365.connector";
import { MICROSOFT_VIVA_ENGAGE_CONNECTOR_MANIFEST } from "./microsoft-viva-engage/microsoft-viva-engage.connector";
import { ZOOM_CONNECTOR_MANIFEST } from "./zoom/zoom.connector";
import { DISCORD_CONNECTOR_MANIFEST } from "./discord/discord.connector";
import { INTERCOM_CONNECTOR_MANIFEST } from "./intercom/intercom.connector";
import { FRESHSERVICE_CONNECTOR_MANIFEST } from "./freshservice/freshservice.connector";
import { FRESHCHAT_CONNECTOR_MANIFEST } from "./freshchat/freshchat.connector";
import { FRESHMARKETER_CONNECTOR_MANIFEST } from "./freshmarketer/freshmarketer.connector";
import { FRESHCALLER_CONNECTOR_MANIFEST } from "./freshcaller/freshcaller.connector";
import { LIVECHAT_CONNECTOR_MANIFEST } from "./livechat/livechat.connector";
import { LIVEAGENT_CONNECTOR_MANIFEST } from "./liveagent/liveagent.connector";
import { CRISP_CONNECTOR_MANIFEST } from "./crisp/crisp.connector";
import { TIDIO_CONNECTOR_MANIFEST } from "./tidio/tidio.connector";
import { OLARK_CONNECTOR_MANIFEST } from "./olark/olark.connector";
import { USERLIKE_CONNECTOR_MANIFEST } from "./userlike/userlike.connector";
import { GLADLY_CONNECTOR_MANIFEST } from "./gladly/gladly.connector";
import { KUSTOMER_CONNECTOR_MANIFEST } from "./kustomer/kustomer.connector";
import { GORGIAS_CONNECTOR_MANIFEST } from "./gorgias/gorgias.connector";
import { REAMAZE_CONNECTOR_MANIFEST } from "./re-amaze/re-amaze.connector";
import { EDESK_CONNECTOR_MANIFEST } from "./edesk/edesk.connector";
import { KAYAKO_CONNECTOR_MANIFEST } from "./kayako/kayako.connector";
import { ACQUIRE_CONNECTOR_MANIFEST } from "./acquire/acquire.connector";
import { FRESHDESK_CONNECTOR_MANIFEST } from "./freshdesk/freshdesk.connector";
import { HELP_SCOUT_CONNECTOR_MANIFEST } from "./help-scout/help-scout.connector";
import { FRONT_CONNECTOR_MANIFEST } from "./front/front.connector";
import { GROOVE_CONNECTOR_MANIFEST } from "./groove/groove.connector";
import { TEAMWORK_CONNECTOR_MANIFEST } from "./teamwork/teamwork.connector";
import { BASECAMP_CONNECTOR_MANIFEST } from "./basecamp/basecamp.connector";
import { WRIKE_CONNECTOR_MANIFEST } from "./wrike/wrike.connector";
import { SMARTSHEET_CONNECTOR_MANIFEST } from "./smartsheet/smartsheet.connector";
import { TODOIST_CONNECTOR_MANIFEST } from "./todoist/todoist.connector";
import { TICKTICK_CONNECTOR_MANIFEST } from "./ticktick/ticktick.connector";
import { TOGGL_TRACK_CONNECTOR_MANIFEST } from "./toggl-track/toggl-track.connector";
import { HARVEST_CONNECTOR_MANIFEST } from "./harvest/harvest.connector";
import { CLOCKIFY_CONNECTOR_MANIFEST } from "./clockify/clockify.connector";
import { TEMPO_TIMESHEETS_CONNECTOR_MANIFEST } from "./tempo-timesheets/tempo-timesheets.connector";
import { ZEPHYR_SCALE_CONNECTOR_MANIFEST } from "./zephyr-scale/zephyr-scale.connector";
import { CALENDLY_CONNECTOR_MANIFEST } from "./calendly/calendly.connector";
import { YODLEE_FASTLINK_CONNECTOR_MANIFEST } from "./yodlee-fastlink/yodlee-fastlink.connector";
import { MX_CONNECTOR_MANIFEST } from "./mx/mx.connector";
import { FINICITY_CONNECTOR_MANIFEST } from "./finicity/finicity.connector";
import { PLAID_LINK_CONNECTOR_MANIFEST } from "./plaid-link/plaid-link.connector";
import { ETORO_CONNECTOR_MANIFEST } from "./etoro/etoro.connector";
import { OBSIDIAN_CONNECTOR_MANIFEST } from "./obsidian/obsidian.connector";
import { ROAM_RESEARCH_CONNECTOR_MANIFEST } from "./roam-research/roam-research.connector";
import { LOGSEQ_CONNECTOR_MANIFEST } from "./logseq/logseq.connector";
import { CAL_COM_CONNECTOR_MANIFEST } from "./cal-com/cal-com.connector";
import { IRONCLAD_CLICKWRAP_CONNECTOR_MANIFEST } from "./ironclad-clickwrap/ironclad-clickwrap.connector";
import { DOCUSIGN_IDENTIFY_CONNECTOR_MANIFEST } from "./docusign-identify/docusign-identify.connector";
import { GIVEBUTTER_CONNECTOR_MANIFEST } from "./givebutter/givebutter.connector";
import { GIVE_LIVELY_CONNECTOR_MANIFEST } from "./give-lively/give-lively.connector";
import { KINDFUL_CONNECTOR_MANIFEST } from "./kindful/kindful.connector";
import { NEON_CRM_CONNECTOR_MANIFEST } from "./neon-crm/neon-crm.connector";
import { LITTLE_GREEN_LIGHT_CONNECTOR_MANIFEST } from "./little-green-light/little-green-light.connector";
import { DONATELY_CONNECTOR_MANIFEST } from "./donately/donately.connector";
import { FUNDRAISE_UP_CONNECTOR_MANIFEST } from "./fundraise-up/fundraise-up.connector";
import { VIRTUOUS_CRM_CONNECTOR_MANIFEST } from "./virtuous-crm/virtuous-crm.connector";
import { EVERYACTION_CONNECTOR_MANIFEST } from "./everyaction/everyaction.connector";
import { NATIONBUILDER_CONNECTOR_MANIFEST } from "./nationbuilder/nationbuilder.connector";
import { ACTBLUE_CONNECTOR_MANIFEST } from "./actblue/actblue.connector";
import { MOBILIZE_CONNECTOR_MANIFEST } from "./mobilize/mobilize.connector";
import { ACTION_NETWORK_CONNECTOR_MANIFEST } from "./action-network/action-network.connector";
import { CONSTANT_CONTACT_LEAD_GEN_CONNECTOR_MANIFEST } from "./constant-contact-lead-gen/constant-contact-lead-gen.connector";
import { DOCUSIGN_CONNECTOR_MANIFEST } from "./docusign/docusign.connector";
import { DROPBOX_SIGN_CONNECTOR_MANIFEST } from "./dropbox-sign/dropbox-sign.connector";
import { PANDADOC_CONNECTOR_MANIFEST } from "./pandadoc/pandadoc.connector";
import { TYPEFORM_CONNECTOR_MANIFEST } from "./typeform/typeform.connector";
import { DATADOG_CONNECTOR_MANIFEST } from "./datadog/datadog.connector";
import { NEW_RELIC_CONNECTOR_MANIFEST } from "./new-relic/new-relic.connector";
import { PAGERDUTY_CONNECTOR_MANIFEST } from "./pagerduty/pagerduty.connector";
import { STATUSPAGE_CONNECTOR_MANIFEST } from "./statuspage/statuspage.connector";
import { CLOUDFLARE_CONNECTOR_MANIFEST } from "./cloudflare/cloudflare.connector";
import { VERCEL_CONNECTOR_MANIFEST } from "./vercel/vercel.connector";
import { NETLIFY_CONNECTOR_MANIFEST } from "./netlify/netlify.connector";
import { HEROKU_CONNECTOR_MANIFEST } from "./heroku/heroku.connector";
import { DIGITALOCEAN_CONNECTOR_MANIFEST } from "./digitalocean/digitalocean.connector";
import { FIREBASE_CONNECTOR_MANIFEST } from "./firebase/firebase.connector";
import { SUPABASE_CONNECTOR_MANIFEST } from "./supabase/supabase.connector";
import { OKTA_CONNECTOR_MANIFEST } from "./okta/okta.connector";
import { BAMBOOHR_CONNECTOR_MANIFEST } from "./bamboohr/bamboohr.connector";
import { GREENHOUSE_CONNECTOR_MANIFEST } from "./greenhouse/greenhouse.connector";
import { LEVER_CONNECTOR_MANIFEST } from "./lever/lever.connector";
import { GMAIL_CONNECTOR_MANIFEST } from "./gmail/gmail.connector";
import { GOOGLE_CALENDAR_CONNECTOR_MANIFEST } from "./google-calendar/google-calendar.connector";
import { SENDFOX_CONNECTOR_MANIFEST } from "./sendfox/sendfox.connector";
import { BEEHIIV_CONNECTOR_MANIFEST } from "./beehiiv/beehiiv.connector";
import { SUBSTACK_CONNECTOR_MANIFEST } from "./substack/substack.connector";
import { HOOTSUITE_CONNECTOR_MANIFEST } from "./hootsuite/hootsuite.connector";
import { BUFFER_CONNECTOR_MANIFEST } from "./buffer/buffer.connector";
import { SPROUT_SOCIAL_CONNECTOR_MANIFEST } from "./sprout-social/sprout-social.connector";
import { LATER_CONNECTOR_MANIFEST } from "./later/later.connector";
import { AGORAPULSE_CONNECTOR_MANIFEST } from "./agorapulse/agorapulse.connector";
import { METRICOOL_CONNECTOR_MANIFEST } from "./metricool/metricool.connector";
import { PUBLER_CONNECTOR_MANIFEST } from "./publer/publer.connector";
import { BRANDWATCH_CONNECTOR_MANIFEST } from "./brandwatch/brandwatch.connector";
import { MENTION_CONNECTOR_MANIFEST } from "./mention/mention.connector";
import { MELTWATER_CONNECTOR_MANIFEST } from "./meltwater/meltwater.connector";
import { SPRINKLR_CONNECTOR_MANIFEST } from "./sprinklr/sprinklr.connector";
import { KHOROS_CONNECTOR_MANIFEST } from "./khoros/khoros.connector";
import { CLEVERTAP_CONNECTOR_MANIFEST } from "./clevertap/clevertap.connector";
import { ONESIGNAL_CONNECTOR_MANIFEST } from "./onesignal/onesignal.connector";
import { AIRSHIP_CONNECTOR_MANIFEST } from "./airship/airship.connector";
import { PUSHWOOSH_CONNECTOR_MANIFEST } from "./pushwoosh/pushwoosh.connector";
import { PUSHER_BEAMS_CONNECTOR_MANIFEST } from "./pusher-beams/pusher-beams.connector";
import { FIREBASE_CLOUD_MESSAGING_CONNECTOR_MANIFEST } from "./firebase-cloud-messaging/firebase-cloud-messaging.connector";
import { APPSFLYER_CONNECTOR_MANIFEST } from "./appsflyer/appsflyer.connector";
import { ADJUST_CONNECTOR_MANIFEST } from "./adjust/adjust.connector";
import { BRANCH_CONNECTOR_MANIFEST } from "./branch/branch.connector";
import { SINGULAR_CONNECTOR_MANIFEST } from "./singular/singular.connector";
import { KOCHAVA_CONNECTOR_MANIFEST } from "./kochava/kochava.connector";
import { SEGMENT_CONNECTOR_MANIFEST } from "./segment/segment.connector";
import { MPARTICLE_CONNECTOR_MANIFEST } from "./mparticle/mparticle.connector";
import { TEALIUM_CONNECTOR_MANIFEST } from "./tealium/tealium.connector";
import { LYTICS_CONNECTOR_MANIFEST } from "./lytics/lytics.connector";
import { BLUECONIC_CONNECTOR_MANIFEST } from "./blueconic/blueconic.connector";
import { TREASURE_DATA_CONNECTOR_MANIFEST } from "./treasure-data/treasure-data.connector";
import { HIGHTOUCH_CONNECTOR_MANIFEST } from "./hightouch/hightouch.connector";
import { CENSUS_CONNECTOR_MANIFEST } from "./census/census.connector";
import { MYCASE_CONNECTOR_MANIFEST } from "./mycase/mycase.connector";
import { CLIO_MANAGE_CONNECTOR_MANIFEST } from "./clio-manage/clio-manage.connector";
import { CLIO_GROW_CONNECTOR_MANIFEST } from "./clio-grow/clio-grow.connector";
import { DISCO_EDISCOVERY_CONNECTOR_MANIFEST } from "./disco-ediscovery/disco-ediscovery.connector";
import { LUCIDSPARK_CONNECTOR_MANIFEST } from "./lucidspark/lucidspark.connector";
import { LUCIDCHART_CONNECTOR_MANIFEST } from "./lucidchart/lucidchart.connector";

@Injectable()
export class MarketplaceConnectorRegistry {
  private readonly manifests = new Map<string, MarketplaceConnectorManifest>([
    [GITHUB_CONNECTOR_MANIFEST.slug, GITHUB_CONNECTOR_MANIFEST],
    [GITLAB_CONNECTOR_MANIFEST.slug, GITLAB_CONNECTOR_MANIFEST],
    [BITBUCKET_CONNECTOR_MANIFEST.slug, BITBUCKET_CONNECTOR_MANIFEST],
    [NOTION_CONNECTOR_MANIFEST.slug, NOTION_CONNECTOR_MANIFEST],
    [LINEAR_CONNECTOR_MANIFEST.slug, LINEAR_CONNECTOR_MANIFEST],
    [ASANA_CONNECTOR_MANIFEST.slug, ASANA_CONNECTOR_MANIFEST],
    [TRELLO_CONNECTOR_MANIFEST.slug, TRELLO_CONNECTOR_MANIFEST],
    [CLICKUP_CONNECTOR_MANIFEST.slug, CLICKUP_CONNECTOR_MANIFEST],
    [MONDAY_COM_CONNECTOR_MANIFEST.slug, MONDAY_COM_CONNECTOR_MANIFEST],
    [AIRTABLE_CONNECTOR_MANIFEST.slug, AIRTABLE_CONNECTOR_MANIFEST],
    [CODA_CONNECTOR_MANIFEST.slug, CODA_CONNECTOR_MANIFEST],
    [CRAFT_CONNECTOR_MANIFEST.slug, CRAFT_CONNECTOR_MANIFEST],
    [
      TELEGRAM_PERSONAL_BOTS_CONNECTOR_MANIFEST.slug,
      TELEGRAM_PERSONAL_BOTS_CONNECTOR_MANIFEST,
    ],
    [
      LOCAL_WORDPRESS_ORG_CONNECTOR_MANIFEST.slug,
      LOCAL_WORDPRESS_ORG_CONNECTOR_MANIFEST,
    ],
    [
      MATOMO_SELF_HOSTED_CONNECTOR_MANIFEST.slug,
      MATOMO_SELF_HOSTED_CONNECTOR_MANIFEST,
    ],
    [
      PLAUSIBLE_SELF_HOSTED_CONNECTOR_MANIFEST.slug,
      PLAUSIBLE_SELF_HOSTED_CONNECTOR_MANIFEST,
    ],
    [
      UMAMI_SELF_HOSTED_CONNECTOR_MANIFEST.slug,
      UMAMI_SELF_HOSTED_CONNECTOR_MANIFEST,
    ],
    [
      GHOST_SELF_HOSTED_CONNECTOR_MANIFEST.slug,
      GHOST_SELF_HOSTED_CONNECTOR_MANIFEST,
    ],
    [
      XRAY_TEST_MANAGEMENT_CONNECTOR_MANIFEST.slug,
      XRAY_TEST_MANAGEMENT_CONNECTOR_MANIFEST,
    ],
    [
      STRUCTURE_FOR_JIRA_CONNECTOR_MANIFEST.slug,
      STRUCTURE_FOR_JIRA_CONNECTOR_MANIFEST,
    ],
    [PRODUCTPLAN_CONNECTOR_MANIFEST.slug, PRODUCTPLAN_CONNECTOR_MANIFEST],
    [CRAFT_IO_CONNECTOR_MANIFEST.slug, CRAFT_IO_CONNECTOR_MANIFEST],
    [AIRFOCUS_CONNECTOR_MANIFEST.slug, AIRFOCUS_CONNECTOR_MANIFEST],
    [FAVRO_CONNECTOR_MANIFEST.slug, FAVRO_CONNECTOR_MANIFEST],
    [
      PLANVIEW_AGILEPLACE_CONNECTOR_MANIFEST.slug,
      PLANVIEW_AGILEPLACE_CONNECTOR_MANIFEST,
    ],
    [LIQUIDPLANNER_CONNECTOR_MANIFEST.slug, LIQUIDPLANNER_CONNECTOR_MANIFEST],
    [
      WORKFRONT_PLANNING_CONNECTOR_MANIFEST.slug,
      WORKFRONT_PLANNING_CONNECTOR_MANIFEST,
    ],
    [KANTATA_OX_CONNECTOR_MANIFEST.slug, KANTATA_OX_CONNECTOR_MANIFEST],
    [ACCELO_CONNECTOR_MANIFEST.slug, ACCELO_CONNECTOR_MANIFEST],
    [AVAZA_CONNECTOR_MANIFEST.slug, AVAZA_CONNECTOR_MANIFEST],
    [ANYTYPE_CONNECTOR_MANIFEST.slug, ANYTYPE_CONNECTOR_MANIFEST],
    [DROPBOX_CONNECTOR_MANIFEST.slug, DROPBOX_CONNECTOR_MANIFEST],
    [BOX_CONNECTOR_MANIFEST.slug, BOX_CONNECTOR_MANIFEST],
    [THREADS_CONNECTOR_MANIFEST.slug, THREADS_CONNECTOR_MANIFEST],
    [PINTEREST_CONNECTOR_MANIFEST.slug, PINTEREST_CONNECTOR_MANIFEST],
    [TUMBLR_CONNECTOR_MANIFEST.slug, TUMBLR_CONNECTOR_MANIFEST],
    [MASTODON_CONNECTOR_MANIFEST.slug, MASTODON_CONNECTOR_MANIFEST],
    [BLUESKY_CONNECTOR_MANIFEST.slug, BLUESKY_CONNECTOR_MANIFEST],
    [NEXTDOOR_CONNECTOR_MANIFEST.slug, NEXTDOOR_CONNECTOR_MANIFEST],
    [MEETUP_CONNECTOR_MANIFEST.slug, MEETUP_CONNECTOR_MANIFEST],
    [EVENTBRITE_CONNECTOR_MANIFEST.slug, EVENTBRITE_CONNECTOR_MANIFEST],
    [GOLDCAST_CONNECTOR_MANIFEST.slug, GOLDCAST_CONNECTOR_MANIFEST],
    [AIRMEET_CONNECTOR_MANIFEST.slug, AIRMEET_CONNECTOR_MANIFEST],
    [SPLASH_CONNECTOR_MANIFEST.slug, SPLASH_CONNECTOR_MANIFEST],
    [CVENT_CONNECTOR_MANIFEST.slug, CVENT_CONNECTOR_MANIFEST],
    [BIZZABO_CONNECTOR_MANIFEST.slug, BIZZABO_CONNECTOR_MANIFEST],
    [EVENTZILLA_CONNECTOR_MANIFEST.slug, EVENTZILLA_CONNECTOR_MANIFEST],
    [TICKET_TAILOR_CONNECTOR_MANIFEST.slug, TICKET_TAILOR_CONNECTOR_MANIFEST],
    [HUMANITIX_CONNECTOR_MANIFEST.slug, HUMANITIX_CONNECTOR_MANIFEST],
    [BUILDIUM_CONNECTOR_MANIFEST.slug, BUILDIUM_CONNECTOR_MANIFEST],
    [SESSIONIZE_CONNECTOR_MANIFEST.slug, SESSIONIZE_CONNECTOR_MANIFEST],
    [PRETIX_CONNECTOR_MANIFEST.slug, PRETIX_CONNECTOR_MANIFEST],
    [DONORBOX_CONNECTOR_MANIFEST.slug, DONORBOX_CONNECTOR_MANIFEST],
    [LUMA_CONNECTOR_MANIFEST.slug, LUMA_CONNECTOR_MANIFEST],
    [HOPIN_CONNECTOR_MANIFEST.slug, HOPIN_CONNECTOR_MANIFEST],
    [WEBEX_CONNECTOR_MANIFEST.slug, WEBEX_CONNECTOR_MANIFEST],
    [GOTO_MEETING_CONNECTOR_MANIFEST.slug, GOTO_MEETING_CONNECTOR_MANIFEST],
    [RINGCENTRAL_CONNECTOR_MANIFEST.slug, RINGCENTRAL_CONNECTOR_MANIFEST],
    [DIALPAD_CONNECTOR_MANIFEST.slug, DIALPAD_CONNECTOR_MANIFEST],
    [AIRCALL_CONNECTOR_MANIFEST.slug, AIRCALL_CONNECTOR_MANIFEST],
    [OPENPHONE_CONNECTOR_MANIFEST.slug, OPENPHONE_CONNECTOR_MANIFEST],
    [TWILIO_CONNECTOR_MANIFEST.slug, TWILIO_CONNECTOR_MANIFEST],
    [VONAGE_CONNECTOR_MANIFEST.slug, VONAGE_CONNECTOR_MANIFEST],
    [MESSAGEBIRD_CONNECTOR_MANIFEST.slug, MESSAGEBIRD_CONNECTOR_MANIFEST],
    [FRED_CONNECTOR_MANIFEST.slug, FRED_CONNECTOR_MANIFEST],
    [
      APOLLO_GRAPHQL_STUDIO_CONNECTOR_MANIFEST.slug,
      APOLLO_GRAPHQL_STUDIO_CONNECTOR_MANIFEST,
    ],
    [HUNTER_IO_CONNECTOR_MANIFEST.slug, HUNTER_IO_CONNECTOR_MANIFEST],
    [SNOV_IO_CONNECTOR_MANIFEST.slug, SNOV_IO_CONNECTOR_MANIFEST],
    [LUSHA_CONNECTOR_MANIFEST.slug, LUSHA_CONNECTOR_MANIFEST],
    [LEADIQ_CONNECTOR_MANIFEST.slug, LEADIQ_CONNECTOR_MANIFEST],
    [SEAMLESS_AI_CONNECTOR_MANIFEST.slug, SEAMLESS_AI_CONNECTOR_MANIFEST],
    [ROCKETREACH_CONNECTOR_MANIFEST.slug, ROCKETREACH_CONNECTOR_MANIFEST],
    [UPLEAD_CONNECTOR_MANIFEST.slug, UPLEAD_CONNECTOR_MANIFEST],
    [WIZA_CONNECTOR_MANIFEST.slug, WIZA_CONNECTOR_MANIFEST],
    [LINE_CONNECTOR_MANIFEST.slug, LINE_CONNECTOR_MANIFEST],
    [TWIST_CONNECTOR_MANIFEST.slug, TWIST_CONNECTOR_MANIFEST],
    [ZOHO_MAIL_CONNECTOR_MANIFEST.slug, ZOHO_MAIL_CONNECTOR_MANIFEST],
    [SLACK_CONNECTOR_MANIFEST.slug, SLACK_CONNECTOR_MANIFEST],
    [MAILGUN_CONNECTOR_MANIFEST.slug, MAILGUN_CONNECTOR_MANIFEST],
    [SENDGRID_CONNECTOR_MANIFEST.slug, SENDGRID_CONNECTOR_MANIFEST],
    [POSTMARK_CONNECTOR_MANIFEST.slug, POSTMARK_CONNECTOR_MANIFEST],
    [RESEND_CONNECTOR_MANIFEST.slug, RESEND_CONNECTOR_MANIFEST],
    [SPARKPOST_CONNECTOR_MANIFEST.slug, SPARKPOST_CONNECTOR_MANIFEST],
    [BREVO_CONNECTOR_MANIFEST.slug, BREVO_CONNECTOR_MANIFEST],
    [SINCH_MAILJET_CONNECTOR_MANIFEST.slug, SINCH_MAILJET_CONNECTOR_MANIFEST],
    [EVERNOTE_CONNECTOR_MANIFEST.slug, EVERNOTE_CONNECTOR_MANIFEST],
    [FUSEBASE_CONNECTOR_MANIFEST.slug, FUSEBASE_CONNECTOR_MANIFEST],
    [ATLASSIAN_ROVO_CONNECTOR_MANIFEST.slug, ATLASSIAN_ROVO_CONNECTOR_MANIFEST],
    [OPSGENIE_CLOUD_CONNECTOR_MANIFEST.slug, OPSGENIE_CLOUD_CONNECTOR_MANIFEST],
    [
      STATUSPAGE_CLOUD_CONNECTOR_MANIFEST.slug,
      STATUSPAGE_CLOUD_CONNECTOR_MANIFEST,
    ],
    [MEM_CONNECTOR_MANIFEST.slug, MEM_CONNECTOR_MANIFEST],
    [REFLECT_CONNECTOR_MANIFEST.slug, REFLECT_CONNECTOR_MANIFEST],
    [READWISE_CONNECTOR_MANIFEST.slug, READWISE_CONNECTOR_MANIFEST],
    [RAINDROP_IO_CONNECTOR_MANIFEST.slug, RAINDROP_IO_CONNECTOR_MANIFEST],
    [INSTAPAPER_CONNECTOR_MANIFEST.slug, INSTAPAPER_CONNECTOR_MANIFEST],
    [FEEDLY_CONNECTOR_MANIFEST.slug, FEEDLY_CONNECTOR_MANIFEST],
    [INOREADER_CONNECTOR_MANIFEST.slug, INOREADER_CONNECTOR_MANIFEST],
    [README_CONNECTOR_MANIFEST.slug, README_CONNECTOR_MANIFEST],
    [GURU_CONNECTOR_MANIFEST.slug, GURU_CONNECTOR_MANIFEST],
    [SLITE_CONNECTOR_MANIFEST.slug, SLITE_CONNECTOR_MANIFEST],
    [SLAB_CONNECTOR_MANIFEST.slug, SLAB_CONNECTOR_MANIFEST],
    [CONFLUENCE_CONNECTOR_MANIFEST.slug, CONFLUENCE_CONNECTOR_MANIFEST],
    [QUIP_CONNECTOR_MANIFEST.slug, QUIP_CONNECTOR_MANIFEST],
    [NUCLINO_CONNECTOR_MANIFEST.slug, NUCLINO_CONNECTOR_MANIFEST],
    [DOCUMENT360_CONNECTOR_MANIFEST.slug, DOCUMENT360_CONNECTOR_MANIFEST],
    [ARCHBEE_CONNECTOR_MANIFEST.slug, ARCHBEE_CONNECTOR_MANIFEST],
    [TETTRA_CONNECTOR_MANIFEST.slug, TETTRA_CONNECTOR_MANIFEST],
    [KNOWLEDGEOWL_CONNECTOR_MANIFEST.slug, KNOWLEDGEOWL_CONNECTOR_MANIFEST],
    [SCRIBE_CONNECTOR_MANIFEST.slug, SCRIBE_CONNECTOR_MANIFEST],
    [VIDYARD_CONNECTOR_MANIFEST.slug, VIDYARD_CONNECTOR_MANIFEST],
    [VIMEO_CONNECTOR_MANIFEST.slug, VIMEO_CONNECTOR_MANIFEST],
    [WISTIA_CONNECTOR_MANIFEST.slug, WISTIA_CONNECTOR_MANIFEST],
    [FRAME_IO_CONNECTOR_MANIFEST.slug, FRAME_IO_CONNECTOR_MANIFEST],
    [DESCRIPT_CONNECTOR_MANIFEST.slug, DESCRIPT_CONNECTOR_MANIFEST],
    [REV_CONNECTOR_MANIFEST.slug, REV_CONNECTOR_MANIFEST],
    [BUZZSPROUT_CONNECTOR_MANIFEST.slug, BUZZSPROUT_CONNECTOR_MANIFEST],
    [CAPTIVATE_FM_CONNECTOR_MANIFEST.slug, CAPTIVATE_FM_CONNECTOR_MANIFEST],
    [TRANSISTOR_FM_CONNECTOR_MANIFEST.slug, TRANSISTOR_FM_CONNECTOR_MANIFEST],
    [RIVERSIDE_FM_CONNECTOR_MANIFEST.slug, RIVERSIDE_FM_CONNECTOR_MANIFEST],
    [RESTREAM_CONNECTOR_MANIFEST.slug, RESTREAM_CONNECTOR_MANIFEST],
    [COMMON_ROOM_CONNECTOR_MANIFEST.slug, COMMON_ROOM_CONNECTOR_MANIFEST],
    [
      SLACK_ENTERPRISE_GRID_CONNECTOR_MANIFEST.slug,
      SLACK_ENTERPRISE_GRID_CONNECTOR_MANIFEST,
    ],
    [SLACK_CANVAS_CONNECTOR_MANIFEST.slug, SLACK_CANVAS_CONNECTOR_MANIFEST],
    [SLACK_LISTS_CONNECTOR_MANIFEST.slug, SLACK_LISTS_CONNECTOR_MANIFEST],
    [TEAMS_PHONE_CONNECTOR_MANIFEST.slug, TEAMS_PHONE_CONNECTOR_MANIFEST],
    [ZOOM_PHONE_CONNECTOR_MANIFEST.slug, ZOOM_PHONE_CONNECTOR_MANIFEST],
    [ZOOM_ROOMS_CONNECTOR_MANIFEST.slug, ZOOM_ROOMS_CONNECTOR_MANIFEST],
    [ZOOM_WEBINARS_CONNECTOR_MANIFEST.slug, ZOOM_WEBINARS_CONNECTOR_MANIFEST],
    [ZOOM_EVENTS_CONNECTOR_MANIFEST.slug, ZOOM_EVENTS_CONNECTOR_MANIFEST],
    [WEBEX_CALLING_CONNECTOR_MANIFEST.slug, WEBEX_CALLING_CONNECTOR_MANIFEST],
    [GOTO_WEBINAR_CONNECTOR_MANIFEST.slug, GOTO_WEBINAR_CONNECTOR_MANIFEST],
    [LIVESTORM_CONNECTOR_MANIFEST.slug, LIVESTORM_CONNECTOR_MANIFEST],
    [DEMIO_CONNECTOR_MANIFEST.slug, DEMIO_CONNECTOR_MANIFEST],
    [BIGMARKER_CONNECTOR_MANIFEST.slug, BIGMARKER_CONNECTOR_MANIFEST],
    [OTTER_AI_CONNECTOR_MANIFEST.slug, OTTER_AI_CONNECTOR_MANIFEST],
    [FIREFLIES_AI_CONNECTOR_MANIFEST.slug, FIREFLIES_AI_CONNECTOR_MANIFEST],
    [FATHOM_CONNECTOR_MANIFEST.slug, FATHOM_CONNECTOR_MANIFEST],
    [BONSAI_CONNECTOR_MANIFEST.slug, BONSAI_CONNECTOR_MANIFEST],
    [TL_DV_CONNECTOR_MANIFEST.slug, TL_DV_CONNECTOR_MANIFEST],
    [GRAIN_CONNECTOR_MANIFEST.slug, GRAIN_CONNECTOR_MANIFEST],
    [WHIMSICAL_CONNECTOR_MANIFEST.slug, WHIMSICAL_CONNECTOR_MANIFEST],
    [DRAW_IO_CONNECTOR_MANIFEST.slug, DRAW_IO_CONNECTOR_MANIFEST],
    [MINDMEISTER_CONNECTOR_MANIFEST.slug, MINDMEISTER_CONNECTOR_MANIFEST],
    [XMIND_CONNECTOR_MANIFEST.slug, XMIND_CONNECTOR_MANIFEST],
    [
      ADOBE_ANALYTICS_CONNECTOR_MANIFEST.slug,
      ADOBE_ANALYTICS_CONNECTOR_MANIFEST,
    ],
    [
      ADOBE_MARKETO_ENGAGE_CONNECTOR_MANIFEST.slug,
      ADOBE_MARKETO_ENGAGE_CONNECTOR_MANIFEST,
    ],
    [ADOBE_TARGET_CONNECTOR_MANIFEST.slug, ADOBE_TARGET_CONNECTOR_MANIFEST],
    [OSANO_CONNECTOR_MANIFEST.slug, OSANO_CONNECTOR_MANIFEST],
    [SECUREFRAME_CONNECTOR_MANIFEST.slug, SECUREFRAME_CONNECTOR_MANIFEST],
    [VANTA_CONNECTOR_MANIFEST.slug, VANTA_CONNECTOR_MANIFEST],
    [DRATA_CONNECTOR_MANIFEST.slug, DRATA_CONNECTOR_MANIFEST],
    [SPRINTO_CONNECTOR_MANIFEST.slug, SPRINTO_CONNECTOR_MANIFEST],
    [HYPERPROOF_CONNECTOR_MANIFEST.slug, HYPERPROOF_CONNECTOR_MANIFEST],
    [WORKIVA_CONNECTOR_MANIFEST.slug, WORKIVA_CONNECTOR_MANIFEST],
    [CARTA_CONNECTOR_MANIFEST.slug, CARTA_CONNECTOR_MANIFEST],
    [SHAREWORKS_CONNECTOR_MANIFEST.slug, SHAREWORKS_CONNECTOR_MANIFEST],
    [LEDGY_CONNECTOR_MANIFEST.slug, LEDGY_CONNECTOR_MANIFEST],
    [PADLET_CONNECTOR_MANIFEST.slug, PADLET_CONNECTOR_MANIFEST],
    [DROPBOX_PAPER_CONNECTOR_MANIFEST.slug, DROPBOX_PAPER_CONNECTOR_MANIFEST],
    [ZOHO_WORKDRIVE_CONNECTOR_MANIFEST.slug, ZOHO_WORKDRIVE_CONNECTOR_MANIFEST],
    [EGNYTE_CONNECTOR_MANIFEST.slug, EGNYTE_CONNECTOR_MANIFEST],
    [SHAREFILE_CONNECTOR_MANIFEST.slug, SHAREFILE_CONNECTOR_MANIFEST],
    [DEPUTY_CONNECTOR_MANIFEST.slug, DEPUTY_CONNECTOR_MANIFEST],
    [HOMEBASE_CONNECTOR_MANIFEST.slug, HOMEBASE_CONNECTOR_MANIFEST],
    [SEVEN_SHIFTS_CONNECTOR_MANIFEST.slug, SEVEN_SHIFTS_CONNECTOR_MANIFEST],
    [RESOURCE_GURU_CONNECTOR_MANIFEST.slug, RESOURCE_GURU_CONNECTOR_MANIFEST],
    [RUNN_CONNECTOR_MANIFEST.slug, RUNN_CONNECTOR_MANIFEST],
    [EVERHOUR_CONNECTOR_MANIFEST.slug, EVERHOUR_CONNECTOR_MANIFEST],
    [
      TIMELY_TIME_TRACKING_CONNECTOR_MANIFEST.slug,
      TIMELY_TIME_TRACKING_CONNECTOR_MANIFEST,
    ],
    [DONATELY_CONNECTOR_MANIFEST.slug, DONATELY_CONNECTOR_MANIFEST],
    [FUNDRAISE_UP_CONNECTOR_MANIFEST.slug, FUNDRAISE_UP_CONNECTOR_MANIFEST],
    [VIRTUOUS_CRM_CONNECTOR_MANIFEST.slug, VIRTUOUS_CRM_CONNECTOR_MANIFEST],
    [EVERYACTION_CONNECTOR_MANIFEST.slug, EVERYACTION_CONNECTOR_MANIFEST],
    [NATIONBUILDER_CONNECTOR_MANIFEST.slug, NATIONBUILDER_CONNECTOR_MANIFEST],
    [ACTBLUE_CONNECTOR_MANIFEST.slug, ACTBLUE_CONNECTOR_MANIFEST],
    [MOBILIZE_CONNECTOR_MANIFEST.slug, MOBILIZE_CONNECTOR_MANIFEST],
    [ACTION_NETWORK_CONNECTOR_MANIFEST.slug, ACTION_NETWORK_CONNECTOR_MANIFEST],
    [
      CONSTANT_CONTACT_LEAD_GEN_CONNECTOR_MANIFEST.slug,
      CONSTANT_CONTACT_LEAD_GEN_CONNECTOR_MANIFEST,
    ],
    [RESCUETIME_CONNECTOR_MANIFEST.slug, RESCUETIME_CONNECTOR_MANIFEST],
    [TIME_DOCTOR_CONNECTOR_MANIFEST.slug, TIME_DOCTOR_CONNECTOR_MANIFEST],
    [HUBSTAFF_CONNECTOR_MANIFEST.slug, HUBSTAFF_CONNECTOR_MANIFEST],
    [
      QUICKBOOKS_TIME_CONNECTOR_MANIFEST.slug,
      QUICKBOOKS_TIME_CONNECTOR_MANIFEST,
    ],
    [REPLICON_CONNECTOR_MANIFEST.slug, REPLICON_CONNECTOR_MANIFEST],
    [ACTITIME_CONNECTOR_MANIFEST.slug, ACTITIME_CONNECTOR_MANIFEST],
    [TRACKINGTIME_CONNECTOR_MANIFEST.slug, TRACKINGTIME_CONNECTOR_MANIFEST],
    [ONTRAPORT_CONNECTOR_MANIFEST.slug, ONTRAPORT_CONNECTOR_MANIFEST],
    [BITRIX24_CONNECTOR_MANIFEST.slug, BITRIX24_CONNECTOR_MANIFEST],
    [AGILE_CRM_CONNECTOR_MANIFEST.slug, AGILE_CRM_CONNECTOR_MANIFEST],
    [STREAK_CONNECTOR_MANIFEST.slug, STREAK_CONNECTOR_MANIFEST],
    [
      LESS_ANNOYING_CRM_CONNECTOR_MANIFEST.slug,
      LESS_ANNOYING_CRM_CONNECTOR_MANIFEST,
    ],
    [NUTSHELL_CONNECTOR_MANIFEST.slug, NUTSHELL_CONNECTOR_MANIFEST],
    [TEAMLEADER_CONNECTOR_MANIFEST.slug, TEAMLEADER_CONNECTOR_MANIFEST],
    [SCORO_CONNECTOR_MANIFEST.slug, SCORO_CONNECTOR_MANIFEST],
    [ODOO_CONNECTOR_MANIFEST.slug, ODOO_CONNECTOR_MANIFEST],
    [NETSUITE_CONNECTOR_MANIFEST.slug, NETSUITE_CONNECTOR_MANIFEST],
    [
      SAGE_ACCOUNTING_CONNECTOR_MANIFEST.slug,
      SAGE_ACCOUNTING_CONNECTOR_MANIFEST,
    ],
    [SAGE_INTACCT_CONNECTOR_MANIFEST.slug, SAGE_INTACCT_CONNECTOR_MANIFEST],
    [MYOB_CONNECTOR_MANIFEST.slug, MYOB_CONNECTOR_MANIFEST],
    [KASHFLOW_CONNECTOR_MANIFEST.slug, KASHFLOW_CONNECTOR_MANIFEST],
    [ZOHO_BOOKS_CONNECTOR_MANIFEST.slug, ZOHO_BOOKS_CONNECTOR_MANIFEST],
    [ZOHO_INVOICE_CONNECTOR_MANIFEST.slug, ZOHO_INVOICE_CONNECTOR_MANIFEST],
    [ZOHO_EXPENSE_CONNECTOR_MANIFEST.slug, ZOHO_EXPENSE_CONNECTOR_MANIFEST],
    [ZOHO_DESK_CONNECTOR_MANIFEST.slug, ZOHO_DESK_CONNECTOR_MANIFEST],
    [ZOHO_PROJECTS_CONNECTOR_MANIFEST.slug, ZOHO_PROJECTS_CONNECTOR_MANIFEST],
    [CLAY_CONNECTOR_MANIFEST.slug, CLAY_CONNECTOR_MANIFEST],
    [CLAYGENT_CONNECTOR_MANIFEST.slug, CLAYGENT_CONNECTOR_MANIFEST],
    [PHANTOMBUSTER_CONNECTOR_MANIFEST.slug, PHANTOMBUSTER_CONNECTOR_MANIFEST],
    [TEXAU_CONNECTOR_MANIFEST.slug, TEXAU_CONNECTOR_MANIFEST],
    [EVABOOT_CONNECTOR_MANIFEST.slug, EVABOOT_CONNECTOR_MANIFEST],
    [LEMLIST_CONNECTOR_MANIFEST.slug, LEMLIST_CONNECTOR_MANIFEST],
    [MAILSHAKE_CONNECTOR_MANIFEST.slug, MAILSHAKE_CONNECTOR_MANIFEST],
    [WOODPECKER_CONNECTOR_MANIFEST.slug, WOODPECKER_CONNECTOR_MANIFEST],
    [REPLY_IO_CONNECTOR_MANIFEST.slug, REPLY_IO_CONNECTOR_MANIFEST],
    [MIXMAX_CONNECTOR_MANIFEST.slug, MIXMAX_CONNECTOR_MANIFEST],
    [CIRRUS_INSIGHT_CONNECTOR_MANIFEST.slug, CIRRUS_INSIGHT_CONNECTOR_MANIFEST],
    [SPOTIO_CONNECTOR_MANIFEST.slug, SPOTIO_CONNECTOR_MANIFEST],
    [MY_HOURS_CONNECTOR_MANIFEST.slug, MY_HOURS_CONNECTOR_MANIFEST],
    [PAPERFORM_CONNECTOR_MANIFEST.slug, PAPERFORM_CONNECTOR_MANIFEST],
    [JOTFORM_CONNECTOR_MANIFEST.slug, JOTFORM_CONNECTOR_MANIFEST],
    [FORMSTACK_CONNECTOR_MANIFEST.slug, FORMSTACK_CONNECTOR_MANIFEST],
    [SURVEYMONKEY_CONNECTOR_MANIFEST.slug, SURVEYMONKEY_CONNECTOR_MANIFEST],
    [FILLOUT_CONNECTOR_MANIFEST.slug, FILLOUT_CONNECTOR_MANIFEST],
    [TALLY_CONNECTOR_MANIFEST.slug, TALLY_CONNECTOR_MANIFEST],
    [MAILCHIMP_CONNECTOR_MANIFEST.slug, MAILCHIMP_CONNECTOR_MANIFEST],
    [KLAVIYO_CONNECTOR_MANIFEST.slug, KLAVIYO_CONNECTOR_MANIFEST],
    [CONVERTKIT_CONNECTOR_MANIFEST.slug, CONVERTKIT_CONNECTOR_MANIFEST],
    [
      CAMPAIGN_MONITOR_CONNECTOR_MANIFEST.slug,
      CAMPAIGN_MONITOR_CONNECTOR_MANIFEST,
    ],
    [
      CONSTANT_CONTACT_CONNECTOR_MANIFEST.slug,
      CONSTANT_CONTACT_CONNECTOR_MANIFEST,
    ],
    [ACTIVECAMPAIGN_CONNECTOR_MANIFEST.slug, ACTIVECAMPAIGN_CONNECTOR_MANIFEST],
    [CUSTOMER_IO_CONNECTOR_MANIFEST.slug, CUSTOMER_IO_CONNECTOR_MANIFEST],
    [BRAZE_CONNECTOR_MANIFEST.slug, BRAZE_CONNECTOR_MANIFEST],
    [
      SEGMENT_PERSONAS_CONNECTOR_MANIFEST.slug,
      SEGMENT_PERSONAS_CONNECTOR_MANIFEST,
    ],
    [MIXPANEL_CONNECTOR_MANIFEST.slug, MIXPANEL_CONNECTOR_MANIFEST],
    [AMPLITUDE_CONNECTOR_MANIFEST.slug, AMPLITUDE_CONNECTOR_MANIFEST],
    [PENDO_CONNECTOR_MANIFEST.slug, PENDO_CONNECTOR_MANIFEST],
    [POSTHOG_CONNECTOR_MANIFEST.slug, POSTHOG_CONNECTOR_MANIFEST],
    [SENTRY_CONNECTOR_MANIFEST.slug, SENTRY_CONNECTOR_MANIFEST],
    [COGNITO_FORMS_CONNECTOR_MANIFEST.slug, COGNITO_FORMS_CONNECTOR_MANIFEST],
    [WUFOO_CONNECTOR_MANIFEST.slug, WUFOO_CONNECTOR_MANIFEST],
    [GRAVITY_FORMS_CONNECTOR_MANIFEST.slug, GRAVITY_FORMS_CONNECTOR_MANIFEST],
    [NINJA_FORMS_CONNECTOR_MANIFEST.slug, NINJA_FORMS_CONNECTOR_MANIFEST],
    [WPFORMS_CONNECTOR_MANIFEST.slug, WPFORMS_CONNECTOR_MANIFEST],
    [ALCHEMER_CONNECTOR_MANIFEST.slug, ALCHEMER_CONNECTOR_MANIFEST],
    [QUALTRICS_CONNECTOR_MANIFEST.slug, QUALTRICS_CONNECTOR_MANIFEST],
    [ASKNICELY_CONNECTOR_MANIFEST.slug, ASKNICELY_CONNECTOR_MANIFEST],
    [DELIGHTED_CONNECTOR_MANIFEST.slug, DELIGHTED_CONNECTOR_MANIFEST],
    [REFINER_CONNECTOR_MANIFEST.slug, REFINER_CONNECTOR_MANIFEST],
    [HOTJAR_CONNECTOR_MANIFEST.slug, HOTJAR_CONNECTOR_MANIFEST],
    [USERTESTING_CONNECTOR_MANIFEST.slug, USERTESTING_CONNECTOR_MANIFEST],
    [MAZE_CONNECTOR_MANIFEST.slug, MAZE_CONNECTOR_MANIFEST],
    [LOOKBACK_CONNECTOR_MANIFEST.slug, LOOKBACK_CONNECTOR_MANIFEST],
    [
      USER_INTERVIEWS_CONNECTOR_MANIFEST.slug,
      USER_INTERVIEWS_CONNECTOR_MANIFEST,
    ],
    [RESPONDENT_CONNECTOR_MANIFEST.slug, RESPONDENT_CONNECTOR_MANIFEST],
    [DOVETAIL_CONNECTOR_MANIFEST.slug, DOVETAIL_CONNECTOR_MANIFEST],
    [SPRIG_CONNECTOR_MANIFEST.slug, SPRIG_CONNECTOR_MANIFEST],
    [AIRTABLE_FORMS_CONNECTOR_MANIFEST.slug, AIRTABLE_FORMS_CONNECTOR_MANIFEST],
    [DOCUSIGN_CLM_CONNECTOR_MANIFEST.slug, DOCUSIGN_CLM_CONNECTOR_MANIFEST],
    [REWARDFUL_CONNECTOR_MANIFEST.slug, REWARDFUL_CONNECTOR_MANIFEST],
    [FIRSTPROMOTER_CONNECTOR_MANIFEST.slug, FIRSTPROMOTER_CONNECTOR_MANIFEST],
    [APOLLO_IO_CONNECTOR_MANIFEST.slug, APOLLO_IO_CONNECTOR_MANIFEST],
    [OUTREACH_CONNECTOR_MANIFEST.slug, OUTREACH_CONNECTOR_MANIFEST],
    [SALESLOFT_CONNECTOR_MANIFEST.slug, SALESLOFT_CONNECTOR_MANIFEST],
    [GONG_CONNECTOR_MANIFEST.slug, GONG_CONNECTOR_MANIFEST],
    [CHORUS_AI_CONNECTOR_MANIFEST.slug, CHORUS_AI_CONNECTOR_MANIFEST],
    [CLARI_CONNECTOR_MANIFEST.slug, CLARI_CONNECTOR_MANIFEST],
    [PEOPLE_AI_CONNECTOR_MANIFEST.slug, PEOPLE_AI_CONNECTOR_MANIFEST],
    [COGNISM_CONNECTOR_MANIFEST.slug, COGNISM_CONNECTOR_MANIFEST],
    [ZOOMINFO_CONNECTOR_MANIFEST.slug, ZOOMINFO_CONNECTOR_MANIFEST],
    [CLEARBIT_CONNECTOR_MANIFEST.slug, CLEARBIT_CONNECTOR_MANIFEST],
    [LEADFEEDER_CONNECTOR_MANIFEST.slug, LEADFEEDER_CONNECTOR_MANIFEST],
    [UNBOUNCE_CONNECTOR_MANIFEST.slug, UNBOUNCE_CONNECTOR_MANIFEST],
    [INSTAPAGE_CONNECTOR_MANIFEST.slug, INSTAPAGE_CONNECTOR_MANIFEST],
    [OPTIMIZELY_CONNECTOR_MANIFEST.slug, OPTIMIZELY_CONNECTOR_MANIFEST],
    [VWO_CONNECTOR_MANIFEST.slug, VWO_CONNECTOR_MANIFEST],
    [AB_TASTY_CONNECTOR_MANIFEST.slug, AB_TASTY_CONNECTOR_MANIFEST],
    [FULLSTORY_CONNECTOR_MANIFEST.slug, FULLSTORY_CONNECTOR_MANIFEST],
    [PCLOUD_CONNECTOR_MANIFEST.slug, PCLOUD_CONNECTOR_MANIFEST],
    [TRESORIT_CONNECTOR_MANIFEST.slug, TRESORIT_CONNECTOR_MANIFEST],
    [HIGHTAIL_CONNECTOR_MANIFEST.slug, HIGHTAIL_CONNECTOR_MANIFEST],
    [FILESTACK_CONNECTOR_MANIFEST.slug, FILESTACK_CONNECTOR_MANIFEST],
    [IMGIX_CONNECTOR_MANIFEST.slug, IMGIX_CONNECTOR_MANIFEST],
    [BYNDER_CONNECTOR_MANIFEST.slug, BYNDER_CONNECTOR_MANIFEST],
    [BRANDFOLDER_CONNECTOR_MANIFEST.slug, BRANDFOLDER_CONNECTOR_MANIFEST],
    [CANTO_CONNECTOR_MANIFEST.slug, CANTO_CONNECTOR_MANIFEST],
    [FRONTIFY_CONNECTOR_MANIFEST.slug, FRONTIFY_CONNECTOR_MANIFEST],
    [ASSET_BANK_CONNECTOR_MANIFEST.slug, ASSET_BANK_CONNECTOR_MANIFEST],
    [
      WIDEN_COLLECTIVE_CONNECTOR_MANIFEST.slug,
      WIDEN_COLLECTIVE_CONNECTOR_MANIFEST,
    ],
    [KONTAINER_CONNECTOR_MANIFEST.slug, KONTAINER_CONNECTOR_MANIFEST],
    [JIRA_ALIGN_CONNECTOR_MANIFEST.slug, JIRA_ALIGN_CONNECTOR_MANIFEST],
    [
      ATLASSIAN_COMPASS_CONNECTOR_MANIFEST.slug,
      ATLASSIAN_COMPASS_CONNECTOR_MANIFEST,
    ],
    [DAMINION_CONNECTOR_MANIFEST.slug, DAMINION_CONNECTOR_MANIFEST],
    [MS_PROJECT_CONNECTOR_MANIFEST.slug, MS_PROJECT_CONNECTOR_MANIFEST],
    [
      MICROSOFT_DYNAMICS_365_SALES_CONNECTOR_MANIFEST.slug,
      MICROSOFT_DYNAMICS_365_SALES_CONNECTOR_MANIFEST,
    ],
    [
      MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_CONNECTOR_MANIFEST.slug,
      MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_CONNECTOR_MANIFEST,
    ],
    [
      MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_CONNECTOR_MANIFEST.slug,
      MICROSOFT_DYNAMICS_365_BUSINESS_CENTRAL_CONNECTOR_MANIFEST,
    ],
    [
      MICROSOFT_ENTRA_ID_CONNECTOR_MANIFEST.slug,
      MICROSOFT_ENTRA_ID_CONNECTOR_MANIFEST,
    ],
    [YAMMER_CONNECTOR_MANIFEST.slug, YAMMER_CONNECTOR_MANIFEST],
    [VIVA_LEARNING_CONNECTOR_MANIFEST.slug, VIVA_LEARNING_CONNECTOR_MANIFEST],
    [JIRA_CONNECTOR_MANIFEST.slug, JIRA_CONNECTOR_MANIFEST],
    [
      JIRA_SERVICE_MANAGEMENT_CONNECTOR_MANIFEST.slug,
      JIRA_SERVICE_MANAGEMENT_CONNECTOR_MANIFEST,
    ],
    [PRODUCTBOARD_CONNECTOR_MANIFEST.slug, PRODUCTBOARD_CONNECTOR_MANIFEST],
    [AHA_CONNECTOR_MANIFEST.slug, AHA_CONNECTOR_MANIFEST],
    [ROADMUNK_CONNECTOR_MANIFEST.slug, ROADMUNK_CONNECTOR_MANIFEST],
    [SHORTCUT_CONNECTOR_MANIFEST.slug, SHORTCUT_CONNECTOR_MANIFEST],
    [HIVE_CONNECTOR_MANIFEST.slug, HIVE_CONNECTOR_MANIFEST],
    [NIFTY_CONNECTOR_MANIFEST.slug, NIFTY_CONNECTOR_MANIFEST],
    [PAYMO_CONNECTOR_MANIFEST.slug, PAYMO_CONNECTOR_MANIFEST],
    [KRAKEN_CONNECTOR_MANIFEST.slug, KRAKEN_CONNECTOR_MANIFEST],
    [BINANCE_CONNECTOR_MANIFEST.slug, BINANCE_CONNECTOR_MANIFEST],
    [GEMINI_CONNECTOR_MANIFEST.slug, GEMINI_CONNECTOR_MANIFEST],
    [PROOFHUB_CONNECTOR_MANIFEST.slug, PROOFHUB_CONNECTOR_MANIFEST],
    [PROOF_CONNECTOR_MANIFEST.slug, PROOF_CONNECTOR_MANIFEST],
    [TERMLY_CONNECTOR_MANIFEST.slug, TERMLY_CONNECTOR_MANIFEST],
    [COOKIEBOT_CONNECTOR_MANIFEST.slug, COOKIEBOT_CONNECTOR_MANIFEST],
    [ONETRUST_CONNECTOR_MANIFEST.slug, ONETRUST_CONNECTOR_MANIFEST],
    [
      SALESFORCE_MARKETING_CLOUD_CONNECTOR_MANIFEST.slug,
      SALESFORCE_MARKETING_CLOUD_CONNECTOR_MANIFEST,
    ],
    [
      SALESFORCE_COMMERCE_CLOUD_CONNECTOR_MANIFEST.slug,
      SALESFORCE_COMMERCE_CLOUD_CONNECTOR_MANIFEST,
    ],
    [MARKETO_CONNECTOR_MANIFEST.slug, MARKETO_CONNECTOR_MANIFEST],
    [PARDOT_CONNECTOR_MANIFEST.slug, PARDOT_CONNECTOR_MANIFEST],
    [ELOQUA_CONNECTOR_MANIFEST.slug, ELOQUA_CONNECTOR_MANIFEST],
    [DRIP_CONNECTOR_MANIFEST.slug, DRIP_CONNECTOR_MANIFEST],
    [MAILERLITE_CONNECTOR_MANIFEST.slug, MAILERLITE_CONNECTOR_MANIFEST],
    [AWEBER_CONNECTOR_MANIFEST.slug, AWEBER_CONNECTOR_MANIFEST],
    [GETRESPONSE_CONNECTOR_MANIFEST.slug, GETRESPONSE_CONNECTOR_MANIFEST],
    [MOOSEND_CONNECTOR_MANIFEST.slug, MOOSEND_CONNECTOR_MANIFEST],
    [OMNISEND_CONNECTOR_MANIFEST.slug, OMNISEND_CONNECTOR_MANIFEST],
    [MAILERCLOUD_CONNECTOR_MANIFEST.slug, MAILERCLOUD_CONNECTOR_MANIFEST],
    [
      BENCHMARK_EMAIL_CONNECTOR_MANIFEST.slug,
      BENCHMARK_EMAIL_CONNECTOR_MANIFEST,
    ],
    [EMMA_CONNECTOR_MANIFEST.slug, EMMA_CONNECTOR_MANIFEST],
    [FLODESK_CONNECTOR_MANIFEST.slug, FLODESK_CONNECTOR_MANIFEST],
    [HOMEBREW_CONNECTOR_MANIFEST.slug, HOMEBREW_CONNECTOR_MANIFEST],
    [CALIBRE_CONNECTOR_MANIFEST.slug, CALIBRE_CONNECTOR_MANIFEST],
    [
      PLEX_PERSONAL_MEDIA_SERVER_CONNECTOR_MANIFEST.slug,
      PLEX_PERSONAL_MEDIA_SERVER_CONNECTOR_MANIFEST,
    ],
    [JELLYFIN_CONNECTOR_MANIFEST.slug, JELLYFIN_CONNECTOR_MANIFEST],
    [SYNOLOGY_DSM_CONNECTOR_MANIFEST.slug, SYNOLOGY_DSM_CONNECTOR_MANIFEST],
    [
      WORDPRESS_WOOCOMMERCE_SELF_HOSTED_CONNECTOR_MANIFEST.slug,
      WORDPRESS_WOOCOMMERCE_SELF_HOSTED_CONNECTOR_MANIFEST,
    ],
    [
      MAGENTO_SELF_HOSTED_CONNECTOR_MANIFEST.slug,
      MAGENTO_SELF_HOSTED_CONNECTOR_MANIFEST,
    ],
    [
      PRESTASHOP_SELF_HOSTED_CONNECTOR_MANIFEST.slug,
      PRESTASHOP_SELF_HOSTED_CONNECTOR_MANIFEST,
    ],
    [DRUPAL_CONNECTOR_MANIFEST.slug, DRUPAL_CONNECTOR_MANIFEST],
    [JOOMLA_CONNECTOR_MANIFEST.slug, JOOMLA_CONNECTOR_MANIFEST],
    [CONCRETE_CMS_CONNECTOR_MANIFEST.slug, CONCRETE_CMS_CONNECTOR_MANIFEST],
    [CRAFT_CMS_CONNECTOR_MANIFEST.slug, CRAFT_CMS_CONNECTOR_MANIFEST],
    [STATAMIC_CONNECTOR_MANIFEST.slug, STATAMIC_CONNECTOR_MANIFEST],
    [KIRBY_CMS_CONNECTOR_MANIFEST.slug, KIRBY_CMS_CONNECTOR_MANIFEST],
    [
      DIRECTUS_SELF_HOSTED_CONNECTOR_MANIFEST.slug,
      DIRECTUS_SELF_HOSTED_CONNECTOR_MANIFEST,
    ],
    [
      STRAPI_SELF_HOSTED_CONNECTOR_MANIFEST.slug,
      STRAPI_SELF_HOSTED_CONNECTOR_MANIFEST,
    ],
    [
      SUPABASE_SELF_HOSTED_CONNECTOR_MANIFEST.slug,
      SUPABASE_SELF_HOSTED_CONNECTOR_MANIFEST,
    ],
    [MEISTERTASK_CONNECTOR_MANIFEST.slug, MEISTERTASK_CONNECTOR_MANIFEST],
    [NOZBE_CONNECTOR_MANIFEST.slug, NOZBE_CONNECTOR_MANIFEST],
    [ANY_DO_CONNECTOR_MANIFEST.slug, ANY_DO_CONNECTOR_MANIFEST],
    [
      REMEMBER_THE_MILK_CONNECTOR_MANIFEST.slug,
      REMEMBER_THE_MILK_CONNECTOR_MANIFEST,
    ],
    [HABITICA_CONNECTOR_MANIFEST.slug, HABITICA_CONNECTOR_MANIFEST],
    [AMAZING_MARVIN_CONNECTOR_MANIFEST.slug, AMAZING_MARVIN_CONNECTOR_MANIFEST],
    [AKIFLOW_CONNECTOR_MANIFEST.slug, AKIFLOW_CONNECTOR_MANIFEST],
    [SUNSAMA_CONNECTOR_MANIFEST.slug, SUNSAMA_CONNECTOR_MANIFEST],
    [MOTION_CONNECTOR_MANIFEST.slug, MOTION_CONNECTOR_MANIFEST],
    [RECLAIM_AI_CONNECTOR_MANIFEST.slug, RECLAIM_AI_CONNECTOR_MANIFEST],
    [SAVVYCAL_CONNECTOR_MANIFEST.slug, SAVVYCAL_CONNECTOR_MANIFEST],
    [YOUCANBOOKME_CONNECTOR_MANIFEST.slug, YOUCANBOOKME_CONNECTOR_MANIFEST],
    [
      ACUITY_SCHEDULING_CONNECTOR_MANIFEST.slug,
      ACUITY_SCHEDULING_CONNECTOR_MANIFEST,
    ],
    [SIMPLYBOOK_ME_CONNECTOR_MANIFEST.slug, SIMPLYBOOK_ME_CONNECTOR_MANIFEST],
    [ONCEHUB_CONNECTOR_MANIFEST.slug, ONCEHUB_CONNECTOR_MANIFEST],
    [SALESFLARE_CONNECTOR_MANIFEST.slug, SALESFLARE_CONNECTOR_MANIFEST],
    [FOLK_CRM_CONNECTOR_MANIFEST.slug, FOLK_CRM_CONNECTOR_MANIFEST],
    [ONEPAGECRM_CONNECTOR_MANIFEST.slug, ONEPAGECRM_CONNECTOR_MANIFEST],
    [FOLLOW_UP_BOSS_CONNECTOR_MANIFEST.slug, FOLLOW_UP_BOSS_CONNECTOR_MANIFEST],
    [CHIME_CRM_CONNECTOR_MANIFEST.slug, CHIME_CRM_CONNECTOR_MANIFEST],
    [
      REALLY_SIMPLE_SYSTEMS_CONNECTOR_MANIFEST.slug,
      REALLY_SIMPLE_SYSTEMS_CONNECTOR_MANIFEST,
    ],
    [VTIGER_CRM_CONNECTOR_MANIFEST.slug, VTIGER_CRM_CONNECTOR_MANIFEST],
    [SUITECRM_CLOUD_CONNECTOR_MANIFEST.slug, SUITECRM_CLOUD_CONNECTOR_MANIFEST],
    [SUGARCRM_CONNECTOR_MANIFEST.slug, SUGARCRM_CONNECTOR_MANIFEST],
    [CREATIO_CONNECTOR_MANIFEST.slug, CREATIO_CONNECTOR_MANIFEST],
    [ATTIO_CONNECTOR_MANIFEST.slug, ATTIO_CONNECTOR_MANIFEST],
    [ZENDESK_SELL_CONNECTOR_MANIFEST.slug, ZENDESK_SELL_CONNECTOR_MANIFEST],
    [
      KEAP_MAX_CLASSIC_CONNECTOR_MANIFEST.slug,
      KEAP_MAX_CLASSIC_CONNECTOR_MANIFEST,
    ],
    [SETMORE_CONNECTOR_MANIFEST.slug, SETMORE_CONNECTOR_MANIFEST],
    [PLUTIO_CONNECTOR_MANIFEST.slug, PLUTIO_CONNECTOR_MANIFEST],
    [SHOOTPROOF_CONNECTOR_MANIFEST.slug, SHOOTPROOF_CONNECTOR_MANIFEST],
    [SMUGMUG_CONNECTOR_MANIFEST.slug, SMUGMUG_CONNECTOR_MANIFEST],
    [FLICKR_CONNECTOR_MANIFEST.slug, FLICKR_CONNECTOR_MANIFEST],
    [DRIBBBLE_CONNECTOR_MANIFEST.slug, DRIBBBLE_CONNECTOR_MANIFEST],
    [DEVIANTART_CONNECTOR_MANIFEST.slug, DEVIANTART_CONNECTOR_MANIFEST],
    [BANDCAMP_CONNECTOR_MANIFEST.slug, BANDCAMP_CONNECTOR_MANIFEST],
    [MIXCLOUD_CONNECTOR_MANIFEST.slug, MIXCLOUD_CONNECTOR_MANIFEST],
    [AUDIOMACK_CONNECTOR_MANIFEST.slug, AUDIOMACK_CONNECTOR_MANIFEST],
    [AUDIUS_CONNECTOR_MANIFEST.slug, AUDIUS_CONNECTOR_MANIFEST],
    [PODBEAN_CONNECTOR_MANIFEST.slug, PODBEAN_CONNECTOR_MANIFEST],
    [
      MAILCHIMP_TRANSACTIONAL_CONNECTOR_MANIFEST.slug,
      MAILCHIMP_TRANSACTIONAL_CONNECTOR_MANIFEST,
    ],
    [
      MAILCHIMP_SURVEYS_CONNECTOR_MANIFEST.slug,
      MAILCHIMP_SURVEYS_CONNECTOR_MANIFEST,
    ],
    [KLAVIYO_SMS_CONNECTOR_MANIFEST.slug, KLAVIYO_SMS_CONNECTOR_MANIFEST],
    [ATTENTIVE_CONNECTOR_MANIFEST.slug, ATTENTIVE_CONNECTOR_MANIFEST],
    [POSTSCRIPT_CONNECTOR_MANIFEST.slug, POSTSCRIPT_CONNECTOR_MANIFEST],
    [SENDLANE_CONNECTOR_MANIFEST.slug, SENDLANE_CONNECTOR_MANIFEST],
    [ITERABLE_CONNECTOR_MANIFEST.slug, ITERABLE_CONNECTOR_MANIFEST],
    [ITERABLE_SMS_CONNECTOR_MANIFEST.slug, ITERABLE_SMS_CONNECTOR_MANIFEST],
    [ORTTO_CONNECTOR_MANIFEST.slug, ORTTO_CONNECTOR_MANIFEST],
    [VERO_CONNECTOR_MANIFEST.slug, VERO_CONNECTOR_MANIFEST],
    [MESSAGEGEARS_CONNECTOR_MANIFEST.slug, MESSAGEGEARS_CONNECTOR_MANIFEST],
    [MAROPOST_CONNECTOR_MANIFEST.slug, MAROPOST_CONNECTOR_MANIFEST],
    [EMARSYS_CONNECTOR_MANIFEST.slug, EMARSYS_CONNECTOR_MANIFEST],
    [SAILTHRU_CONNECTOR_MANIFEST.slug, SAILTHRU_CONNECTOR_MANIFEST],
    [LISTRAK_CONNECTOR_MANIFEST.slug, LISTRAK_CONNECTOR_MANIFEST],
    [DOTDIGITAL_CONNECTOR_MANIFEST.slug, DOTDIGITAL_CONNECTOR_MANIFEST],
    [
      ACOUSTIC_CAMPAIGN_CONNECTOR_MANIFEST.slug,
      ACOUSTIC_CAMPAIGN_CONNECTOR_MANIFEST,
    ],
    [
      BLOOMREACH_ENGAGEMENT_CONNECTOR_MANIFEST.slug,
      BLOOMREACH_ENGAGEMENT_CONNECTOR_MANIFEST,
    ],
    [MOENGAGE_CONNECTOR_MANIFEST.slug, MOENGAGE_CONNECTOR_MANIFEST],
    [
      SALESFORCE_DATA_CLOUD_CONNECTOR_MANIFEST.slug,
      SALESFORCE_DATA_CLOUD_CONNECTOR_MANIFEST,
    ],
    [
      ADOBE_REAL_TIME_CDP_CONNECTOR_MANIFEST.slug,
      ADOBE_REAL_TIME_CDP_CONNECTOR_MANIFEST,
    ],
    [
      TWILIO_SEGMENT_ENGAGE_CONNECTOR_MANIFEST.slug,
      TWILIO_SEGMENT_ENGAGE_CONNECTOR_MANIFEST,
    ],
    [
      AMPLITUDE_EXPERIMENT_CONNECTOR_MANIFEST.slug,
      AMPLITUDE_EXPERIMENT_CONNECTOR_MANIFEST,
    ],
    [
      MIXPANEL_COHORTS_CONNECTOR_MANIFEST.slug,
      MIXPANEL_COHORTS_CONNECTOR_MANIFEST,
    ],
    [
      POSTHOG_FEATURE_FLAGS_CONNECTOR_MANIFEST.slug,
      POSTHOG_FEATURE_FLAGS_CONNECTOR_MANIFEST,
    ],
    [STATSIG_CONNECTOR_MANIFEST.slug, STATSIG_CONNECTOR_MANIFEST],
    [LAUNCHDARKLY_CONNECTOR_MANIFEST.slug, LAUNCHDARKLY_CONNECTOR_MANIFEST],
    [SPLIT_IO_CONNECTOR_MANIFEST.slug, SPLIT_IO_CONNECTOR_MANIFEST],
    [
      FLAGSMITH_CLOUD_CONNECTOR_MANIFEST.slug,
      FLAGSMITH_CLOUD_CONNECTOR_MANIFEST,
    ],
    [CONFIGCAT_CONNECTOR_MANIFEST.slug, CONFIGCAT_CONNECTOR_MANIFEST],
    [
      GROWTHBOOK_CLOUD_CONNECTOR_MANIFEST.slug,
      GROWTHBOOK_CLOUD_CONNECTOR_MANIFEST,
    ],
    [UNLEASH_CLOUD_CONNECTOR_MANIFEST.slug, UNLEASH_CLOUD_CONNECTOR_MANIFEST],
    [
      OPTIMIZELY_ROLLOUTS_CONNECTOR_MANIFEST.slug,
      OPTIMIZELY_ROLLOUTS_CONNECTOR_MANIFEST,
    ],
    [VWO_TESTING_CONNECTOR_MANIFEST.slug, VWO_TESTING_CONNECTOR_MANIFEST],
    [
      AB_TASTY_FEATURE_EXPERIMENTATION_CONNECTOR_MANIFEST.slug,
      AB_TASTY_FEATURE_EXPERIMENTATION_CONNECTOR_MANIFEST,
    ],
    [
      SQUARE_APPOINTMENTS_CONNECTOR_MANIFEST.slug,
      SQUARE_APPOINTMENTS_CONNECTOR_MANIFEST,
    ],
    [VAGARO_CONNECTOR_MANIFEST.slug, VAGARO_CONNECTOR_MANIFEST],
    [MINDBODY_CONNECTOR_MANIFEST.slug, MINDBODY_CONNECTOR_MANIFEST],
    [JANE_APP_CONNECTOR_MANIFEST.slug, JANE_APP_CONNECTOR_MANIFEST],
    [CLINIKO_CONNECTOR_MANIFEST.slug, CLINIKO_CONNECTOR_MANIFEST],
    [
      PRACTICE_BETTER_CONNECTOR_MANIFEST.slug,
      PRACTICE_BETTER_CONNECTOR_MANIFEST,
    ],
    [HEALTHIE_CONNECTOR_MANIFEST.slug, HEALTHIE_CONNECTOR_MANIFEST],
    [
      CERNER_ORACLE_HEALTH_CONNECTOR_MANIFEST.slug,
      CERNER_ORACLE_HEALTH_CONNECTOR_MANIFEST,
    ],
    [
      EPIC_APP_ORCHARD_CONNECTOR_MANIFEST.slug,
      EPIC_APP_ORCHARD_CONNECTOR_MANIFEST,
    ],
    [
      MEDITECH_EXPANSE_CONNECTOR_MANIFEST.slug,
      MEDITECH_EXPANSE_CONNECTOR_MANIFEST,
    ],
    [ECLINICALWORKS_CONNECTOR_MANIFEST.slug, ECLINICALWORKS_CONNECTOR_MANIFEST],
    [
      NEXTGEN_HEALTHCARE_CONNECTOR_MANIFEST.slug,
      NEXTGEN_HEALTHCARE_CONNECTOR_MANIFEST,
    ],
    [CLOUDINARY_CONNECTOR_MANIFEST.slug, CLOUDINARY_CONNECTOR_MANIFEST],
    [MURAL_CONNECTOR_MANIFEST.slug, MURAL_CONNECTOR_MANIFEST],
    [FIGJAM_CONNECTOR_MANIFEST.slug, FIGJAM_CONNECTOR_MANIFEST],
    [FIGMA_CONNECTOR_MANIFEST.slug, FIGMA_CONNECTOR_MANIFEST],
    [MIRO_CONNECTOR_MANIFEST.slug, MIRO_CONNECTOR_MANIFEST],
    [CANVA_CONNECTOR_MANIFEST.slug, CANVA_CONNECTOR_MANIFEST],
    [WEBFLOW_CONNECTOR_MANIFEST.slug, WEBFLOW_CONNECTOR_MANIFEST],
    [WORDPRESS_COM_CONNECTOR_MANIFEST.slug, WORDPRESS_COM_CONNECTOR_MANIFEST],
    [GHOST_CONNECTOR_MANIFEST.slug, GHOST_CONNECTOR_MANIFEST],
    [CONTENTFUL_CONNECTOR_MANIFEST.slug, CONTENTFUL_CONNECTOR_MANIFEST],
    [SANITY_CONNECTOR_MANIFEST.slug, SANITY_CONNECTOR_MANIFEST],
    [STRAPI_CLOUD_CONNECTOR_MANIFEST.slug, STRAPI_CLOUD_CONNECTOR_MANIFEST],
    [SHOPIFY_CONNECTOR_MANIFEST.slug, SHOPIFY_CONNECTOR_MANIFEST],
    [WOOCOMMERCE_CONNECTOR_MANIFEST.slug, WOOCOMMERCE_CONNECTOR_MANIFEST],
    [STRIPE_CONNECTOR_MANIFEST.slug, STRIPE_CONNECTOR_MANIFEST],
    [PAYPAL_CONNECTOR_MANIFEST.slug, PAYPAL_CONNECTOR_MANIFEST],
    [
      KAJABI_COMMUNITIES_CONNECTOR_MANIFEST.slug,
      KAJABI_COMMUNITIES_CONNECTOR_MANIFEST,
    ],
    [CIRCLE_CONNECTOR_MANIFEST.slug, CIRCLE_CONNECTOR_MANIFEST],
    [
      MIGHTY_NETWORKS_CONNECTOR_MANIFEST.slug,
      MIGHTY_NETWORKS_CONNECTOR_MANIFEST,
    ],
    [DISCOURSE_CONNECTOR_MANIFEST.slug, DISCOURSE_CONNECTOR_MANIFEST],
    [VANILLA_FORUMS_CONNECTOR_MANIFEST.slug, VANILLA_FORUMS_CONNECTOR_MANIFEST],
    [BETTERMODE_CONNECTOR_MANIFEST.slug, BETTERMODE_CONNECTOR_MANIFEST],
    [HIGHER_LOGIC_CONNECTOR_MANIFEST.slug, HIGHER_LOGIC_CONNECTOR_MANIFEST],
    [HIVEBRITE_CONNECTOR_MANIFEST.slug, HIVEBRITE_CONNECTOR_MANIFEST],
    [XERO_CONNECTOR_MANIFEST.slug, XERO_CONNECTOR_MANIFEST],
    [QUICKBOOKS_CONNECTOR_MANIFEST.slug, QUICKBOOKS_CONNECTOR_MANIFEST],
    [FRESHBOOKS_CONNECTOR_MANIFEST.slug, FRESHBOOKS_CONNECTOR_MANIFEST],
    [WAVE_CONNECTOR_MANIFEST.slug, WAVE_CONNECTOR_MANIFEST],
    [FREEAGENT_CONNECTOR_MANIFEST.slug, FREEAGENT_CONNECTOR_MANIFEST],
    [SALESFORCE_CONNECTOR_MANIFEST.slug, SALESFORCE_CONNECTOR_MANIFEST],
    [HUBSPOT_CONNECTOR_MANIFEST.slug, HUBSPOT_CONNECTOR_MANIFEST],
    [PIPEDRIVE_CONNECTOR_MANIFEST.slug, PIPEDRIVE_CONNECTOR_MANIFEST],
    [ZOHO_CONNECTOR_MANIFEST.slug, ZOHO_CONNECTOR_MANIFEST],
    [ZOHO_PEOPLE_CONNECTOR_MANIFEST.slug, ZOHO_PEOPLE_CONNECTOR_MANIFEST],
    [ZOHO_CAMPAIGNS_CONNECTOR_MANIFEST.slug, ZOHO_CAMPAIGNS_CONNECTOR_MANIFEST],
    [ZOHO_ANALYTICS_CONNECTOR_MANIFEST.slug, ZOHO_ANALYTICS_CONNECTOR_MANIFEST],
    [COPPER_CONNECTOR_MANIFEST.slug, COPPER_CONNECTOR_MANIFEST],
    [CLOSE_CONNECTOR_MANIFEST.slug, CLOSE_CONNECTOR_MANIFEST],
    [ZENDESK_CONNECTOR_MANIFEST.slug, ZENDESK_CONNECTOR_MANIFEST],
    [SHAREPOINT_CONNECTOR_MANIFEST.slug, SHAREPOINT_CONNECTOR_MANIFEST],
    [
      MICROSOFT_PLANNER_CONNECTOR_MANIFEST.slug,
      MICROSOFT_PLANNER_CONNECTOR_MANIFEST,
    ],
    [
      MICROSOFT_TO_DO_CONNECTOR_MANIFEST.slug,
      MICROSOFT_TO_DO_CONNECTOR_MANIFEST,
    ],
    [
      MICROSOFT_LISTS_CONNECTOR_MANIFEST.slug,
      MICROSOFT_LISTS_CONNECTOR_MANIFEST,
    ],
    [ONENOTE_CONNECTOR_MANIFEST.slug, ONENOTE_CONNECTOR_MANIFEST],
    [
      MICROSOFT_BOOKINGS_CONNECTOR_MANIFEST.slug,
      MICROSOFT_BOOKINGS_CONNECTOR_MANIFEST,
    ],
    [
      MICROSOFT_POWER_BI_CONNECTOR_MANIFEST.slug,
      MICROSOFT_POWER_BI_CONNECTOR_MANIFEST,
    ],
    [
      MICROSOFT_DYNAMICS_365_CONNECTOR_MANIFEST.slug,
      MICROSOFT_DYNAMICS_365_CONNECTOR_MANIFEST,
    ],
    [
      MICROSOFT_VIVA_ENGAGE_CONNECTOR_MANIFEST.slug,
      MICROSOFT_VIVA_ENGAGE_CONNECTOR_MANIFEST,
    ],
    [ZOOM_CONNECTOR_MANIFEST.slug, ZOOM_CONNECTOR_MANIFEST],
    [DISCORD_CONNECTOR_MANIFEST.slug, DISCORD_CONNECTOR_MANIFEST],
    [INTERCOM_CONNECTOR_MANIFEST.slug, INTERCOM_CONNECTOR_MANIFEST],
    [FRESHSERVICE_CONNECTOR_MANIFEST.slug, FRESHSERVICE_CONNECTOR_MANIFEST],
    [FRESHCHAT_CONNECTOR_MANIFEST.slug, FRESHCHAT_CONNECTOR_MANIFEST],
    [FRESHMARKETER_CONNECTOR_MANIFEST.slug, FRESHMARKETER_CONNECTOR_MANIFEST],
    [FRESHCALLER_CONNECTOR_MANIFEST.slug, FRESHCALLER_CONNECTOR_MANIFEST],
    [LIVECHAT_CONNECTOR_MANIFEST.slug, LIVECHAT_CONNECTOR_MANIFEST],
    [LIVEAGENT_CONNECTOR_MANIFEST.slug, LIVEAGENT_CONNECTOR_MANIFEST],
    [CRISP_CONNECTOR_MANIFEST.slug, CRISP_CONNECTOR_MANIFEST],
    [TIDIO_CONNECTOR_MANIFEST.slug, TIDIO_CONNECTOR_MANIFEST],
    [OLARK_CONNECTOR_MANIFEST.slug, OLARK_CONNECTOR_MANIFEST],
    [USERLIKE_CONNECTOR_MANIFEST.slug, USERLIKE_CONNECTOR_MANIFEST],
    [GLADLY_CONNECTOR_MANIFEST.slug, GLADLY_CONNECTOR_MANIFEST],
    [KUSTOMER_CONNECTOR_MANIFEST.slug, KUSTOMER_CONNECTOR_MANIFEST],
    [GORGIAS_CONNECTOR_MANIFEST.slug, GORGIAS_CONNECTOR_MANIFEST],
    [REAMAZE_CONNECTOR_MANIFEST.slug, REAMAZE_CONNECTOR_MANIFEST],
    [EDESK_CONNECTOR_MANIFEST.slug, EDESK_CONNECTOR_MANIFEST],
    [KAYAKO_CONNECTOR_MANIFEST.slug, KAYAKO_CONNECTOR_MANIFEST],
    [ACQUIRE_CONNECTOR_MANIFEST.slug, ACQUIRE_CONNECTOR_MANIFEST],
    [FRESHDESK_CONNECTOR_MANIFEST.slug, FRESHDESK_CONNECTOR_MANIFEST],
    [HELP_SCOUT_CONNECTOR_MANIFEST.slug, HELP_SCOUT_CONNECTOR_MANIFEST],
    [FRONT_CONNECTOR_MANIFEST.slug, FRONT_CONNECTOR_MANIFEST],
    [GROOVE_CONNECTOR_MANIFEST.slug, GROOVE_CONNECTOR_MANIFEST],
    [TEAMWORK_CONNECTOR_MANIFEST.slug, TEAMWORK_CONNECTOR_MANIFEST],
    [BASECAMP_CONNECTOR_MANIFEST.slug, BASECAMP_CONNECTOR_MANIFEST],
    [WRIKE_CONNECTOR_MANIFEST.slug, WRIKE_CONNECTOR_MANIFEST],
    [SMARTSHEET_CONNECTOR_MANIFEST.slug, SMARTSHEET_CONNECTOR_MANIFEST],
    [TODOIST_CONNECTOR_MANIFEST.slug, TODOIST_CONNECTOR_MANIFEST],
    [TICKTICK_CONNECTOR_MANIFEST.slug, TICKTICK_CONNECTOR_MANIFEST],
    [TOGGL_TRACK_CONNECTOR_MANIFEST.slug, TOGGL_TRACK_CONNECTOR_MANIFEST],
    [HARVEST_CONNECTOR_MANIFEST.slug, HARVEST_CONNECTOR_MANIFEST],
    [CLOCKIFY_CONNECTOR_MANIFEST.slug, CLOCKIFY_CONNECTOR_MANIFEST],
    [
      TEMPO_TIMESHEETS_CONNECTOR_MANIFEST.slug,
      TEMPO_TIMESHEETS_CONNECTOR_MANIFEST,
    ],
    [ZEPHYR_SCALE_CONNECTOR_MANIFEST.slug, ZEPHYR_SCALE_CONNECTOR_MANIFEST],
    [CALENDLY_CONNECTOR_MANIFEST.slug, CALENDLY_CONNECTOR_MANIFEST],
    [
      YODLEE_FASTLINK_CONNECTOR_MANIFEST.slug,
      YODLEE_FASTLINK_CONNECTOR_MANIFEST,
    ],
    [MX_CONNECTOR_MANIFEST.slug, MX_CONNECTOR_MANIFEST],
    [FINICITY_CONNECTOR_MANIFEST.slug, FINICITY_CONNECTOR_MANIFEST],
    [PLAID_LINK_CONNECTOR_MANIFEST.slug, PLAID_LINK_CONNECTOR_MANIFEST],
    [ETORO_CONNECTOR_MANIFEST.slug, ETORO_CONNECTOR_MANIFEST],
    [OBSIDIAN_CONNECTOR_MANIFEST.slug, OBSIDIAN_CONNECTOR_MANIFEST],
    [ROAM_RESEARCH_CONNECTOR_MANIFEST.slug, ROAM_RESEARCH_CONNECTOR_MANIFEST],
    [LOGSEQ_CONNECTOR_MANIFEST.slug, LOGSEQ_CONNECTOR_MANIFEST],
    [CAL_COM_CONNECTOR_MANIFEST.slug, CAL_COM_CONNECTOR_MANIFEST],
    [
      IRONCLAD_CLICKWRAP_CONNECTOR_MANIFEST.slug,
      IRONCLAD_CLICKWRAP_CONNECTOR_MANIFEST,
    ],
    [
      DOCUSIGN_IDENTIFY_CONNECTOR_MANIFEST.slug,
      DOCUSIGN_IDENTIFY_CONNECTOR_MANIFEST,
    ],
    [GIVEBUTTER_CONNECTOR_MANIFEST.slug, GIVEBUTTER_CONNECTOR_MANIFEST],
    [GIVE_LIVELY_CONNECTOR_MANIFEST.slug, GIVE_LIVELY_CONNECTOR_MANIFEST],
    [KINDFUL_CONNECTOR_MANIFEST.slug, KINDFUL_CONNECTOR_MANIFEST],
    [NEON_CRM_CONNECTOR_MANIFEST.slug, NEON_CRM_CONNECTOR_MANIFEST],
    [
      LITTLE_GREEN_LIGHT_CONNECTOR_MANIFEST.slug,
      LITTLE_GREEN_LIGHT_CONNECTOR_MANIFEST,
    ],
    [DONATELY_CONNECTOR_MANIFEST.slug, DONATELY_CONNECTOR_MANIFEST],
    [FUNDRAISE_UP_CONNECTOR_MANIFEST.slug, FUNDRAISE_UP_CONNECTOR_MANIFEST],
    [VIRTUOUS_CRM_CONNECTOR_MANIFEST.slug, VIRTUOUS_CRM_CONNECTOR_MANIFEST],
    [EVERYACTION_CONNECTOR_MANIFEST.slug, EVERYACTION_CONNECTOR_MANIFEST],
    [NATIONBUILDER_CONNECTOR_MANIFEST.slug, NATIONBUILDER_CONNECTOR_MANIFEST],
    [ACTBLUE_CONNECTOR_MANIFEST.slug, ACTBLUE_CONNECTOR_MANIFEST],
    [MOBILIZE_CONNECTOR_MANIFEST.slug, MOBILIZE_CONNECTOR_MANIFEST],
    [ACTION_NETWORK_CONNECTOR_MANIFEST.slug, ACTION_NETWORK_CONNECTOR_MANIFEST],
    [
      CONSTANT_CONTACT_LEAD_GEN_CONNECTOR_MANIFEST.slug,
      CONSTANT_CONTACT_LEAD_GEN_CONNECTOR_MANIFEST,
    ],
    [DOCUSIGN_CONNECTOR_MANIFEST.slug, DOCUSIGN_CONNECTOR_MANIFEST],
    [DROPBOX_SIGN_CONNECTOR_MANIFEST.slug, DROPBOX_SIGN_CONNECTOR_MANIFEST],
    [PANDADOC_CONNECTOR_MANIFEST.slug, PANDADOC_CONNECTOR_MANIFEST],
    [TYPEFORM_CONNECTOR_MANIFEST.slug, TYPEFORM_CONNECTOR_MANIFEST],
    [DATADOG_CONNECTOR_MANIFEST.slug, DATADOG_CONNECTOR_MANIFEST],
    [NEW_RELIC_CONNECTOR_MANIFEST.slug, NEW_RELIC_CONNECTOR_MANIFEST],
    [PAGERDUTY_CONNECTOR_MANIFEST.slug, PAGERDUTY_CONNECTOR_MANIFEST],
    [STATUSPAGE_CONNECTOR_MANIFEST.slug, STATUSPAGE_CONNECTOR_MANIFEST],
    [CLOUDFLARE_CONNECTOR_MANIFEST.slug, CLOUDFLARE_CONNECTOR_MANIFEST],
    [VERCEL_CONNECTOR_MANIFEST.slug, VERCEL_CONNECTOR_MANIFEST],
    [NETLIFY_CONNECTOR_MANIFEST.slug, NETLIFY_CONNECTOR_MANIFEST],
    [HEROKU_CONNECTOR_MANIFEST.slug, HEROKU_CONNECTOR_MANIFEST],
    [DIGITALOCEAN_CONNECTOR_MANIFEST.slug, DIGITALOCEAN_CONNECTOR_MANIFEST],
    [FIREBASE_CONNECTOR_MANIFEST.slug, FIREBASE_CONNECTOR_MANIFEST],
    [SUPABASE_CONNECTOR_MANIFEST.slug, SUPABASE_CONNECTOR_MANIFEST],
    [OKTA_CONNECTOR_MANIFEST.slug, OKTA_CONNECTOR_MANIFEST],
    [BAMBOOHR_CONNECTOR_MANIFEST.slug, BAMBOOHR_CONNECTOR_MANIFEST],
    [GREENHOUSE_CONNECTOR_MANIFEST.slug, GREENHOUSE_CONNECTOR_MANIFEST],
    [LEVER_CONNECTOR_MANIFEST.slug, LEVER_CONNECTOR_MANIFEST],
    [GMAIL_CONNECTOR_MANIFEST.slug, GMAIL_CONNECTOR_MANIFEST],
    [
      GOOGLE_CALENDAR_CONNECTOR_MANIFEST.slug,
      GOOGLE_CALENDAR_CONNECTOR_MANIFEST,
    ],
    [SENDFOX_CONNECTOR_MANIFEST.slug, SENDFOX_CONNECTOR_MANIFEST],
    [BEEHIIV_CONNECTOR_MANIFEST.slug, BEEHIIV_CONNECTOR_MANIFEST],
    [SUBSTACK_CONNECTOR_MANIFEST.slug, SUBSTACK_CONNECTOR_MANIFEST],
    [HOOTSUITE_CONNECTOR_MANIFEST.slug, HOOTSUITE_CONNECTOR_MANIFEST],
    [BUFFER_CONNECTOR_MANIFEST.slug, BUFFER_CONNECTOR_MANIFEST],
    [SPROUT_SOCIAL_CONNECTOR_MANIFEST.slug, SPROUT_SOCIAL_CONNECTOR_MANIFEST],
    [LATER_CONNECTOR_MANIFEST.slug, LATER_CONNECTOR_MANIFEST],
    [AGORAPULSE_CONNECTOR_MANIFEST.slug, AGORAPULSE_CONNECTOR_MANIFEST],
    [METRICOOL_CONNECTOR_MANIFEST.slug, METRICOOL_CONNECTOR_MANIFEST],
    [PUBLER_CONNECTOR_MANIFEST.slug, PUBLER_CONNECTOR_MANIFEST],
    [BRANDWATCH_CONNECTOR_MANIFEST.slug, BRANDWATCH_CONNECTOR_MANIFEST],
    [MENTION_CONNECTOR_MANIFEST.slug, MENTION_CONNECTOR_MANIFEST],
    [MELTWATER_CONNECTOR_MANIFEST.slug, MELTWATER_CONNECTOR_MANIFEST],
    [SPRINKLR_CONNECTOR_MANIFEST.slug, SPRINKLR_CONNECTOR_MANIFEST],
    [KHOROS_CONNECTOR_MANIFEST.slug, KHOROS_CONNECTOR_MANIFEST],
    [CLEVERTAP_CONNECTOR_MANIFEST.slug, CLEVERTAP_CONNECTOR_MANIFEST],
    [ONESIGNAL_CONNECTOR_MANIFEST.slug, ONESIGNAL_CONNECTOR_MANIFEST],
    [AIRSHIP_CONNECTOR_MANIFEST.slug, AIRSHIP_CONNECTOR_MANIFEST],
    [PUSHWOOSH_CONNECTOR_MANIFEST.slug, PUSHWOOSH_CONNECTOR_MANIFEST],
    [PUSHER_BEAMS_CONNECTOR_MANIFEST.slug, PUSHER_BEAMS_CONNECTOR_MANIFEST],
    [
      FIREBASE_CLOUD_MESSAGING_CONNECTOR_MANIFEST.slug,
      FIREBASE_CLOUD_MESSAGING_CONNECTOR_MANIFEST,
    ],
    [APPSFLYER_CONNECTOR_MANIFEST.slug, APPSFLYER_CONNECTOR_MANIFEST],
    [ADJUST_CONNECTOR_MANIFEST.slug, ADJUST_CONNECTOR_MANIFEST],
    [BRANCH_CONNECTOR_MANIFEST.slug, BRANCH_CONNECTOR_MANIFEST],
    [SINGULAR_CONNECTOR_MANIFEST.slug, SINGULAR_CONNECTOR_MANIFEST],
    [KOCHAVA_CONNECTOR_MANIFEST.slug, KOCHAVA_CONNECTOR_MANIFEST],
    [SEGMENT_CONNECTOR_MANIFEST.slug, SEGMENT_CONNECTOR_MANIFEST],
    [MPARTICLE_CONNECTOR_MANIFEST.slug, MPARTICLE_CONNECTOR_MANIFEST],
    [TEALIUM_CONNECTOR_MANIFEST.slug, TEALIUM_CONNECTOR_MANIFEST],
    [LYTICS_CONNECTOR_MANIFEST.slug, LYTICS_CONNECTOR_MANIFEST],
    [BLUECONIC_CONNECTOR_MANIFEST.slug, BLUECONIC_CONNECTOR_MANIFEST],
    [TREASURE_DATA_CONNECTOR_MANIFEST.slug, TREASURE_DATA_CONNECTOR_MANIFEST],
    [HIGHTOUCH_CONNECTOR_MANIFEST.slug, HIGHTOUCH_CONNECTOR_MANIFEST],
    [CENSUS_CONNECTOR_MANIFEST.slug, CENSUS_CONNECTOR_MANIFEST],
    [MYCASE_CONNECTOR_MANIFEST.slug, MYCASE_CONNECTOR_MANIFEST],
    [CLIO_MANAGE_CONNECTOR_MANIFEST.slug, CLIO_MANAGE_CONNECTOR_MANIFEST],
    [CLIO_GROW_CONNECTOR_MANIFEST.slug, CLIO_GROW_CONNECTOR_MANIFEST],
    [
      DISCO_EDISCOVERY_CONNECTOR_MANIFEST.slug,
      DISCO_EDISCOVERY_CONNECTOR_MANIFEST,
    ],
    [LUCIDSPARK_CONNECTOR_MANIFEST.slug, LUCIDSPARK_CONNECTOR_MANIFEST],
    [LUCIDCHART_CONNECTOR_MANIFEST.slug, LUCIDCHART_CONNECTOR_MANIFEST],
    [GOOGLE_VAULT_CONNECTOR_MANIFEST.slug, GOOGLE_VAULT_CONNECTOR_MANIFEST],
    [GOOGLE_DRIVE_CONNECTOR_MANIFEST.slug, GOOGLE_DRIVE_CONNECTOR_MANIFEST],
    [GOOGLE_DOCS_CONNECTOR_MANIFEST.slug, GOOGLE_DOCS_CONNECTOR_MANIFEST],
    [GOOGLE_SHEETS_CONNECTOR_MANIFEST.slug, GOOGLE_SHEETS_CONNECTOR_MANIFEST],
    [GOOGLE_SLIDES_CONNECTOR_MANIFEST.slug, GOOGLE_SLIDES_CONNECTOR_MANIFEST],
    [GOOGLE_FORMS_CONNECTOR_MANIFEST.slug, GOOGLE_FORMS_CONNECTOR_MANIFEST],
    [GOOGLE_TASKS_CONNECTOR_MANIFEST.slug, GOOGLE_TASKS_CONNECTOR_MANIFEST],
    [
      GOOGLE_CONTACTS_CONNECTOR_MANIFEST.slug,
      GOOGLE_CONTACTS_CONNECTOR_MANIFEST,
    ],
    [GOOGLE_PHOTOS_CONNECTOR_MANIFEST.slug, GOOGLE_PHOTOS_CONNECTOR_MANIFEST],
    [GOOGLE_MEET_CONNECTOR_MANIFEST.slug, GOOGLE_MEET_CONNECTOR_MANIFEST],
    [GOOGLE_CHAT_CONNECTOR_MANIFEST.slug, GOOGLE_CHAT_CONNECTOR_MANIFEST],
    [GOOGLE_ADS_CONNECTOR_MANIFEST.slug, GOOGLE_ADS_CONNECTOR_MANIFEST],
    [
      GOOGLE_ANALYTICS_CONNECTOR_MANIFEST.slug,
      GOOGLE_ANALYTICS_CONNECTOR_MANIFEST,
    ],
    [
      GOOGLE_SEARCH_CONSOLE_CONNECTOR_MANIFEST.slug,
      GOOGLE_SEARCH_CONSOLE_CONNECTOR_MANIFEST,
    ],
    [
      GOOGLE_BUSINESS_PROFILE_CONNECTOR_MANIFEST.slug,
      GOOGLE_BUSINESS_PROFILE_CONNECTOR_MANIFEST,
    ],
    [
      GOOGLE_MERCHANT_CENTER_CONNECTOR_MANIFEST.slug,
      GOOGLE_MERCHANT_CENTER_CONNECTOR_MANIFEST,
    ],
    [YOUTUBE_CONNECTOR_MANIFEST.slug, YOUTUBE_CONNECTOR_MANIFEST],
    [
      GOOGLE_CLASSROOM_CONNECTOR_MANIFEST.slug,
      GOOGLE_CLASSROOM_CONNECTOR_MANIFEST,
    ],
    [
      GOOGLE_MAPS_PLATFORM_CONNECTOR_MANIFEST.slug,
      GOOGLE_MAPS_PLATFORM_CONNECTOR_MANIFEST,
    ],
    [
      ADOBE_ACROBAT_SIGN_CONNECTOR_MANIFEST.slug,
      ADOBE_ACROBAT_SIGN_CONNECTOR_MANIFEST,
    ],
    [SIGNNOW_CONNECTOR_MANIFEST.slug, SIGNNOW_CONNECTOR_MANIFEST],
    [SIGNREQUEST_CONNECTOR_MANIFEST.slug, SIGNREQUEST_CONNECTOR_MANIFEST],
    [SIGNEASY_CONNECTOR_MANIFEST.slug, SIGNEASY_CONNECTOR_MANIFEST],
    [ONESPAN_SIGN_CONNECTOR_MANIFEST.slug, ONESPAN_SIGN_CONNECTOR_MANIFEST],
    [RIGHTSIGNATURE_CONNECTOR_MANIFEST.slug, RIGHTSIGNATURE_CONNECTOR_MANIFEST],
    [GETACCEPT_CONNECTOR_MANIFEST.slug, GETACCEPT_CONNECTOR_MANIFEST],
    [QWILR_CONNECTOR_MANIFEST.slug, QWILR_CONNECTOR_MANIFEST],
    [PROPOSIFY_CONNECTOR_MANIFEST.slug, PROPOSIFY_CONNECTOR_MANIFEST],
    [
      BETTER_PROPOSALS_CONNECTOR_MANIFEST.slug,
      BETTER_PROPOSALS_CONNECTOR_MANIFEST,
    ],
    [CONCORD_CONNECTOR_MANIFEST.slug, CONCORD_CONNECTOR_MANIFEST],
    [JURO_CONNECTOR_MANIFEST.slug, JURO_CONNECTOR_MANIFEST],
    [IRONCLAD_CONNECTOR_MANIFEST.slug, IRONCLAD_CONNECTOR_MANIFEST],
    [LINKSQUARES_CONNECTOR_MANIFEST.slug, LINKSQUARES_CONNECTOR_MANIFEST],
    [SPOTDRAFT_CONNECTOR_MANIFEST.slug, SPOTDRAFT_CONNECTOR_MANIFEST],
    [CONTRACTBOOK_CONNECTOR_MANIFEST.slug, CONTRACTBOOK_CONNECTOR_MANIFEST],
    [LOGROCKET_CONNECTOR_MANIFEST.slug, LOGROCKET_CONNECTOR_MANIFEST],
    [SMARTLOOK_CONNECTOR_MANIFEST.slug, SMARTLOOK_CONNECTOR_MANIFEST],
    [CRAZY_EGG_CONNECTOR_MANIFEST.slug, CRAZY_EGG_CONNECTOR_MANIFEST],
    [APPCUES_CONNECTOR_MANIFEST.slug, APPCUES_CONNECTOR_MANIFEST],
    [USERFLOW_CONNECTOR_MANIFEST.slug, USERFLOW_CONNECTOR_MANIFEST],
    [USERPILOT_CONNECTOR_MANIFEST.slug, USERPILOT_CONNECTOR_MANIFEST],
    [CHAMELEON_CONNECTOR_MANIFEST.slug, CHAMELEON_CONNECTOR_MANIFEST],
    [VITALLY_CONNECTOR_MANIFEST.slug, VITALLY_CONNECTOR_MANIFEST],
    [GAINSIGHT_CONNECTOR_MANIFEST.slug, GAINSIGHT_CONNECTOR_MANIFEST],
    [TOTANGO_CONNECTOR_MANIFEST.slug, TOTANGO_CONNECTOR_MANIFEST],
    [CUSTIFY_CONNECTOR_MANIFEST.slug, CUSTIFY_CONNECTOR_MANIFEST],
    [PLANHAT_CONNECTOR_MANIFEST.slug, PLANHAT_CONNECTOR_MANIFEST],
    [CLIENTSUCCESS_CONNECTOR_MANIFEST.slug, CLIENTSUCCESS_CONNECTOR_MANIFEST],
    [FRESHSALES_CONNECTOR_MANIFEST.slug, FRESHSALES_CONNECTOR_MANIFEST],
    [INSIGHTLY_CONNECTOR_MANIFEST.slug, INSIGHTLY_CONNECTOR_MANIFEST],
    [NIMBLE_CONNECTOR_MANIFEST.slug, NIMBLE_CONNECTOR_MANIFEST],
    [CAPSULE_CRM_CONNECTOR_MANIFEST.slug, CAPSULE_CRM_CONNECTOR_MANIFEST],
    [KEAP_CONNECTOR_MANIFEST.slug, KEAP_CONNECTOR_MANIFEST],
    [OUTLOOK_CONNECTOR_MANIFEST.slug, OUTLOOK_CONNECTOR_MANIFEST],
    [
      MICROSOFT_TEAMS_CONNECTOR_MANIFEST.slug,
      MICROSOFT_TEAMS_CONNECTOR_MANIFEST,
    ],
    [ONEDRIVE_CONNECTOR_MANIFEST.slug, ONEDRIVE_CONNECTOR_MANIFEST],
    [EXA_CONNECTOR_MANIFEST.slug, EXA_CONNECTOR_MANIFEST],
    [DATAFORSEO_CONNECTOR_MANIFEST.slug, DATAFORSEO_CONNECTOR_MANIFEST],
    [LINKEDIN_CONNECTOR_MANIFEST.slug, LINKEDIN_CONNECTOR_MANIFEST],
  ]);

  list() {
    return Array.from(this.manifests.values());
  }

  get(slug: string) {
    return this.manifests.get(this.normalizeSlug(slug)) ?? null;
  }

  has(slug: string) {
    return this.manifests.has(this.normalizeSlug(slug));
  }

  getTool(appSlug: string, toolName: string) {
    const manifest = this.get(appSlug);
    if (!manifest) return null;
    const normalized = this.normalizeToolName(toolName);
    return (
      manifest.tools.find((tool) =>
        [tool.name, tool.functionName, ...(tool.aliases ?? [])].some(
          (name) => this.normalizeToolName(name) === normalized,
        ),
      ) ?? null
    );
  }

  normalizeToolName(value: string) {
    return String(value ?? "").trim();
  }

  private normalizeSlug(value: string) {
    return canonicalMarketplaceProviderSlug(String(value ?? ""));
  }
}
