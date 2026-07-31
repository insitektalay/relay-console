export const INSTAGRAM_BUSINESS_ENDPOINT_FAMILIES = [
  {
    id: "oauth",
    label: "Instagram Login",
    docsUrl:
      "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login",
    guidance:
      "Request exactly instagram_business_basic for one professional account; no Facebook Page binding is used.",
  },
  {
    id: "account",
    label: "Bound professional account",
    docsUrl:
      "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started",
    guidance:
      "Read fixed safe fields through /me and bind the returned professional account id.",
  },
  {
    id: "owned_media",
    label: "Owned media metadata",
    docsUrl:
      "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/instagram-api-overview",
    guidance:
      "Read one page of at most ten /me/media items and one ownership-checked media id with fixed metadata fields.",
  },
];
