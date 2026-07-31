export const REDDIT_ENDPOINT_FAMILIES = [
  { id: "oauth", label: "Reddit OAuth API", docsUrl: "https://github.com/reddit-archive/reddit/wiki/OAuth2", guidance: "Use least-privilege OAuth scopes and respect subreddit moderator permission boundaries." },
  { id: "listing", label: "Listings and thing APIs", docsUrl: "https://www.reddit.com/dev/api/", guidance: "Read subreddit listings, comments, and user context with bounded queries." },
  { id: "submit_comment", label: "Submit, edit, and comment endpoints", docsUrl: "https://www.reddit.com/dev/api/", guidance: "Use api/submit, api/comment, api/editusertext, and deletion endpoints only after approval." },
  { id: "moderation", label: "Moderator endpoints", docsUrl: "https://www.reddit.com/dev/api/", guidance: "Moderation actions such as approve/remove/lock/sticky/ban require explicit approval and moderator permission checks." },
];
