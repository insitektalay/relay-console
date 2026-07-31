import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

enum ApplicationsBrandLogo: Equatable {
  case relayConsole
  case x
  case facebookPages
  case instagramBusiness
  case tumblr
  case mastodon
  case bluesky
  case linkedIn
  case exaSearch
  case gmail
  case googleDocs
  case googleCalendar
  case googleDrive
  case googleSearchConsole
  case googleAnalytics
  case googleMerchantCenter
  case youtube
  case googleClassroom
  case googleMapsPlatform
  case adobeAcrobatSign
  case signNow
  case signRequest
  case signeasy
  case oneSpanSign
  case rightSignature
  case getAccept
  case qwilr
  case proposify
  case betterProposals
  case concord
  case juro
  case ironclad
  case linkSquares
  case spotDraft
  case contractbook
  case logRocket
  case smartlook
  case crazyEgg
  case appcues
  case userflow
  case userpilot
  case chameleon
  case vitally
  case gainsight
  case totango
  case custify
  case planhat
  case clientsuccess
  case freshsales
  case insightly
  case nimble
  case capsuleCrm
  case keap
  case outlook
  case microsoftTeams
  case oneDrive
  case sharePoint
  case microsoftPlanner
  case microsoftToDo
  case microsoftLists
  case oneNote
  case microsoftBookings
  case microsoftPowerBI
  case microsoftDynamics365
  case microsoftVivaEngage
  case zoom
  case discord
  case postHog
  case sentry
  case datadog
  case pagerDuty
  case cloudflare
  case vercel
  case heroku
  case digitalOcean
  case firebase
  case supabase
  case okta
  case bambooHR
  case greenhouse
  case lever
  case notion
  case microsoftClarity
  case telemetryDeck
  case slack
  case github
  case gitlab
  case bitbucket
  case linear
  case asana
  case trello
  case clickUp
  case monday
  case airtable
  case dropbox
  case box
  case figma
  case figjam
  case miro
  case canva
  case webflow
  case wordpressCom
  case contentful
  case sanity
  case strapiCloud
  case shopify
  case wooCommerce
  case stripe
  case paypal
  case xero
  case quickBooks
  case freshBooks
  case wave
  case freeAgent
  case salesforce
  case hubSpot
  case pipedrive
  case zoho
  case zohoPeople
  case zohoCampaigns
  case zohoAnalytics
  case copper
  case close
  case zendesk
  case intercom
  case freshservice
  case freshchat
  case freshmarketer
  case freshcaller
  case livechat
  case liveagent
  case crisp
  case tidio
  case olark
  case userlike
  case gladly
  case kustomer
  case gorgias
  case reAmaze
  case edesk
  case kayako
  case acquire
  case freshdesk
  case helpScout
  case front
  case groove
  case teamwork
  case basecamp
  case wrike
  case smartsheet
  case todoist
  case ticktick
  case togglTrack
  case harvest
  case clockify
  case tempoTimesheets
  case zephyrScale
  case calendly
  case ontraport
  case bitrix24
  case agileCrm
  case streak
  case lessAnnoyingCrm
  case nutshell
  case teamleader
  case scoro
  case odoo
  case netsuite
  case sageAccounting
  case sageIntacct
  case myob
  case kashFlow
  case zohoBooks
  case zohoInvoice
  case zohoExpense
  case zohoDesk
  case zohoProjects
  case obsidian
  case roamResearch
  case logseq
  case craft
  case anytype
  case yodleeFastLink
  case mx
  case finicity
  case plaidLink
  case etoro
  case clay
  case claygent
  case phantombuster
  case texau
  case evaboot
  case lemlist
  case mailshake
  case woodpecker
  case replyIo
  case mixmax
  case cirrusInsight
  case spotio
  case calCom
  case docusign
  case dropboxSign
  case pandaDoc
  case typeform
  case surveyMonkey
  case fillout
  case mailchimp
  case klaviyo
  case convertkit
  case campaignMonitor
  case constantContact
  case line
  case twist

