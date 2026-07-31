export const X_ENDPOINT_FAMILIES = [
  {
    id: "oauth",
    label: "Relay-owned OAuth 2.0 PKCE",
    docsUrl:
      "https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code",
    guidance:
      "Request exactly tweet.read users.read tweet.write offline.access through the Railway callback.",
  },
  {
    id: "account",
    label: "Connected account",
    docsUrl: "https://docs.x.com/x-api/users/lookup/me",
    guidance: "Read only /2/users/me and expose id, name, and username.",
  },
  {
    id: "own_posts",
    label: "Own original Posts",
    docsUrl: "https://docs.x.com/x-api/users/get-posts",
    guidance:
      "Read one page of at most ten Posts for the bound account, excluding replies and reposts.",
  },
  {
    id: "publish",
    label: "Plain-text publishing",
    docsUrl: "https://docs.x.com/x-api/posts/create-post",
    guidance:
      "Create one non-URL plain-text Post with made_with_ai=true; never automatically retry an ambiguous write.",
  },
];
