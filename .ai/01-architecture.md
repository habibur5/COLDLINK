# ColdLink Architecture

## Tiers
```text
React (presentation) ── REST + Socket.IO ──▶ Node/Express/TS/Prisma ORM (application) ──▶ MariaDB (data)
                                                          │
                                                          └──▶ Redis (jobs queue, distance cache, flag cache)
```
- **All business decisions live in the backend**: eligibility, matching, routing, cost, ranking, booking, capacity. The frontend never decides or orchestrates them.
- Frontend calls one high-level `POST /api/v1/recommendations`; it does not chain matching → route → cost → rank itself.

## Backend request flow
```text
Router → Controller → Service → Repository → Prisma Client → Prisma schema → MariaDB
```
| Layer | Responsibility | Must NOT |
|---|---|---|
| Router | HTTP method/path, attach middleware | contain business or DB logic |
| Controller | Parse request, call service, return response | hold business rules |
| Service | Business rules, orchestration, transactions | touch HTTP req/res objects |
| Repository | Persistence/queries via Prisma Client (per-module repository, details: `04`) | decide ranking, eligibility, cost, booking policy |
| Prisma schema | Data models, relations, mappings, and generated client types (details: `04`) | hold business logic |
| DTO | API input/output contract (Zod schema) | hold business logic |

Cross-cutting: `middleware/` (auth, request handling), `config/`, `shared/` (see `06`).

## Modules (single source of truth)
| Module | Owns |
|---|---|
| `auth` | Registration, login/logout, tokens, password reset, email verification, and multi-session management (ADR-0011) |
| `users` | User accounts and profiles |
| `providers` | Provider profile; service capability (storage/transport/both) |
| `crops` | Crop catalog |
| `storages` | Facilities and per-crop config (capacity ceiling, price, availability toggle) |
| `storage-availability` | Date-ranged capacity checks |
| `vehicles` | Provider vehicles |
| `transport-options` | Vehicle suitability checks for a request |
| `service-requests` | Farmer requirements |
| `matching` | Feasible storage/transport combinations (eligibility filtering) |
| `recommendations` | Ranking and persisted ranked deals |
| `routes` | Distance/duration via the routing-provider interface (§Routing below) |
| `costs` | Storage, transport, total cost |
| `bookings` | Booking lifecycle, capacity reserve/allocate/release |
| `payments` | Sandbox payment attempts, authenticated initiation, provider callbacks, and authoritative verification; no live money movement |
| `installments`, `refunds`, `ledger`, `commission`, `settlements`, `disputes` | Academic-grade persisted business workflows; external financial actions are simulated and isolated from checkout adapters |
| `notifications` | Persisted notifications + Socket.IO delivery |
| `reviews` | Ratings (optional module) |
| `admin` | Backend admin-console operations and bounded operational monitoring; coordinates with domain-owning modules and does not own their business rules |
| `jobs` | Scheduled/background work: booking TTL sweep, retention pruning, async notification delivery, rating recalculation (§Background Jobs below) |
| `feature-flags` | Centralized feature-flag evaluation, lifecycle, and overrides — availability logic only, never permission/role management (§Feature Flags below) |

`payments` contains separate provider adapters for bKash and SSLCommerz. Adapter HTTP/API details remain inside their adapter; payment orchestration and callbacks remain in `payments`. #19 is strictly sandbox-only: bKash Tokenized Checkout without agreement and SSLCommerz Hosted Checkout. ADR-0010 installment collection is a deterministic academic simulation, not a recurring agreement or payment-provider attempt. `service-types` is replaced by `service_requests.service_type` enum and provider-owned rows.

The backend admin console is defined by #11 and ADR-0012; there is no V1 admin UI. `admin` exposes explicitly permissioned operations and the approved read-only operational counts. It delegates provider verification, bookings, disputes, payments, academic financial workflows, authorization, feature flags, and settings to their owning modules. Audit recording uses one shared append-only boundary; its module owner is assigned before implementation. The admin module does not grant authority by role name or bypass an owning module's state machine, ownership, verification, capacity, or policy checks. Every state-changing admin action is audited; sensitive reads of payment, dispute, and ledger records are audited as well.