  init?(app: MarketplaceCatalogApp) {
    let slug = app.slug.lowercased()
    let name = app.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    switch slug {
    case "relay-console":
      self = .relayConsole
    case "x":
      self = .x
    case "facebook-pages":
      self = .facebookPages
    case "instagram-business":
      self = .instagramBusiness
    case "tumblr":
      self = .tumblr
    case "mastodon":
      self = .mastodon
    case "bluesky":
      self = .bluesky
    case "linkedin":
      self = .linkedIn
    case "exa-search":
      self = .exaSearch
    case "gmail":
      self = .gmail
    case "google-docs":
      self = .googleDocs
    case "google-calendar":
      self = .googleCalendar
    case "google-drive":
      self = .googleDrive
    case "google-search-console":
      self = .googleSearchConsole
    case "google-analytics":
      self = .googleAnalytics
    case "google-merchant-center":
      self = .googleMerchantCenter
    case "youtube":
      self = .youtube
    case "google-classroom":
      self = .googleClassroom
    case "google-maps-platform":
      self = .googleMapsPlatform
    case "adobe-acrobat-sign":
      self = .adobeAcrobatSign
    case "signnow":
      self = .signNow
    case "signrequest":
      self = .signRequest
    case "signeasy":
      self = .signeasy
    case "onespan-sign":
      self = .oneSpanSign
    case "rightsignature":
      self = .rightSignature
    case "getaccept":
      self = .getAccept
    case "qwilr":
      self = .qwilr
    case "proposify":
      self = .proposify
    case "better-proposals":
      self = .betterProposals
    case "concord":
      self = .concord
    case "juro":
      self = .juro
    case "ironclad":
      self = .ironclad
    case "linksquares":
      self = .linkSquares
    case "spotdraft":
      self = .spotDraft
    case "contractbook":
      self = .contractbook
    case "logrocket":
      self = .logRocket
    case "smartlook":
      self = .smartlook
    case "crazy-egg":
      self = .crazyEgg
    case "appcues":
      self = .appcues
    case "userflow":
      self = .userflow
    case "userpilot":
      self = .userpilot
    case "chameleon":
      self = .chameleon
    case "vitally":
      self = .vitally
    case "gainsight":
      self = .gainsight
    case "totango":
      self = .totango
    case "custify":
      self = .custify
    case "planhat":
      self = .planhat
    case "clientsuccess":
      self = .clientsuccess
    case "freshsales":
      self = .freshsales
    case "insightly":
      self = .insightly
    case "nimble":
      self = .nimble
    case "capsule-crm": self = .capsuleCrm
    case "keap": self = .keap
    case "outlook":
      self = .outlook
    case "microsoft-teams":
      self = .microsoftTeams
    case "onedrive":
      self = .oneDrive
    case "sharepoint":
      self = .sharePoint
    case "microsoft-planner":
      self = .microsoftPlanner
    case "microsoft-to-do":
      self = .microsoftToDo
    case "microsoft-lists":
      self = .microsoftLists
    case "onenote":
      self = .oneNote
    case "microsoft-bookings":
      self = .microsoftBookings
    case "microsoft-power-bi":
      self = .microsoftPowerBI
    case "microsoft-dynamics-365":
      self = .microsoftDynamics365
    case "microsoft-viva-engage":
      self = .microsoftVivaEngage
    case "zoom":
      self = .zoom
    case "discord":
      self = .discord
    case "posthog":
      self = .postHog
    case "sentry":
      self = .sentry
    case "datadog":
      self = .datadog
    case "pagerduty":
      self = .pagerDuty
    case "cloudflare":
      self = .cloudflare
    case "vercel":
      self = .vercel
    case "heroku":
      self = .heroku
    case "digitalocean":
      self = .digitalOcean
    case "firebase":
      self = .firebase
    case "supabase":
      self = .supabase
    case "okta":
      self = .okta
    case "bamboohr":
      self = .bambooHR
    case "greenhouse":
      self = .greenhouse
    case "lever":
      self = .lever
    case "notion":
      self = .notion
    case "microsoft-clarity":
      self = .microsoftClarity
    case "telemetrydeck":
      self = .telemetryDeck
    case "slack":
      self = .slack
    case "github":
      self = .github
    case "gitlab":
      self = .gitlab
    case "bitbucket":
      self = .bitbucket
    case "linear":
      self = .linear
    case "asana":
      self = .asana
    case "trello": self = .trello
    case "clickup": self = .clickUp
    case "monday-com": self = .monday
    case "airtable": self = .airtable
    case "dropbox": self = .dropbox
    case "box": self = .box
    case "figma": self = .figma
    case "figjam": self = .figjam
    case "miro": self = .miro
    case "canva": self = .canva
    case "webflow": self = .webflow
    case "wordpress-com": self = .wordpressCom
    case "contentful": self = .contentful
    case "sanity": self = .sanity
    case "strapi-cloud": self = .strapiCloud
    case "shopify": self = .shopify
    case "woocommerce": self = .wooCommerce
    case "stripe": self = .stripe
    case "paypal": self = .paypal
    case "xero": self = .xero
    case "quickbooks": self = .quickBooks
    case "freshbooks": self = .freshBooks
    case "wave": self = .wave
    case "freeagent": self = .freeAgent
    case "salesforce": self = .salesforce
    case "hubspot": self = .hubSpot
    case "pipedrive": self = .pipedrive
    case "zoho": self = .zoho
    case "zoho-people": self = .zohoPeople
    case "zoho-campaigns": self = .zohoCampaigns
    case "zoho-analytics": self = .zohoAnalytics
    case "copper": self = .copper
    case "close": self = .close
    case "zendesk": self = .zendesk
    case "intercom": self = .intercom
    case "freshservice": self = .freshservice
    case "freshchat": self = .freshchat
    case "freshmarketer": self = .freshmarketer
    case "freshcaller": self = .freshcaller
    case "livechat": self = .livechat
    case "liveagent": self = .liveagent
    case "crisp": self = .crisp
    case "tidio": self = .tidio
    case "olark": self = .olark
    case "userlike": self = .userlike
    case "gladly": self = .gladly
    case "kustomer": self = .kustomer
    case "gorgias": self = .gorgias
    case "re-amaze": self = .reAmaze
    case "edesk": self = .edesk
    case "kayako": self = .kayako
    case "acquire": self = .acquire
    case "freshdesk": self = .freshdesk
    case "help-scout": self = .helpScout
    case "front": self = .front
    case "groove": self = .groove
    case "teamwork": self = .teamwork
    case "basecamp": self = .basecamp
    case "wrike": self = .wrike
    case "smartsheet": self = .smartsheet
    case "todoist": self = .todoist
    case "ticktick": self = .ticktick
    case "toggl-track": self = .togglTrack
    case "harvest": self = .harvest
    case "clockify": self = .clockify
    case "tempo-timesheets": self = .tempoTimesheets
    case "zephyr-scale": self = .zephyrScale
    case "calendly": self = .calendly
    case "ontraport": self = .ontraport
    case "bitrix24": self = .bitrix24
    case "agile-crm": self = .agileCrm
    case "streak": self = .streak
    case "less-annoying-crm": self = .lessAnnoyingCrm
    case "nutshell": self = .nutshell
    case "teamleader": self = .teamleader
    case "scoro": self = .scoro
    case "odoo": self = .odoo
    case "netsuite": self = .netsuite
    case "sage-accounting": self = .sageAccounting
    case "sage-intacct": self = .sageIntacct
    case "myob": self = .myob
    case "kashflow": self = .kashFlow
    case "zoho-books": self = .zohoBooks
    case "zoho-invoice": self = .zohoInvoice
    case "zoho-expense": self = .zohoExpense
    case "zoho-desk": self = .zohoDesk
    case "zoho-projects": self = .zohoProjects
    case "obsidian": self = .obsidian
    case "roam-research": self = .roamResearch
    case "logseq": self = .logseq
    case "craft": self = .craft
    case "anytype": self = .anytype
    case "yodlee-fastlink": self = .yodleeFastLink
    case "mx": self = .mx
    case "finicity": self = .finicity
    case "plaid-link": self = .plaidLink
    case "etoro": self = .etoro
    case "clay": self = .clay
    case "claygent": self = .claygent
    case "phantombuster": self = .phantombuster
    case "texau": self = .texau
    case "evaboot": self = .evaboot
    case "lemlist": self = .lemlist
    case "mailshake": self = .mailshake
    case "woodpecker": self = .woodpecker
    case "reply-io": self = .replyIo
    case "mixmax": self = .mixmax
    case "cirrus-insight": self = .cirrusInsight
    case "spotio": self = .spotio
    case "cal-com": self = .calCom
    case "docusign": self = .docusign
    case "dropbox-sign": self = .dropboxSign
    case "pandadoc": self = .pandaDoc
    case "typeform": self = .typeform
    case "surveymonkey": self = .surveyMonkey
    case "fillout": self = .fillout
    case "mailchimp": self = .mailchimp
    case "klaviyo": self = .klaviyo
    case "convertkit": self = .convertkit
    case "campaign-monitor": self = .campaignMonitor
    case "constant-contact": self = .constantContact
    case "line": self = .line
    case "twist": self = .twist
    default:
      if name == "relay console" {
        self = .relayConsole
      } else if name == "x" {
        self = .x
      } else if name == "facebook pages" {
        self = .facebookPages
      } else if name == "instagram business" {
        self = .instagramBusiness
      } else if name == "linkedin" {
        self = .linkedIn
      } else if name == "exa search" {
        self = .exaSearch
      } else if name == "gmail" {
        self = .gmail
      } else {
        return nil
      }
    }
  }

