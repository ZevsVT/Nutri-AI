# Nutri-AI production API

The backend exposes version `v1` at `/api/v1`. Private resources require the
Issue #8 session cookie. In development contract tests, the authentication
foundation also accepts `x-development-user-id`; this header is disabled in
staging and production.

Every JSON success response is:

```json
{ "success": true, "data": {}, "meta": {} }
```

List endpoints return `page`, `pageSize`, `total`, and `totalPages` in `meta`.
`pageSize` defaults to 20 and is capped at 100. Errors never expose provider,
database, or stack-trace details:

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid request body" },
  "requestId": "req_example"
}
```

## Endpoint map

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /foods/search?q=&locale=&page=&pageSize=` | Public | Active canonical food search |
| `GET /foods/:id` | Public | Food and current nutrition provenance |
| `POST /meals` | Required | Create a confirmed manual meal |
| `GET /meals` | Required | User diary with date/type/status filters |
| `GET/PATCH/DELETE /meals/:id` | Required | Owned meal read, editable metadata, soft delete |
| `POST /meal-analysis` | Required | Accept an image/input reference and create a pending job |
| `GET /meal-analysis/:id` | Required | Poll `PENDING`, `PROCESSING`, `READY`, or `FAILED` |
| `POST /meal-analysis/:id/confirm` | Required | Apply reviewed items and persist snapshots |
| `GET /nutrition/daily?date=` | Required | Confirmed meal totals for a day |
| `GET /nutrition/weekly?from=&to=` | Required | Confirmed meal totals for a period |
| `POST /ai/chat` | Required | Grounded assistant response from server context |
| `GET /recipes` | Public | Published recipe browsing |
| `POST/GET /water` | Required | Create and list water logs |
| `GET /insights` | Required | User-owned transparent nutrition insights |
| `POST /barcode/scan` | Required | Provider-neutral barcode lookup contract |

## Confirmation semantics

Recognition predictions are not nutrition facts. Confirmation validates the
user-owned analysis and every corrected food, resolves the active nutrition
source/version, calculates portions, writes `MealItemNutrition` snapshots, and
marks the meal confirmed in one transaction. Snapshots are write-once and all
daily/weekly totals read those snapshots. Retrying a completed confirmation is
safe and does not recalculate historical values.

Meal ownership is enforced in the service/repository boundary using the
authenticated user ID. A missing owned resource is reported as a stable
`MEAL_NOT_FOUND`, `FOOD_NOT_FOUND`, or `ANALYSIS_NOT_FOUND` error rather than
revealing whether another user owns it.

## Stable error codes

`VALIDATION_ERROR`, `AUTHENTICATION_ERROR`, `AUTHORIZATION_ERROR`, `NOT_FOUND`,
`FOOD_NOT_FOUND`, `MEAL_NOT_FOUND`, `ANALYSIS_NOT_FOUND`, `CONFLICT`,
`INVALID_STATE`, `ANALYSIS_FAILED`, `ANALYSIS_NOT_READY`,
`NUTRITION_DATA_UNAVAILABLE`, `AI_ANALYSIS_ERROR`, `EXTERNAL_SERVICE_ERROR`,
`STORAGE_ERROR`, `DATABASE_ERROR`, `RATE_LIMITED`, and
`INTERNAL_SERVER_ERROR`.

The API uses `400` for malformed input, `401`/`403` for auth failures, `404`
for missing owned resources, `201` for creation, `202` for asynchronous
analysis creation, `204` for soft-delete success, `409` for invalid state,
`429` for rate limits, and `5xx` for dependency or unexpected failures.