## Module interaction
```text
service-requests → matching ─┬→ storages / storage-availability
                             └→ vehicles / transport-options
                   → routes → costs → recommendations → bookings → notifications
```
The `payments` module is independent of booking lifecycle transitions and academic financial records. A verified sandbox attempt does not itself transition booking or ledger state. `installments` owns schedules, simulated collections, extensions, and overstay records under ADR-0010; `bookings` continues to own booking/component state and capacity allocation changes.

## Recommendation pipeline (`POST /recommendations`)
```text
1 Filter storage: crop supported, config available, facility active, capacity free for period
2 If transport needed: filter vehicles (capacity, status, service area, no overlapping block)
3 Route distance via the routing provider (farm → facility)
4 Costs (storage, transport, total)
5 Rank (order in 00) → persist service_recommendations → return
```
Own transport skips steps 2–3 and transport cost.

## Routing (provider-abstracted, not a hand-built graph)
Real road distance needs real road data (one-way streets, actual conditions), which a small hand-built graph can't give. So `routes` depends on an **interface**, not a specific vendor — swapping providers is a config change, not a rewrite. Both providers below are implemented:
```text
routes/
  routing-provider.interface.ts   getDistance(origin, dest) → { distanceKm, durationMin }
  routing-provider.factory.ts     picks provider from ROUTING_PROVIDER env var
  providers/
    osrm.provider.ts              default: self-hosted OSRM + OSM Bangladesh extract, no cost
    google-maps.provider.ts       Google Directions API — 10k free req/month (post-Mar-2025 model),
                                   needs GOOGLE_MAPS_API_KEY + a billing account with a card
```
- `matching`, `costs`, `recommendations` call `routing-provider`, never a vendor SDK directly.
- No road graph is persisted (`10` confirms no `road_nodes`/`road_edges` tables) — the provider supplies distance/duration on demand.
- Default: `ROUTING_PROVIDER=osrm` (zero billing setup). Set `ROUTING_PROVIDER=google-maps` + `GOOGLE_MAPS_API_KEY` to switch — no other code changes.
- **Distance cache:** results are cached in Redis keyed by the facility↔location coordinate pair (rounded to a sensible precision), since the same pairs repeat constantly across recommendation requests. Avoids recomputing (and, for Google Maps, re-billing) an identical lookup.
- **Rate limiting:** `POST /recommendations` is rate-limited per user/IP to prevent quota abuse against the routing provider.

## Booking pipeline (capacity-safe)
```text
Request → validate (Zod) → check Idempotency-Key (§Idempotency)
→ ONE DB transaction with row locking:
    lock the facility_crop_configs row; sum overlapping reserved|occupied + new quantity ≤ max_capacity_for_crop ?
    insert allocation(status=reserved) → create booking + child rows (price snapshots)
  (violation → 409 Conflict, nothing written)
→ notify provider(s) (queued via jobs, not inline)
Provider approve → child approved | reject → allocation cancelled/released
Both children approved → booking confirmed → active → completed
No response within TTL (default 24h, configurable) → jobs sweep expires booking + releases allocation
```
MariaDB has no exclusion constraints, so overlap checks are enforced in the service layer. Prisma does not expose `SELECT ... FOR UPDATE` as a model-query option; the owning repository must use a parameterized raw query within the same interactive transaction to lock the `facility_crop_configs` row before checking capacity.

## Authorization (ownership checks)
Permission checks alone are not sufficient. Every write to a provider-owned resource must verify in the service layer that the authenticated user is the owner or a party to that record. Authorization follows ADR-0003; ownership, lifecycle, verification, and business invariants are independently enforced. Skipping these checks is an IDOR vulnerability.