  var displayName: String {
    switch self {
    case .relayConsole:
      return "Relay Console"
    case .x:
      return "X"
    case .facebookPages:
      return "Facebook Pages"
    case .instagramBusiness:
      return "Instagram Business"
    case .tumblr:
      return "Tumblr"
    case .mastodon:
      return "Mastodon"
    case .bluesky:
      return "Bluesky"
    case .linkedIn:
      return "LinkedIn"
    case .exaSearch:
      return "Exa Search"
    case .gmail:
      return "Gmail"
    case .googleDocs:
      return "Google Docs"
    case .googleCalendar:
      return "Google Calendar"
    case .googleDrive:
      return "Google Drive"
    case .googleSearchConsole:
      return "Google Search Console"
    case .googleAnalytics:
      return "Google Analytics"
    case .googleMerchantCenter:
      return "Google Merchant Center"
    case .youtube:
      return "YouTube"
    case .googleClassroom:
      return "Google Classroom"
    case .googleMapsPlatform:
      return "Google Maps Platform"
    case .adobeAcrobatSign:
      return "Adobe Acrobat Sign"
    case .signNow:
      return "SignNow"
    case .signRequest:
      return "SignRequest"
    case .signeasy:
      return "Signeasy"
    case .oneSpanSign:
      return "OneSpan Sign"
    case .rightSignature:
      return "RightSignature"
    case .getAccept:
      return "GetAccept"
    case .qwilr:
      return "Qwilr"
    case .proposify:
      return "Proposify"
    case .betterProposals:
      return "Better Proposals"
    case .concord:
      return "Concord"
    case .juro:
      return "Juro"
    case .ironclad:
      return "Ironclad"
    case .linkSquares:
      return "LinkSquares"
    case .spotDraft:
      return "SpotDraft"
    case .contractbook:
      return "Contractbook"
    case .logRocket:
      return "LogRocket"
    case .smartlook:
      return "Smartlook"
    case .crazyEgg:
      return "Crazy Egg"
    case .appcues:
      return "Appcues"
    case .userflow:
      return "Userflow"
    case .userpilot:
      return "Userpilot"
    case .chameleon:
      return "Chameleon"
    case .vitally:
      return "Vitally"
    case .gainsight:
      return "Gainsight"
    case .totango:
      return "Totango"
    case .custify:
      return "Custify"
    case .planhat:
      return "Planhat"
    case .clientsuccess:
      return "ClientSuccess"
    case .freshsales:
      return "Freshsales"
    case .insightly:
      return "Insightly"
    case .nimble:
      return "Nimble"
    case .capsuleCrm: return "Capsule CRM"
    case .keap: return "Keap"
    case .outlook:
      return "Outlook"
    case .microsoftTeams:
      return "Microsoft Teams"
    case .oneDrive:
      return "OneDrive"
    case .sharePoint:
      return "SharePoint"
    case .microsoftPlanner:
      return "Microsoft Planner"
    case .microsoftToDo:
      return "Microsoft To Do"
    case .microsoftLists:
      return "Microsoft Lists"
    case .oneNote:
      return "OneNote"
    case .microsoftBookings:
      return "Microsoft Bookings"
    case .microsoftPowerBI:
      return "Microsoft Power BI"
    case .microsoftDynamics365:
      return "Microsoft Dynamics 365"
    case .microsoftVivaEngage:
      return "Microsoft Viva Engage"
    case .zoom:
      return "Zoom"
    case .discord:
      return "Discord"
    case .postHog:
      return "PostHog"
    case .sentry:
      return "Sentry"
    case .datadog:
      return "Datadog"
    case .pagerDuty:
      return "PagerDuty"
    case .cloudflare:
      return "Cloudflare"
    case .vercel:
      return "Vercel"
    case .heroku:
      return "Heroku"
    case .digitalOcean:
      return "DigitalOcean"
    case .firebase:
      return "Firebase"
    case .supabase:
      return "Supabase"
    case .okta:
      return "Okta"
    case .bambooHR:
      return "BambooHR"
    case .greenhouse:
      return "Greenhouse"
    case .lever:
      return "Lever"
    case .notion:
      return "Notion"
    case .microsoftClarity:
      return "Microsoft Clarity"
    case .telemetryDeck:
      return "TelemetryDeck"
    case .slack:
      return "Slack"
    case .github:
      return "GitHub"
    case .gitlab:
      return "GitLab"
    case .bitbucket:
      return "Bitbucket"
    case .linear:
      return "Linear"
    case .asana:
      return "Asana"
    case .trello: return "Trello"
    case .clickUp: return "ClickUp"
    case .monday: return "Monday.com"
    case .airtable: return "Airtable"
    case .dropbox: return "Dropbox"
    case .box: return "Box"
    case .figma: return "Figma"
    case .figjam: return "FigJam"
    case .miro: return "Miro"
    case .canva: return "Canva"
    case .webflow: return "Webflow"
    case .wordpressCom: return "WordPress.com"
    case .contentful: return "Contentful"
    case .sanity: return "Sanity"
    case .strapiCloud: return "Strapi Cloud"
    case .shopify: return "Shopify"
    case .wooCommerce: return "WooCommerce"
    case .stripe: return "Stripe"
    case .paypal: return "PayPal"
    case .xero: return "Xero"
    case .quickBooks: return "QuickBooks Online"
    case .freshBooks: return "FreshBooks"
    case .wave: return "Wave"
    case .freeAgent: return "FreeAgent"
    case .salesforce: return "Salesforce"
    case .hubSpot: return "HubSpot"
    case .pipedrive: return "Pipedrive"
    case .zoho: return "Zoho CRM"
    case .zohoPeople: return "Zoho People"
    case .zohoCampaigns: return "Zoho Campaigns"
    case .zohoAnalytics: return "Zoho Analytics"
    case .copper: return "Copper"
    case .close: return "Close"
    case .zendesk: return "Zendesk"
    case .intercom: return "Intercom"
    case .freshservice: return "Freshservice"
    case .freshchat: return "Freshchat"
    case .freshmarketer: return "Freshmarketer"
    case .freshcaller: return "Freshcaller"
    case .livechat: return "LiveChat"
    case .liveagent: return "LiveAgent"
    case .crisp: return "Crisp"
    case .tidio: return "Tidio"
    case .olark: return "Olark"
    case .userlike: return "Userlike"
    case .gladly: return "Gladly"
    case .kustomer: return "Kustomer"
    case .gorgias: return "Gorgias"
    case .reAmaze: return "Re:amaze"
    case .edesk: return "eDesk"
    case .kayako: return "Kayako"
    case .acquire: return "Acquire"
    case .freshdesk: return "Freshdesk"
    case .helpScout: return "Help Scout"
    case .front: return "Front"
    case .groove: return "Groove"
    case .teamwork: return "Teamwork"
    case .basecamp: return "Basecamp"
    case .wrike: return "Wrike"
    case .smartsheet: return "Smartsheet"
    case .todoist: return "Todoist"
    case .ticktick: return "TickTick"
    case .togglTrack: return "Toggl Track"
    case .harvest: return "Harvest"
    case .clockify: return "Clockify"
    case .tempoTimesheets: return "Tempo Timesheets"
    case .zephyrScale: return "Zephyr Scale"
    case .calendly: return "Calendly"
    case .ontraport: return "Ontraport"
    case .bitrix24: return "Bitrix24"
    case .agileCrm: return "Agile CRM"
    case .streak: return "Streak"
    case .lessAnnoyingCrm: return "Less Annoying CRM"
    case .nutshell: return "Nutshell"
    case .teamleader: return "Teamleader"
    case .scoro: return "Scoro"
    case .odoo: return "Odoo"
    case .netsuite: return "NetSuite"
    case .sageAccounting: return "Sage Accounting"
    case .sageIntacct: return "Sage Intacct"
    case .myob: return "MYOB"
    case .kashFlow: return "KashFlow"
    case .zohoBooks: return "Zoho Books"
    case .zohoInvoice: return "Zoho Invoice"
    case .zohoExpense: return "Zoho Expense"
    case .zohoDesk: return "Zoho Desk"
    case .zohoProjects: return "Zoho Projects"
    case .obsidian: return "Obsidian"
    case .roamResearch: return "Roam Research"
    case .logseq: return "Logseq"
    case .craft: return "Craft"
    case .anytype: return "Anytype"
    case .yodleeFastLink: return "Yodlee FastLink"
    case .mx: return "MX"
    case .finicity: return "Finicity"
    case .plaidLink: return "Plaid Link"
    case .etoro: return "eToro"
    case .clay: return "Clay"
    case .claygent: return "Claygent"
    case .phantombuster: return "PhantomBuster"
    case .texau: return "TexAu"
    case .evaboot: return "Evaboot"
    case .lemlist: return "lemlist"
    case .mailshake: return "Mailshake"
    case .woodpecker: return "Woodpecker"
    case .replyIo: return "Reply.io"
    case .mixmax: return "Mixmax"
    case .cirrusInsight: return "Cirrus Insight"
    case .spotio: return "SPOTIO"
    case .calCom: return "Cal.com"
    case .docusign: return "Docusign"
    case .dropboxSign: return "Dropbox Sign"
    case .pandaDoc: return "PandaDoc"
    case .typeform: return "Typeform"
    case .surveyMonkey: return "SurveyMonkey"
    case .fillout: return "Fillout"
    case .mailchimp: return "Mailchimp"
    case .klaviyo: return "Klaviyo"
    case .convertkit: return "Kit"
    case .campaignMonitor: return "Campaign Monitor"
    case .constantContact: return "Constant Contact"
    case .line: return "LINE"
    case .twist: return "Twist"
    }
  }

