# Pinterest Endpoint Families

## 1. GET /v5/user_account reads account identity.

## 2. GET /v5/boards, POST /v5/boards, PATCH /v5/boards/{board_id} manage boards.

## 3. GET /v5/board_sections and POST /v5/boards/{board_id}/sections manage sections.

## 4. GET /v5/pins, POST /v5/pins, GET /v5/pins/{pin_id}, PATCH /v5/pins/{pin_id}, DELETE /v5/pins/{pin_id} manage Pins.

## 5. Analytics endpoints require analytics:read and should remain read-only unless ads workflows are separately approved.

Approval rule: do not call write/delete/moderation endpoints until the user has approved exact native account, native object ID, payload, and visibility.

Official docs:
- https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
- https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/
- https://developers.pinterest.com/docs/reference/rate-limits/