## Background jobs (`jobs` module)
Redis + BullMQ. Nothing that can fail independently (a push notification, a cleanup sweep) may block or fail the request that triggered it — it's queued, not run inline.
| Job | Trigger | Behavior |
|---|---|---|
| Booking TTL sweep | Scheduled (e.g. every few minutes) | Find `requested` bookings older than the TTL (env-configurable, default 24h) → set booking `expired`, release/cancel the associated capacity allocation |
| Recommendation pruning | Scheduled (daily) | Purge `service_recommendations` older than a configurable retention window (default 7 days) |
| Notification pruning | Scheduled (daily) | Purge `notifications` older than a configurable retention window (default 90 days) |
| Notification delivery | Enqueued on creation | Persist first, then push via Socket.IO asynchronously — delivery failure never fails the triggering request |
| Rating recalculation | Enqueued on new review | Recompute `provider_profiles.average_rating`/`total_reviews` |
| Installment/overstay sweep | Scheduled (daily) | Mark installments due/overdue, create notices, accrue active overstay, and flag deemed-return eligibility; it never auto-confirms deemed return or collects money |

`booking_status_history` has no pruning job for now — retained indefinitely; an archive strategy is deferred, not designed yet.
All retention windows and the TTL duration are read from config/env — never hardcoded in job code.

## Idempotency
`POST /bookings` (and other create-endpoints as they're added) require an `Idempotency-Key` header. On first use, the request is processed and the response stored keyed by that value. A retry with the same key returns the stored response rather than creating a duplicate — this exists because transaction row-locking prevents *overbooking*, not *duplicate submission* from a network retry. Backed by a small lookup table (`10`).

## Authorization and feature flags

Authorization follows ADR-0003, not legacy role-based rules: permissions use `resource.action`; default deny; any applicable DENY wins; roles are permission bundles, and user-level assignments are the only other source. Resolution is server-side on every request with version-invalidated caching; tokens carry identity only. The base permission applies to records where the caller is a party; `.any` grants explicit cross-party access. There is no `.own` suffix. The state machine and service layer independently enforce lifecycle, ownership, verification, and business rules. Never infer authority from a role name or `users.role`.

Admin-console operations follow #11 and ADR-0012: each operation requires its explicit permission, regardless of role name. A Platform Admin or another explicitly authorized permission manager may grant, modify, or revoke permissions. Administrative lifecycle overrides are limited to defined transitions, require a reason, and preserve state, party, verification, and capacity invariants; they are not arbitrary status edits. State-changing admin actions and sensitive financial/dispute reads are audited.

Authentication follows ADR-0011: every account operation requires a verified email and an active server-side session. Access tokens are short-lived and carry no permission claims; session revocation invalidates access immediately.

Feature flags gate feature availability and do not grant permissions. Both flag and permission must allow an operation. Use the accepted v1 catalog, scopes, precedence, audit, and failure behavior in issue #10; the prior user/provider/role precedence described in this document is superseded. Keep flag implementation distinct from permission resolution.

## Hard constraints
- Cold storage is the primary domain; transport is optional and integrated.
- Storage capacity and price are per crop.
- Ranking is deterministic, not ML.
- One routing-provider interface (`routes`), one cost implementation (`costs`), one capacity implementation (`storages`/`storage-availability`), one feature-flag evaluator and one authorization resolver. Never call a routing vendor SDK outside `routes`, never re-implement flag/role precedence outside `feature-flags`.
- No hard deletes on anything a booking can reference — every delete endpoint is a status change (`10` §Integrity rules).
- Socket.IO is separate from REST; it does not replace it.
- Do not introduce any technology not listed in `00` §Tech stack.

## Errors
Failures propagate through the request lifecycle to an HTTP response. Business failures: insufficient capacity, storage unavailable for period, no suitable vehicle, invalid booking transition, capacity conflict (`409`), disabled feature (`403`). Response format: see `05` Undecided.

## Undecided
Deployment platform; exact contents of `middleware/`, `config/`, `shared/`; dependency-injection mechanism.