  var markColor: Color {
    switch self {
    case .relayConsole:
      return RCTheme.relayCyan
    case .x:
      return Color.white
    case .facebookPages:
      return Color(red: 0.035, green: 0.431, blue: 0.922)
    case .instagramBusiness:
      return Color(red: 0.882, green: 0.149, blue: 0.482)
    case .tumblr:
      return Color(red: 0.000, green: 0.098, blue: 0.208)
    case .mastodon:
      return Color(red: 0.388, green: 0.392, blue: 1.000)
    case .bluesky:
      return Color(red: 0.020, green: 0.376, blue: 1.000)
    case .linkedIn:
      return Color(red: 0.039, green: 0.400, blue: 0.761)
    case .exaSearch:
      return Color(red: 0.118, green: 0.251, blue: 0.929)
    case .gmail, .googleDocs:
      return Color(red: 0.259, green: 0.522, blue: 0.957)
    case .googleCalendar:
      return Color(red: 0.251, green: 0.475, blue: 0.871)
    case .googleDrive:
      return Color(red: 0.059, green: 0.615, blue: 0.345)
    case .googleSearchConsole:
      return Color(red: 0.098, green: 0.420, blue: 0.812)
    case .googleAnalytics:
      return Color(red: 0.976, green: 0.671, blue: 0.000)
    case .googleMerchantCenter:
      return Color(red: 0.196, green: 0.522, blue: 0.875)
    case .youtube:
      return Color(red: 1.000, green: 0.000, blue: 0.000)
    case .googleClassroom:
      return Color(red: 0.176, green: 0.659, blue: 0.329)
    case .googleMapsPlatform:
      return Color(red: 0.259, green: 0.522, blue: 0.957)
    case .adobeAcrobatSign:
      return Color(red: 0.925, green: 0.110, blue: 0.141)
    case .signNow:
      return Color(red: 0.169, green: 0.404, blue: 0.965)
    case .signRequest:
      return Color(red: 0.110, green: 0.518, blue: 0.902)
    case .signeasy:
      return Color(red: 0.290, green: 0.565, blue: 0.886)
    case .oneSpanSign:
      return Color(red: 0.000, green: 0.176, blue: 0.447)
    case .rightSignature:
      return Color(red: 0.094, green: 0.463, blue: 0.820)
    case .getAccept:
      return Color(red: 0.925, green: 0.298, blue: 0.263)
    case .qwilr:
      return Color(red: 0.431, green: 0.306, blue: 0.965)
    case .proposify:
      return Color(red: 0.157, green: 0.659, blue: 0.565)
    case .betterProposals:
      return Color(red: 0.910, green: 0.365, blue: 0.459)
    case .concord:
      return Color(red: 0.075, green: 0.455, blue: 0.765)
    case .juro:
      return Color(red: 0.082, green: 0.141, blue: 0.251)
    case .ironclad:
      return Color(red: 0.118, green: 0.239, blue: 0.553)
    case .linkSquares:
      return Color(red: 0.067, green: 0.525, blue: 0.537)
    case .spotDraft:
      return Color(red: 0.353, green: 0.239, blue: 0.839)
    case .contractbook:
      return Color(red: 0.075, green: 0.153, blue: 0.275)
    case .logRocket, .smartlook, .crazyEgg, .appcues, .userflow, .userpilot,
      .chameleon, .vitally, .gainsight, .totango, .custify, .planhat,
      .clientsuccess, .freshsales, .insightly, .nimble, .capsuleCrm, .keap:
      return Color(red: 0.302, green: 0.361, blue: 0.941)
    case .outlook:
      return Color(red: 0.000, green: 0.471, blue: 0.843)
    case .microsoftTeams:
      return Color(red: 0.384, green: 0.384, blue: 0.831)
    case .oneDrive:
      return Color(red: 0.000, green: 0.471, blue: 0.843)
    case .sharePoint:
      return Color(red: 0.020, green: 0.478, blue: 0.455)
    case .microsoftPlanner:
      return Color(red: 0.192, green: 0.557, blue: 0.302)
    case .microsoftToDo:
      return Color(red: 0.145, green: 0.455, blue: 0.890)
    case .microsoftLists:
      return Color(red: 0.545, green: 0.110, blue: 0.520)
    case .oneNote:
      return Color(red: 0.467, green: 0.125, blue: 0.545)
    case .microsoftBookings:
      return Color(red: 0.000, green: 0.663, blue: 0.616)
    case .microsoftPowerBI:
      return Color(red: 0.949, green: 0.784, blue: 0.067)
    case .microsoftDynamics365:
      return Color(red: 0.043, green: 0.325, blue: 0.808)
    case .microsoftVivaEngage:
      return Color(red: 0.462, green: 0.129, blue: 0.714)
    case .zoom:
      return Color(red: 0.176, green: 0.431, blue: 0.965)
    case .discord:
      return Color(red: 0.345, green: 0.396, blue: 0.949)
    case .postHog, .notion:
      return Color.black
    case .sentry:
      return Color(red: 0.251, green: 0.125, blue: 0.333)
    case .datadog:
      return Color(red: 0.388, green: 0.227, blue: 0.647)
    case .pagerDuty:
      return Color(red: 0.000, green: 0.345, blue: 0.612)
    case .cloudflare:
      return Color(red: 0.953, green: 0.431, blue: 0.086)
    case .vercel:
      return Color.black
    case .heroku:
      return Color(red: 0.263, green: 0.157, blue: 0.420)
    case .digitalOcean:
      return Color(red: 0.000, green: 0.412, blue: 0.953)
    case .firebase:
      return Color(red: 1.000, green: 0.757, blue: 0.027)
    case .supabase:
      return Color(red: 0.243, green: 0.839, blue: 0.592)
    case .okta:
      return Color(red: 0.000, green: 0.486, blue: 0.800)
    case .bambooHR:
      return Color(red: 0.333, green: 0.635, blue: 0.267)
    case .greenhouse:
      return Color(red: 0.118, green: 0.353, blue: 0.267)
    case .lever:
      return Color(red: 0.075, green: 0.302, blue: 0.263)
    case .microsoftClarity:
      return Color(red: 0.188, green: 0.463, blue: 0.961)
    case .telemetryDeck:
      return Color(red: 0.482, green: 0.400, blue: 0.961)
    case .slack:
      return Color(red: 0.224, green: 0.773, blue: 0.941)
    case .github:
      return Color(red: 0.141, green: 0.161, blue: 0.184)
    case .gitlab:
      return Color(red: 0.988, green: 0.427, blue: 0.149)
    case .bitbucket:
      return Color(red: 0.000, green: 0.322, blue: 0.800)
    case .linear:
      return Color(red: 0.373, green: 0.353, blue: 0.949)
    case .asana:
      return Color(red: 0.941, green: 0.416, blue: 0.416)
    case .trello: return Color(red: 0.047, green: 0.400, blue: 0.894)
    case .clickUp: return Color(red: 0.482, green: 0.408, blue: 0.933)
    case .monday: return Color(red: 0.969, green: 0.263, blue: 0.353)
    case .airtable: return Color(red: 0.176, green: 0.612, blue: 0.867)
    case .dropbox: return Color(red: 0.000, green: 0.380, blue: 1.000)
    case .box: return Color(red: 0.000, green: 0.455, blue: 0.851)
    case .figma: return Color(red: 0.635, green: 0.294, blue: 1.000)
    case .figjam: return Color(red: 0.635, green: 0.294, blue: 1.000)
    case .miro: return Color(red: 1.000, green: 0.867, blue: 0.000)
    case .canva: return Color(red: 0.000, green: 0.769, blue: 0.878)
    case .webflow: return Color(red: 0.255, green: 0.263, blue: 1.000)
    case .wordpressCom: return Color(red: 0.063, green: 0.310, blue: 0.424)
    case .contentful: return Color(red: 0.149, green: 0.647, blue: 0.686)
    case .sanity: return Color(red: 0.941, green: 0.212, blue: 0.267)
    case .strapiCloud: return Color(red: 0.286, green: 0.271, blue: 1.000)
    case .shopify: return Color(red: 0.584, green: 0.745, blue: 0.196)
    case .wooCommerce: return Color(red: 0.592, green: 0.349, blue: 0.714)
    case .stripe: return Color(red: 0.325, green: 0.227, blue: 0.992)
    case .paypal: return Color(red: 0.0, green: 0.173, blue: 0.569)
    case .xero: return Color(red: 0.075, green: 0.682, blue: 0.827)
    case .quickBooks: return Color(red: 0.180, green: 0.659, blue: 0.322)
    case .freshBooks: return Color(red: 0.000, green: 0.533, blue: 0.780)
    case .wave: return Color(red: 0.122, green: 0.286, blue: 0.843)
    case .freeAgent: return Color(red: 0.000, green: 0.533, blue: 0.780)
    case .salesforce: return Color(red: 0.000, green: 0.631, blue: 0.827)
    case .hubSpot: return Color(red: 1.000, green: 0.478, blue: 0.322)
    case .pipedrive: return Color(red: 0.145, green: 0.208, blue: 0.204)
    case .zoho: return Color(red: 0.894, green: 0.145, blue: 0.153)
    case .zohoPeople: return Color(red: 0.145, green: 0.557, blue: 0.824)
    case .zohoCampaigns: return Color(red: 0.922, green: 0.247, blue: 0.275)
    case .zohoAnalytics: return Color(red: 0.165, green: 0.443, blue: 0.824)
    case .copper: return Color(red: 0.722, green: 0.329, blue: 0.204)
    case .close: return Color(red: 0.090, green: 0.114, blue: 0.180)
    case .zendesk: return Color(red: 0.020, green: 0.188, blue: 0.176)
    case .intercom: return Color(red: 0.110, green: 0.110, blue: 0.110)
    case .freshservice: return Color(red: 0.149, green: 0.725, blue: 0.659)
    case .freshchat: return Color(red: 0.149, green: 0.725, blue: 0.659)
    case .freshmarketer: return Color(red: 0.149, green: 0.725, blue: 0.659)
    case .freshcaller: return Color(red: 0.149, green: 0.725, blue: 0.659)
    case .livechat: return Color(red: 0.020, green: 0.400, blue: 1.000)
    case .liveagent: return Color(red: 0.886, green: 0.137, blue: 0.122)
    case .crisp: return Color(red: 0.318, green: 0.231, blue: 0.922)
    case .tidio: return Color(red: 0.118, green: 0.376, blue: 0.965)
    case .olark: return Color(red: 0.490, green: 0.737, blue: 0.224)
    case .userlike: return Color(red: 0.000, green: 0.663, blue: 0.584)
    case .gladly: return Color(red: 0.922, green: 0.255, blue: 0.196)
    case .kustomer: return Color(red: 0.043, green: 0.118, blue: 0.231)
    case .gorgias: return Color(red: 0.080, green: 0.122, blue: 0.165)
    case .reAmaze: return Color(red: 0.075, green: 0.416, blue: 0.820)
    case .edesk: return Color(red: 0.251, green: 0.165, blue: 0.733)
    case .kayako: return Color(red: 0.000, green: 0.506, blue: 0.396)
    case .acquire: return Color(red: 0.251, green: 0.361, blue: 0.949)
    case .freshdesk: return Color(red: 0.149, green: 0.725, blue: 0.659)
    case .helpScout: return Color(red: 0.196, green: 0.541, blue: 0.878)
    case .front: return Color(red: 0.094, green: 0.137, blue: 0.247)
    case .groove: return Color(red: 0.231, green: 0.478, blue: 0.886)
    case .teamwork: return Color(red: 0.365, green: 0.227, blue: 0.969)
    case .basecamp: return Color(red: 0.102, green: 0.451, blue: 0.251)
    case .wrike: return Color(red: 0.031, green: 0.706, blue: 0.486)
    case .smartsheet: return Color(red: 0.000, green: 0.463, blue: 0.714)
    case .todoist: return Color(red: 0.878, green: 0.200, blue: 0.180)
    case .ticktick: return Color(red: 0.278, green: 0.447, blue: 0.980)
    case .togglTrack: return Color(red: 1.000, green: 0.871, blue: 0.569)
    case .harvest: return Color(red: 0.953, green: 0.388, blue: 0.153)
    case .clockify: return Color(red: 0.012, green: 0.663, blue: 0.957)
    case .tempoTimesheets: return Color(red: 0.102, green: 0.376, blue: 0.671)
    case .zephyrScale: return Color(red: 0.071, green: 0.416, blue: 0.647)
    case .calendly: return Color(red: 0.000, green: 0.420, blue: 0.843)
    case .ontraport: return Color(red: 0.114, green: 0.451, blue: 0.886)
    case .bitrix24: return Color(red: 0.176, green: 0.718, blue: 0.894)
    case .agileCrm: return Color(red: 0.184, green: 0.659, blue: 0.467)
    case .streak: return Color(red: 0.965, green: 0.353, blue: 0.286)
    case .lessAnnoyingCrm: return Color(red: 0.063, green: 0.584, blue: 0.420)
    case .nutshell: return Color(red: 0.929, green: 0.357, blue: 0.137)
    case .teamleader: return Color(red: 0.000, green: 0.655, blue: 0.561)
    case .scoro: return Color(red: 0.137, green: 0.463, blue: 0.941)
    case .odoo: return Color(red: 0.529, green: 0.294, blue: 0.451)
    case .netsuite: return Color(red: 0.780, green: 0.184, blue: 0.247)
    case .sageAccounting: return Color(red: 0.000, green: 0.604, blue: 0.322)
    case .sageIntacct: return Color(red: 0.000, green: 0.604, blue: 0.322)
    case .myob: return Color(red: 0.376, green: 0.176, blue: 0.584)
    case .kashFlow: return Color(red: 0.922, green: 0.337, blue: 0.153)
    case .zohoBooks: return Color(red: 0.890, green: 0.145, blue: 0.153)
    case .zohoInvoice: return Color(red: 0.890, green: 0.145, blue: 0.153)
    case .zohoExpense: return Color(red: 0.890, green: 0.145, blue: 0.153)
    case .zohoDesk: return Color(red: 0.890, green: 0.145, blue: 0.153)
    case .zohoProjects: return Color(red: 0.890, green: 0.145, blue: 0.153)
    case .obsidian: return Color(red: 0.490, green: 0.300, blue: 0.950)
    case .roamResearch: return Color(red: 0.078, green: 0.110, blue: 0.145)
    case .logseq: return Color(red: 0.153, green: 0.682, blue: 0.643)
    case .craft: return Color(red: 0.902, green: 0.278, blue: 0.212)
    case .anytype: return Color(red: 1.000, green: 0.416, blue: 0.482)
    case .yodleeFastLink: return Color(red: 0.075, green: 0.357, blue: 0.451)
    case .mx: return Color(red: 0.086, green: 0.620, blue: 0.514)
    case .finicity: return Color(red: 0.902, green: 0.227, blue: 0.176)
    case .plaidLink: return Color.black
    case .etoro: return Color(red: 0.267, green: 0.682, blue: 0.188)
    case .clay: return Color(red: 0.965, green: 0.416, blue: 0.294)
    case .claygent: return Color(red: 0.965, green: 0.416, blue: 0.294)
    case .phantombuster: return Color(red: 0.482, green: 0.380, blue: 1.000)
    case .texau: return Color(red: 0.129, green: 0.341, blue: 0.918)
    case .evaboot: return Color(red: 0.263, green: 0.757, blue: 0.573)
    case .lemlist: return Color(red: 0.314, green: 0.949, blue: 0.655)
    case .mailshake: return Color(red: 0.153, green: 0.420, blue: 0.984)
    case .woodpecker: return Color(red: 0.145, green: 0.659, blue: 0.424)
    case .replyIo: return Color(red: 0.286, green: 0.345, blue: 0.929)
    case .mixmax: return Color(red: 0.361, green: 0.290, blue: 0.929)
    case .cirrusInsight: return Color(red: 0.055, green: 0.478, blue: 0.737)
    case .spotio: return Color(red: 0.992, green: 0.690, blue: 0.067)
    case .calCom: return Color.black
    case .docusign: return Color(red: 0.29, green: 0.09, blue: 1.0)
    case .dropboxSign: return Color(red: 0.12, green: 0.31, blue: 0.96)
    case .pandaDoc: return Color(red: 0.17, green: 0.43, blue: 0.94)
    case .typeform: return Color(red: 0.15, green: 0.14, blue: 0.13)
    case .surveyMonkey: return Color(red: 0.0, green: 0.75, blue: 0.45)
    case .fillout: return Color(red: 0.36, green: 0.22, blue: 0.96)
    case .mailchimp: return Color(red: 1.0, green: 0.88, blue: 0.32)
    case .klaviyo: return Color(red: 1.0, green: 0.84, blue: 0.20)
    case .convertkit: return Color(red: 0.12, green: 0.15, blue: 0.12)
    case .campaignMonitor: return Color(red: 0.20, green: 0.48, blue: 0.84)
    case .constantContact: return Color(red: 0.10, green: 0.49, blue: 0.77)
    case .line: return Color(red: 0.024, green: 0.780, blue: 0.333)
    case .twist: return Color(red: 0.000, green: 0.541, blue: 0.651)
    }
  }

