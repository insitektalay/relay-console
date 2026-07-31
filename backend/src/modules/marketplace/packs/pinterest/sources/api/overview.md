# Pinterest API Overview

Auth model: Pinterest API v5 OAuth 2.0. Request minimum read/write scopes and validate the authenticated user account, board ID, section ID, and media source before writes.

Object model: User accounts, boards, board sections, Pins, Pin media/source types, analytics, organic content. Ads/catalog objects are distinct and not part of organic Pin publishing unless separately approved.

Endpoint families:
- GET /v5/user_account reads account identity.
- GET /v5/boards, POST /v5/boards, PATCH /v5/boards/{board_id} manage boards.
- GET /v5/board_sections and POST /v5/boards/{board_id}/sections manage sections.
- GET /v5/pins, POST /v5/pins, GET /v5/pins/{pin_id}, PATCH /v5/pins/{pin_id}, DELETE /v5/pins/{pin_id} manage Pins.
- Analytics endpoints require analytics:read and should remain read-only unless ads workflows are separately approved.

Rate limits/quotas: Pinterest documents universal limits: Trial access 1,000 requests per day for all API requests; Standard access 100 requests per second per user per app. Category examples include org_read 1,000 requests/minute standard and org_write 100 requests/minute standard, with trial org_write 300/day. Headers include x-ratelimit-limit, x-ratelimit-remaining, and x-ratelimit-reset.

Events/webhooks: Pinterest organic API support should be treated as request/response plus bounded polling unless official webhooks are configured for the exact surface. Do not claim DMs or comment automation.

Official docs:
- https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
- https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/
- https://developers.pinterest.com/docs/reference/rate-limits/
