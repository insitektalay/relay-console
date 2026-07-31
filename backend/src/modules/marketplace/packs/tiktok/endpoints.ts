export const TIKTOK_ENDPOINT_FAMILIES = [
  { id: "login_kit", label: "Login Kit OAuth", docsUrl: "https://developers.tiktok.com/doc/login-kit-web", guidance: "Use authorized creator tokens and approved scopes only." },
  { id: "content_posting", label: "Content Posting API", docsUrl: "https://developers.tiktok.com/doc/content-posting-api-get-started", guidance: "Use Direct Post or Upload flow only after content, disclosure, and account checks." },
  { id: "creator_info", label: "Creator Info query", docsUrl: "https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info", guidance: "Check creator limits, privacy options, duet/stitch/comment settings before posting." },
  { id: "post_status", label: "Post status fetch", docsUrl: "https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status", guidance: "Poll status conservatively and report failures without retry storms." },
];