  var usesWhiteCanvas: Bool {
    self != .x && self != .relayConsole
  }

  var usesEvenOddFill: Bool {
    self == .linkedIn
  }

  private var assetResource: (name: String, fileExtension: String)? {
    switch self {
    case .googleDocs:
      return ("marketplace-logo-google-docs", "png")
    case .tumblr:
      return ("marketplace-logo-tumblr", "svg")
    case .mastodon:
      return ("marketplace-logo-mastodon", "svg")
    case .bluesky:
      return ("marketplace-logo-bluesky", "png")
    case .googleCalendar:
      return ("marketplace-logo-google-calendar", "png")
    case .googleDrive:
      return ("marketplace-logo-google-drive", "png")
    case .googleSearchConsole:
      return ("marketplace-logo-google-search-console", "png")
    case .googleAnalytics:
      return ("marketplace-logo-google-analytics", "svg")
    case .googleMerchantCenter:
      return ("marketplace-logo-google-merchant-center", "png")
    case .youtube:
      return ("marketplace-logo-youtube", "png")
    case .googleClassroom:
      return ("marketplace-logo-google-classroom", "png")
    case .googleMapsPlatform:
      return ("marketplace-logo-google-tasks", "png")
    case .outlook:
      return ("marketplace-logo-outlook", "png")
    case .microsoftTeams:
      return ("marketplace-logo-microsoft-teams", "ico")
    case .oneDrive:
      return ("marketplace-logo-onedrive", "svg")
    case .sharePoint:
      return ("marketplace-logo-sharepoint", "svg")
    case .microsoftPlanner:
      return ("marketplace-logo-microsoft-planner", "svg")
    case .microsoftToDo:
      return ("marketplace-logo-microsoft-to-do", "ico")
    case .microsoftLists:
      return ("marketplace-logo-microsoft-lists", "svg")
    case .oneNote:
      return ("marketplace-logo-onenote", "svg")
    case .microsoftBookings:
      return ("marketplace-logo-microsoft-bookings", "svg")
    case .microsoftPowerBI:
      return ("marketplace-logo-microsoft-power-bi", "svg")
    case .microsoftDynamics365:
      return ("marketplace-logo-microsoft-dynamics-365", "svg")
    case .microsoftVivaEngage:
      return ("marketplace-logo-microsoft-viva-engage", "svg")
    case .zoom:
      return ("marketplace-logo-zoom", "svg")
    case .discord:
      return ("marketplace-logo-discord", "svg")
    case .postHog:
      return ("marketplace-logo-posthog", "svg")
    case .sentry:
      return ("marketplace-logo-sentry", "svg")
    case .datadog:
      return ("marketplace-logo-datadog", "ico")
    case .pagerDuty:
      return ("marketplace-logo-pagerduty", "ico")
    case .cloudflare:
      return ("marketplace-logo-cloudflare", "ico")
    case .vercel:
      return ("marketplace-logo-vercel", "ico")
    case .heroku:
      return ("marketplace-logo-heroku", "ico")
    case .digitalOcean:
      return ("marketplace-logo-digitalocean", "ico")
    case .firebase:
      return ("marketplace-logo-firebase", "png")
    case .supabase:
      return ("marketplace-logo-supabase", "svg")
    case .okta:
      return ("marketplace-logo-okta", "ico")
    case .bambooHR:
      return ("marketplace-logo-bamboohr", "ico")
    case .greenhouse:
      return ("marketplace-logo-greenhouse", "ico")
    case .lever:
      return ("marketplace-logo-lever", "png")
    case .notion:
      return ("marketplace-logo-notion", "png")
    case .microsoftClarity:
      return ("marketplace-logo-microsoft-clarity", "ico")
    case .telemetryDeck:
      return ("marketplace-logo-telemetrydeck", "svg")
    case .slack:
      return ("marketplace-logo-slack", "svg")
    case .github:
      return ("marketplace-logo-github", "svg")
    case .gitlab:
      return ("marketplace-logo-gitlab", "svg")
    case .bitbucket:
      return ("marketplace-logo-bitbucket", "svg")
    case .linear:
      return ("marketplace-logo-linear", "svg")
    case .asana:
      return ("marketplace-logo-asana", "svg")
    case .trello: return ("marketplace-logo-trello", "svg")
    case .clickUp: return ("marketplace-logo-clickup", "svg")
    case .monday: return ("marketplace-logo-monday-com", "svg")
    case .airtable: return ("marketplace-logo-airtable", "svg")
    case .dropbox: return ("marketplace-logo-dropbox", "svg")
    case .box: return ("marketplace-logo-box", "svg")
    case .figma: return ("marketplace-logo-figma", "svg")
    case .figjam: return ("marketplace-logo-figma", "svg")
    case .miro: return ("marketplace-logo-miro", "svg")
    case .canva: return ("marketplace-logo-canva", "svg")
    case .webflow: return ("marketplace-logo-webflow", "svg")
    case .wordpressCom: return ("marketplace-logo-wordpress-com", "svg")
    case .contentful: return ("marketplace-logo-contentful", "svg")
    case .sanity: return ("marketplace-logo-sanity", "svg")
    case .strapiCloud: return ("marketplace-logo-strapi-cloud", "svg")
    case .shopify: return ("marketplace-logo-shopify", "svg")
    case .wooCommerce: return ("marketplace-logo-woocommerce", "svg")
    case .stripe: return ("marketplace-logo-stripe", "svg")
    case .paypal: return ("marketplace-logo-paypal", "svg")
    case .xero: return ("marketplace-logo-xero", "svg")
    case .quickBooks: return ("marketplace-logo-quickbooks", "png")
    case .freshBooks: return ("marketplace-logo-freshbooks", "ico")
    case .wave: return ("marketplace-logo-wave", "png")
    case .freeAgent: return ("marketplace-logo-freeagent", "png")
    case .salesforce: return ("marketplace-logo-salesforce", "svg")
    case .hubSpot: return ("marketplace-logo-hubspot", "svg")
    case .pipedrive: return ("marketplace-logo-pipedrive", "png")
    case .zoho: return ("marketplace-logo-zoho", "svg")
    case .zohoPeople: return ("marketplace-logo-zoho", "svg")
    case .zohoCampaigns: return ("marketplace-logo-zoho", "svg")
    case .zohoAnalytics: return ("marketplace-logo-zoho", "svg")
    case .copper: return ("marketplace-logo-copper", "ico")
    case .close: return ("marketplace-logo-close", "png")
    case .zendesk: return ("marketplace-logo-zendesk", "png")
    case .intercom: return ("marketplace-logo-intercom", "ico")
    case .freshservice: return ("marketplace-logo-freshdesk", "ico")
    case .freshchat: return ("marketplace-logo-freshdesk", "ico")
    case .freshmarketer: return ("marketplace-logo-freshdesk", "ico")
    case .freshcaller: return ("marketplace-logo-freshdesk", "ico")
    case .livechat: return ("marketplace-logo-intercom", "ico")
    case .liveagent: return ("marketplace-logo-intercom", "ico")
    case .crisp: return ("marketplace-logo-intercom", "ico")
    case .tidio: return ("marketplace-logo-intercom", "ico")
    case .olark: return ("marketplace-logo-intercom", "ico")
    case .userlike: return ("marketplace-logo-intercom", "ico")
    case .gladly: return ("marketplace-logo-intercom", "ico")
    case .kustomer: return ("marketplace-logo-intercom", "ico")
    case .gorgias: return ("marketplace-logo-intercom", "ico")
    case .reAmaze: return ("marketplace-logo-intercom", "ico")
    case .edesk: return ("marketplace-logo-intercom", "ico")
    case .kayako: return ("marketplace-logo-intercom", "ico")
    case .acquire: return ("marketplace-logo-intercom", "ico")
    case .freshdesk: return ("marketplace-logo-freshdesk", "ico")
    case .helpScout: return ("marketplace-logo-help-scout", "svg")
    case .front: return ("marketplace-logo-front", "png")
    case .groove: return ("marketplace-logo-groove", "ico")
    case .teamwork: return ("marketplace-logo-teamwork", "png")
    case .basecamp: return ("marketplace-logo-basecamp", "png")
    case .wrike: return ("marketplace-logo-wrike", "png")
    case .smartsheet: return ("marketplace-logo-smartsheet", "png")
    case .todoist: return ("marketplace-logo-todoist", "png")
    case .ticktick: return ("marketplace-logo-ticktick", "svg")
    case .togglTrack: return ("marketplace-logo-toggl-track", "svg")
    case .harvest: return ("marketplace-logo-harvest", "png")
    case .clockify: return ("marketplace-logo-clockify", "svg")
    case .calendly: return ("marketplace-logo-calendly", "ico")
    case .ontraport: return nil
    case .bitrix24: return nil
    case .agileCrm: return nil
    case .streak: return nil
    case .lessAnnoyingCrm: return nil
    case .nutshell: return nil
    case .teamleader: return nil
    case .scoro: return nil
    case .odoo: return nil
    case .netsuite: return nil
    case .sageAccounting: return nil
    case .sageIntacct: return nil
    case .myob: return nil
    case .kashFlow: return nil
    case .zohoBooks: return nil
    case .zohoInvoice: return nil
    case .zohoExpense: return nil
    case .zohoDesk: return nil
    case .zohoProjects: return nil
    case .obsidian: return ("marketplace-logo-obsidian", "ico")
    case .roamResearch: return ("marketplace-logo-roam-research", "ico")
    case .logseq: return ("marketplace-logo-logseq", "png")
    case .craft: return ("marketplace-logo-craft", "png")
    case .anytype: return ("marketplace-logo-anytype", "png")
    case .yodleeFastLink: return nil
    case .mx: return nil
    case .finicity: return nil
    case .plaidLink: return nil
    case .etoro: return nil
    case .clay: return nil
    case .claygent: return nil
    case .phantombuster: return nil
    case .texau: return nil
    case .evaboot: return nil
    case .lemlist: return nil
    case .mailshake: return nil
    case .woodpecker: return nil
    case .replyIo: return nil
    case .mixmax: return nil
    case .cirrusInsight: return nil
    case .spotio: return nil
    case .calCom: return ("marketplace-logo-cal-com", "ico")
    case .docusign: return ("marketplace-logo-docusign", "ico")
    case .dropboxSign: return ("marketplace-logo-dropbox-sign", "png")
    case .pandaDoc: return ("marketplace-logo-pandadoc", "ico")
    case .typeform: return ("marketplace-logo-typeform", "ico")
    case .surveyMonkey: return ("marketplace-logo-surveymonkey", "png")
    case .fillout: return ("marketplace-logo-fillout", "ico")
    case .mailchimp: return ("marketplace-logo-mailchimp", "ico")
    case .klaviyo: return ("marketplace-logo-klaviyo", "png")
    case .convertkit: return ("marketplace-logo-convertkit", "png")
    case .campaignMonitor: return ("marketplace-logo-campaign-monitor", "png")
    case .constantContact: return ("marketplace-logo-constant-contact", "png")
    case .line: return ("marketplace-logo-line", "png")
    case .twist: return ("marketplace-logo-twist", "svg")
    case .relayConsole, .x, .facebookPages, .instagramBusiness, .linkedIn, .exaSearch, .gmail,
      .tempoTimesheets, .zephyrScale, .adobeAcrobatSign, .signNow, .signRequest, .signeasy,
      .oneSpanSign, .rightSignature, .getAccept, .qwilr, .proposify, .betterProposals, .concord,
      .juro, .ironclad, .linkSquares, .spotDraft, .contractbook, .logRocket, .smartlook, .crazyEgg,
      .appcues, .userflow, .userpilot, .chameleon, .vitally, .gainsight, .totango, .custify,
      .planhat, .clientsuccess, .freshsales, .insightly, .nimble, .capsuleCrm, .keap:
      return nil
    }
  }

