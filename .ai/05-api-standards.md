# API Standards

REST over Express + TypeScript. Base path and version: **`/api/v1`** (no other versioning). Resource-oriented, kebab-case, `:xxxId` path params. Socket.IO handles real-time separately (not a REST replacement).

The frontend calls high-level operations; it does not orchestrate internal algorithms.

## Endpoints (all under `/api/v1` unless noted)
| Resource | Endpoints |
|---|---|
| auth | `POST /auth/register` `login` `logout` `refresh` `forgot-password` `reset-password` `verify-email` `resend-verification` · `GET /auth/me` · `PATCH /auth/password` |
| users | `GET` `PATCH /users/me` · `POST /users/:userId/deactivate` |
| providers | `GET /providers` · `GET /providers/:providerId` · `POST /providers` · `PATCH /providers/me` |
| storages | `GET /storages` `/storages/search` `/storages/mine` `/storages/:storageId` · `POST /storages` · `PATCH /storages/:storageId` · `POST /storages/:storageId/activate` `deactivate` |
| storage-availability | `GET /storage-availability` · `POST /storage-availability/check` |
| vehicles | `GET /vehicles` `/vehicles/mine` `/vehicles/:vehicleId` · `POST /vehicles` · `PATCH /vehicles/:vehicleId` · `POST /vehicles/:vehicleId/activate` `deactivate` |
| transport-options | `GET /transport-options` · `POST /transport-options/check` |
| service-requests | `GET /service-requests/mine` `/:requestId` · `POST /service-requests` · `PATCH /service-requests/:requestId` · `POST /service-requests/:requestId/cancel` |
| matching | `POST /matching/search` |
| recommendations | `POST /recommendations` (main farmer operation; rate-limited, `01` §Routing) |
| routes | `POST /routes/shortest` `/routes/to-storage` · `GET /bookings/:bookingId/route` |
| costs | `POST /costs/storage` `/costs/transport` `/costs/calculate` |
| bookings | `GET /bookings/mine` `/bookings/history` `/bookings/:bookingId` `/bookings/:bookingId/status` · `POST /bookings` (requires `Idempotency-Key`) · `PATCH /bookings/:bookingId` · `POST /bookings/:bookingId/approve` `reject` `confirm` `activate` `complete` `cancel` |
| installments / extensions / overstay | `GET /bookings/:bookingId/installments` · `POST /bookings/:bookingId/installments/:installmentId/collect` `waive` `waive-deposit` · `GET /bookings/:bookingId/overstay` · `POST /bookings/:bookingId/overstay/confirm-deemed-return` · `POST /bookings/:bookingId/extend` · `GET /bookings/:bookingId/extensions` · `POST /bookings/:bookingId/extensions/:extensionId/approve` `reject` `cancel` |
| payments | Authenticated payment initiation plus provider-specific callback/return/IPN endpoints; exact paths and request/response contracts are defined during #19 implementation |
| notifications | `GET /notifications` |
| feature-flags | `GET /admin/feature-flags` · `PATCH /admin/feature-flags/:flagKey` (global default) · `PUT /admin/feature-flags/:flagKey/overrides/:scope/:scopeId` `DELETE .../overrides/:scope/:scopeId` (`scope` = `role`\|`provider`\|`user`; `scopeId` is a `role_key` when `scope=role`, a `userId` otherwise) |
| roles and authorization | Existing admin role/assignment examples are historical; custom-role and permission-management operations must follow ADR-0003 and #11. There are no structural roles or `users.role` checks. Exact route paths/contracts for permission catalog, role, and user-assignment operations remain to be reconciled before implementation. |
| admin console | Backend operations and operation-permission requirements are defined by #11 and ADR-0012. The UI is deferred. Exact routes/contracts remain to be designed; do not infer additional operations from this scope. |
| health | `GET /health` `/health/database` (root path) |

Do not invent endpoints outside this table or the current task. Action verbs (`activate`, `approve`, …) are POST sub-paths. No application endpoint performs a hard delete; deletion is soft deletion/deactivation only, per ADR-0003 and `10`. A `DELETE` method may remove an association/override where that operation is explicitly defined, but must not hard-delete a domain entity.

