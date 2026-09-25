# API Standards

REST over Express + TypeScript. Base path and version: **`/api/v1`** (no other versioning). Resource-oriented, kebab-case, `:xxxId` path params. Socket.IO handles real-time separately (not a REST replacement).

The frontend calls high-level operations; it does not orchestrate internal algorithms.

## Endpoints (all under `/api/v1` unless noted)
| Resource | Endpoints |
|---|---|
| auth | `POST /auth/register` `login` `logout` `refresh` `forgot-password` `reset-password` `verify-email` `resend-verification` · `GET /auth/me` · `PATCH /auth/password` |
| users | `GET` `PATCH /users/me` · `DELETE /users/:userId` |
| providers | `GET /providers` · `GET /providers/:providerId` · `POST /providers` · `PATCH /providers/me` |
| storages | `GET /storages` `/storages/search` `/storages/mine` `/storages/:storageId` · `POST /storages` · `PATCH` `DELETE /storages/:storageId` · `POST /storages/:storageId/activate` `deactivate` |
| storage-availability | `GET /storage-availability` · `POST /storage-availability/check` |
| vehicles | `GET /vehicles` `/vehicles/mine` `/vehicles/:vehicleId` · `POST /vehicles` · `PATCH` `DELETE /vehicles/:vehicleId` · `POST /vehicles/:vehicleId/activate` `deactivate` |
| transport-options | `GET /transport-options` · `POST /transport-options/check` |
| service-requests | `GET /service-requests/mine` `/:requestId` · `POST /service-requests` · `PATCH` `DELETE /service-requests/:requestId` |
| matching | `POST /matching/search` |
| recommendations | `POST /recommendations` (main farmer operation) |
| routes | `POST /routes/shortest` `/routes/to-storage` · `GET /bookings/:bookingId/route` |
| costs | `POST /costs/storage` `/costs/transport` `/costs/calculate` |
| bookings | `GET /bookings/mine` `/bookings/history` `/bookings/:bookingId` `/bookings/:bookingId/status` · `POST /bookings` · `PATCH /bookings/:bookingId` · `POST /bookings/:bookingId/approve` `reject` `confirm` `activate` `complete` `cancel` |
| notifications | `GET /notifications` |
| health | `GET /health` `/health/database` (root path) |

Do not invent endpoints outside this table or the current task. Action verbs (`activate`, `approve`, …) are POST sub-paths.

## Rules
- `POST /recommendations` runs eligibility → matching → route → cost → rank internally and returns ranked deals with: storage cost, transport cost, total cost, route distance, available capacity, provider rating. Own transport: transport cost not applicable, total = storage cost, transport excluded from ranking.
- Transport cost = `base_charge + distance × cost_per_km` (formula: `00`).
- `409 Conflict` = capacity conflict (e.g. 400 kg + 300 kg requested against 500 kg free: only one may succeed).
- Booking lifecycle: `requested → approved|rejected → confirmed → active → completed`, plus `cancelled`.
- Business errors are enforced in the backend (unsupported crop, no capacity, unavailable period, no suitable vehicle, invalid state transition, capacity conflict).

## Contract preservation (when touching an existing endpoint)
Keep its path, method, request contract, response contract, error behavior and auth requirements. The existing implementation is the source of truth. Do not add a new response envelope for style, and do not rename fields.

## Domain field names seen in the design
`userId providerId storageId vehicleId requestId bookingId cropType quantity capacity availability storageCost transportCost totalCost`

## Undecided (do not assume; preserve existing behavior)
- Request wrapper; success envelope (`{success,message,data}` is **not** a convention); error envelope; validation-error format; business error codes.
- Status-code matrix (only `409` for capacity conflict is defined).
- Pagination (params and metadata).
- Auth response JSON, token field names, token transport (body vs cookie).
- JSON field casing (do not force camelCase or snake_case globally).
- Per-endpoint JSON schemas.
- Socket.IO event names, payloads, connection auth, ack format.
- Paths not yet defined: notifications (unread, mark read, read-all, delete), crops CRUD/search, storage-crop config (nested under storages), reviews, admin, road-network management, matching result retrieval, provider-side booking list, user get-by-id/list.