  var assetImage: NSImage? {
    if self == .relayConsole {
      return relayConsoleWordmarkImage()
    }
    guard let resource = assetResource,
      let url = Bundle.module.url(forResource: resource.name, withExtension: resource.fileExtension)
    else {
      return nil
    }
    return NSImage(contentsOf: url)
  }

  var viewBoxSize: CGSize {
    switch self {
    case .x, .facebookPages, .instagramBusiness, .linkedIn:
      return CGSize(width: 24, height: 24)
    case .exaSearch:
      return CGSize(width: 151, height: 182)
    case .gmail:
      return CGSize(width: 88, height: 88)
    default:
      return CGSize(width: 24, height: 24)
    }
  }

  var viewBoxOrigin: CGPoint {
    switch self {
    case .gmail:
      return CGPoint(x: 52, y: 32)
    default:
      return .zero
    }
  }

  var pathSegments: [ApplicationsBrandPathSegment] {
    switch self {
    case .gmail:
      // Gmail mark cropped from Google's hosted Workspace products SVG.
      // Source: https://www.gstatic.com/apps/signup/resources/products_lockup_icon.svg
      return [
        ApplicationsBrandPathSegment(
          pathData: "M58 108h14V74L52 59v43c0 3.315 2.685 6 6 6z",
          fill: Color(red: 0.259, green: 0.522, blue: 0.957)
        ),
        ApplicationsBrandPathSegment(
          pathData: "M120 108h14c3.315 0 6-2.685 6-6V59l-20 15v34z",
          fill: Color(red: 0.204, green: 0.659, blue: 0.325)
        ),
        ApplicationsBrandPathSegment(
          pathData: "M120 48v26l20-15v-8c0-7.415-8.465-11.65-14.4-7.2L120 48z",
          fill: Color(red: 0.984, green: 0.737, blue: 0.016)
        ),
        ApplicationsBrandPathSegment(
          pathData: "M72 74V48l24 18 24-18v26L96 92 72 74z",
          fill: Color(red: 0.918, green: 0.263, blue: 0.208),
          usesEvenOddFill: true
        ),
        ApplicationsBrandPathSegment(
          pathData: "M52 51v8l20 15V48l-5.6-4.2C60.465 39.35 52 43.585 52 51z",
          fill: Color(red: 0.773, green: 0.133, blue: 0.122)
        ),
      ]
    case .x, .facebookPages, .instagramBusiness, .linkedIn, .exaSearch:
      return [
        ApplicationsBrandPathSegment(
          pathData: pathData,
          fill: markColor,
          usesEvenOddFill: usesEvenOddFill
        )
      ]
    default:
      return []
    }
  }