## Rules
- `POST /bookings` is the **single** endpoint for creating a booking, regardless of whether it's storage-only, transport-only, or both — the request body's `service_type`/`booking_type` decides which child row(s) get created. There is no `/bookings/storage-only` or `/bookings/transport-only` — never split this into separate endpoints (`00` §Booking scope).
- `POST /recommendations` runs eligibility → matching → route → cost → rank internally and returns ranked deals with: storage cost, transport cost, total cost, route distance, available capacity, provider rating. Own transport: transport cost not applicable, total = storage cost, transport excluded from ranking. Rate-limited per user/IP; route distances are cache-backed (`01` §Routing).
- Transport cost = `base_charge + distance × cost_per_km` (formula: `00`).
- `409 Conflict` = capacity conflict (e.g. 400 kg + 300 kg requested against 500 kg free: only one may succeed).
- `403 Forbidden` = an ownership/party check failed, a feature flag resolved to disabled, or the caller lacks a required permission. Authorization is explicit and server-side; role names grant no authority (ADR-0003, #10, #11).
- Booking lifecycle: `requested → approved|rejected → confirmed → active → completed`, plus `cancelled` and `expired` (TTL sweep, `01` §Background Jobs).
- `POST /bookings` requires an `Idempotency-Key` header; a repeated key returns the original response (`01` §Idempotency).
- Authentication follows ADR-0011: access requests use `Authorization: Bearer <access-token>`; `/auth/refresh` uses the same header scheme with a refresh token and rejects access tokens. Access tokens last 15 minutes; refresh tokens last 30 days and rotate on successful refresh. Every account operation requires verified email and an active session; unverified login issues no tokens. Verification links are single-use, expire after 24 hours, and are invalidated by resend.
- Signup requires email; an optional phone is normalized to E.164, stored unverified, masked/labeled in the UI, and is not usable for login or recovery in V1. Contact changes require verification before activation; preserve contact history and switch email only after the new email is verified.
- Multiple sessions are allowed. Logout revokes the current session; revoke-all revokes every session. Both take effect immediately for access and refresh tokens.
- #19 payment initiation is authenticated and idempotent. Provider callback/return/IPN endpoints verify provider state and payment-attempt references; browser redirects alone are never payment confirmation. Payment callbacks do not transition booking state.
- The ADR-0010 collection endpoints record deterministic academic simulations; they do not initiate a payment-provider checkout. Capacity is rechecked transactionally on extension approval, and deemed return requires `overstay.confirm.any`.
- Admin endpoints declare an explicit permission per operation. Use the base permission for party records and `.any` only for cross-party access; never use an `.own` suffix. Defined booking lifecycle overrides require a reason, remain subject to the state machine and business invariants, and create audit entries. Sensitive payment, dispute, and ledger reads are audited. See #11 and ADR-0012.
- Business errors are enforced in the backend (unsupported crop, no capacity, unavailable period, no suitable vehicle, invalid state transition, capacity conflict, ownership violation, disabled feature).

## Contract preservation (when touching an existing endpoint)
Keep its path, method, request contract, response contract, error behavior and auth requirements. The existing implementation is the source of truth. Do not add a new response envelope for style, and do not rename fields.

## Domain field names seen in the design
`userId providerId storageId vehicleId requestId bookingId cropType quantity capacity availability storageCost transportCost totalCost`

## Documentation
API docs are generated from Zod schemas (via an OpenAPI generator), not hand-maintained separately from validation — keeps the spec from drifting out of sync with actual request/response shapes.

## Undecided (do not assume; preserve existing behavior)
- Request wrapper; success envelope (`{success,message,data}` is **not** a convention); error envelope; validation-error format; business error codes.
- Status-code matrix (`409` capacity conflict and `403` ownership/feature-flag are defined; the rest is open).
- Pagination (params and metadata).
- Auth response JSON, token field names and token serialization/format. Header schemes and lifetimes are decided in ADR-0011.
- JSON field casing (do not force camelCase or snake_case globally).
- Per-endpoint JSON schemas.
- Socket.IO event names, payloads, connection auth, ack format.
- Paths not yet defined: notifications (unread, mark read, read-all, delete), crops CRUD/search, storage-crop config (nested under storages), reviews, admin operations (scope in #11; route design remains open), matching result retrieval, provider-side booking list, user get-by-id/list.
# Planning status (2026-11-08)

Legacy endpoint examples below include role-based authorization and feature-flag precedence that conflict with ADR-0003 and issue #10. Treat them as historical drafts, not implementation contracts. Before feature implementation, reconcile every route and permission against the accepted server-side permission model. Financial endpoints for refunds, installments, ledger, commission, disputes and settlement are academic-grade; payout/refund/settlement execution is simulated. Payment routes are sandbox-only. Admin operations follow #11 and ADR-0012; deletion is soft deletion/deactivation only, and no hard-delete endpoint is permitted.
