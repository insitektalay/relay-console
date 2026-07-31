const GOOGLE_PROVIDER_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "google-vault": "Google Vault",
  "google-drive": "Google Drive",
  "google-docs": "Google Docs",
  "google-sheets": "Google Sheets",
  "google-slides": "Google Slides",
  "google-forms": "Google Forms",
  "google-tasks": "Google Tasks",
  "google-contacts": "Google Contacts",
  "google-photos": "Google Photos",
  "google-meet": "Google Meet",
  "google-chat": "Google Chat",
  "google-ads": "Google Ads",
  "google-analytics": "Google Analytics",
  "google-search-console": "Google Search Console",
  "google-business-profile": "Google Business Profile",
  "google-merchant-center": "Google Merchant Center",
  youtube: "YouTube",
  "google-classroom": "Google Classroom",
});

export function relayGoogleProviderName(slug: string): string {
  return GOOGLE_PROVIDER_NAMES[slug] ?? "Google";
}