  var pathData: String {
    switch self {
    case .x:
      return
        "M14.234 10.162L22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299l-.929-1.329L3.076 1.56h3.182l5.965 8.532l.929 1.329l7.754 11.09h-3.182z"
    case .facebookPages:
      // Facebook app "f" mark, used under Meta Brand Resource guidance.
      // Source: https://about.meta.com/brand/resources/facebookapp/logo/
      return
        "M13.5 8H16l.5-3h-3c-3 0-4.5 1.8-4.5 4.7V12H6v3h3v9h3.5v-9H16l.5-3h-4V9.9c0-1.2.4-1.9 1-1.9z"
    case .instagramBusiness:
      // Instagram camera glyph under Meta Instagram brand guidance.
      // Source: https://about.meta.com/brand/resources/instagram/
      return
        "M7 2h10c2.76 0 5 2.24 5 5v10c0 2.76-2.24 5-5 5H7c-2.76 0-5-2.24-5-5V7c0-2.76 2.24-5 5-5zm0 2C5.34 4 4 5.34 4 7v10c0 1.66 1.34 3 3 3h10c1.66 0 3-1.34 3-3V7c0-1.66-1.34-3-3-3H7zm5 3a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm5.5-3.25a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z"
    case .linkedIn:
      return
        "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 "
        + "3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065z"
        + "m1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
    case .exaSearch:
      return
        "M150.5 14.1064C150.5 14.3356 150.421 14.5579 150.277 14.736L88.4766 91L150.277 167.264C150.421 167.442 150.5 167.664 150.5 167.894V181C150.5 181.552 150.052 182 149.5 182H1"
        + "C0.44772 182 0 181.552 0 181V0.999995C0 0.44771 0.447715 0 1 0H149.5C150.052 0 150.5 0.447715 150.5 1V14.1064ZM30.4059 162.719H121.728L76.0664 106.326L30.4059 162.719Z"
        + "M19.2949 100.261V145.787L56.1572 100.261H19.2949ZM19.2949 80.9801H55.5434L19.2949 36.2121V80.9801ZM76.0664 75.6731L121.728 19.281H30.4059L76.0664 75.6731Z"
    default:
      return ""
    }
  }
}
