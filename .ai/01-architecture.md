# ColdLink Architecture

## Tiers
```text
React (presentation) ── REST + Socket.IO ──▶ Node/Express/TS/Drizzle ORM (application) ──▶ MariaDB (data)
                                                          │
                                                          └──▶ Redis (jobs queue, distance cache, flag cache)
```
- **All business decisions live in the backend**: eligibility, matching, routing, cost, ranking, booking, capacity. The frontend never decides or orchestrates them.
- Frontend calls one high-level `POST /api/v1/recommendations`; it does not chain matching → route → cost → rank itself.

## Backend request flow
```text
Router → Controller → Service → Repository → Schema (Drizzle) → MariaDB
```
| Layer | Responsibility | Must NOT |
|---|---|---|
| Router | HTTP method/path, attach middleware | contain business or DB logic |
| Controller | Parse request, call service, return response | hold business rules |
| Service | Business rules, orchestration, transactions | touch HTTP req/res objects |
| Repository | Persistence/queries via Drizzle (base repo + per-module repo, details: `04`) | decide ranking, eligibility, cost, booking policy |
| Schema | Drizzle table definitions + inferred TS types (no entity classes, no decorators, details: `04`) | hold any logic |
| DTO | API input/output contract (Zod schema) | hold business logic |

Cross-cutting: `middleware/` (auth, request handling), `config/`, `shared/` (see `06`).

## Modules (single source of truth)
| Module | Owns |
|---|---|
| `auth` | Registration, login/logout, tokens, password reset, email verification |
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
| `payments` | Payment attempts, authenticated initiation, provider callback/return/IPN handling, and authoritative payment verification; no booking-state transitions, ledger, wallet, refund, installment, payout, or settlement ownership |
| `notifications` | Persisted notifications + Socket.IO delivery |
| `reviews` | Ratings (optional module) |
| `admin` | Admin management and monitoring |
| `jobs` | Scheduled/background work: booking TTL sweep, retention pruning, async notification delivery, rating recalculation (§Background Jobs below) |
| `feature-flags` | Centralized flag evaluation, precedence, and custom-role management — the only place this logic lives (§Feature Flags, §Roles below) |

`payments` contains separate provider adapters for bKash and SSLCommerz. Adapter HTTP/API details remain inside their adapter; payment orchestration and callbacks remain in `payments`. #19 is sandbox-only: bKash Tokenized Checkout without agreement and SSLCommerz Hosted Checkout. No production provider is selected or approved. `service-types` is replaced by `service_requests.service_type` enum and provider-owned rows.

## Module interaction
```text
service-requests → matching ─┬→ storages / storage-availability
                             └→ vehicles / transport-options
                   → routes → costs → recommendations → bookings → notifications
```
The `payments` module is independent of booking lifecycle transitions, ledger, wallet, and marketplace behavior. A verified sandbox payment attempt does not transition a booking.

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
    sum overlapping reserved|occupied + new quantity ≤ max_capacity_for_crop ?
    insert allocation(status=reserved) → create booking + child rows (price snapshots)
  (violation → 409 Conflict, nothing written)
→ notify provider(s) (queued via jobs, not inline)
Provider approve → child approved | reject → allocation cancelled/released
Both children approved → booking confirmed → active → completed
No response within TTL (default 24h, configurable) → jobs sweep expires booking + releases allocation
```
MariaDB has no exclusion constraints, so overlap checks are enforced in the service layer.

## Authorization (ownership checks)
Role checks alone (`role = provider`) are not sufficient. Every write to a resource a provider owns — a facility, a vehicle, a booking's storage/transport child — must verify in the **service layer** that the authenticated user is the actual owner of that specific resource, not merely that their role permits the action in general. Skipping this is an IDOR vulnerability. This check lives alongside the business logic in each module's service, not in shared middleware alone (middleware handles authentication/role; ownership is resource-specific).

## Background jobs (`jobs` module)
Redis + BullMQ. Nothing that can fail independently (a push notification, a cleanup sweep) may block or fail the request that triggered it — it's queued, not run inline.
| Job | Trigger | Behavior |
|---|---|---|
| Booking TTL sweep | Scheduled (e.g. every few minutes) | Find `requested` bookings older than the TTL (env-configurable, default 24h) → set booking `expired`, release/cancel the associated capacity allocation |
| Recommendation pruning | Scheduled (daily) | Purge `service_recommendations` older than a configurable retention window (default 7 days) |
| Notification pruning | Scheduled (daily) | Purge `notifications` older than a configurable retention window (default 90 days) |
| Notification delivery | Enqueued on creation | Persist first, then push via Socket.IO asynchronously — delivery failure never fails the triggering request |
| Rating recalculation | Enqueued on new review | Recompute `provider_profiles.average_rating`/`total_reviews` |

`booking_status_history` has no pruning job for now — retained indefinitely; an archive strategy is deferred, not designed yet.
All retention windows and the TTL duration are read from config/env — never hardcoded in job code.

## Idempotency
`POST /bookings` (and other create-endpoints as they're added) require an `Idempotency-Key` header. On first use, the request is processed and the response stored keyed by that value. A retry with the same key returns the stored response rather than creating a duplicate — this exists because transaction row-locking prevents *overbooking*, not *duplicate submission* from a network retry. Backed by a small lookup table (`10`).

## Feature flags (`feature-flags` module)
Flat, named flags (e.g. `reviews.enabled`, `booking.create`) can gate a whole module or a specific action. Backed by `feature_flags` (global default) + `feature_flag_overrides` (per-role, per-provider, or per-user), cached in Redis.
- **Precedence, most specific wins:** `user override > provider override > role override > global default`. A user, provider, or role override can turn a feature back **on** even if the global default is off.
- **Role overrides only ever grant.** A role override row is always `enabled=true`. Because a user can hold multiple roles (§Roles below) and grants are additive, a role-level "deny" would be ambiguous the moment a second role grants the same flag — so denying one specific user something their role(s) would otherwise grant is done with a **user-level** override (`enabled=false`), which sits above role in precedence.
- **Enforcement is server-side**, in the service layer (or shared middleware calling the `feature-flags` service) — return `403` for a disabled action. The frontend may additionally hide/disable UI for UX, but that is never the enforcement point. Disabling a flag is never a structural change (routes stay registered) — it's purely an access check.
- **Centralized only**: all modules call the `feature-flags` service to evaluate a flag; no module implements its own precedence logic.

**Evaluation algorithm** (exact order, stop at the first match):
```text
resolve(flagKey, user):
  1. a feature_flag_overrides row exists for scope=user,  scope_id=user.id      → use its `enabled` value, STOP
  2. user.role == 'provider' AND
     a feature_flag_overrides row exists for scope=provider, scope_id=user.id  → use its `enabled` value, STOP
  3. ANY of the user's assigned roles (from user_roles, §Roles) has a
     feature_flag_overrides row for scope=role, scope_id=<that role_key>,
     with enabled=true                                                        → true, STOP
  4. otherwise                                                                → feature_flags.global_enabled
```

## Roles (system-protected + admin-managed custom roles)
Two kinds of role, kept structurally separate:
- **System roles** — `farmer`, `provider`, `admin`. These drive real domain behavior (a farmer has `farmer_profiles` and can create `service_requests`; a provider has `provider_profiles` and can own facilities/vehicles). `users.role` (a fixed `ENUM(farmer,provider,admin)`, unchanged from before) is the single source of truth for this — it is **not** replaced or removed by anything below.
- **Custom roles** — anything admin creates (`support`, `moderator`, `logistics_staff`, ...). These carry **no** domain behavior. Their only purpose is to be a named bundle of feature-flag grants (via `feature_flag_overrides` with `scope=role`).

**Multi-role assignment.** Every user is automatically assigned their structural role as a `user_roles` row the moment their account is created (a farmer gets a `user_roles` row for `role_key='farmer'`, etc.) — this happens in the `auth`/`users` module at registration, not manually. Admin can then assign additional custom roles to any user via `user_roles`. A user's role set is therefore always their one structural role **plus** zero or more custom roles.

**Protection rules (enforced in the `feature-flags` service, not just a DB flag):**
- A role with `roles.is_system = 1` (`farmer`, `provider`, `admin`) can never be edited, deactivated, or deleted via the admin API — reject with `403`.
- A `user_roles` row that matches the user's structural `users.role` can never be unassigned independently via the admin API — it is system-managed, not admin-editable one at a time.
- Admin can freely create, edit, and soft-delete (`status → inactive`, never a hard delete) any custom (`is_system = 0`) role, and freely assign/unassign custom roles to/from any user.

## Hard constraints
- Cold storage is the primary domain; transport is optional and integrated.
- Storage capacity and price are per crop.
- Ranking is deterministic, not ML.
- One routing-provider interface (`routes`), one cost implementation (`costs`), one capacity implementation (`storages`/`storage-availability`), one flag+role-evaluation implementation (`feature-flags`). Never call a routing vendor SDK outside `routes`, never re-implement flag/role precedence outside `feature-flags`.
- No hard deletes on anything a booking can reference — every delete endpoint is a status change (`10` §Integrity rules).
- Socket.IO is separate from REST; it does not replace it.
- Do not introduce any technology not listed in `00` §Tech stack.

## Errors
Failures propagate through the request lifecycle to an HTTP response. Business failures: insufficient capacity, storage unavailable for period, no suitable vehicle, invalid booking transition, capacity conflict (`409`), disabled feature (`403`). Response format: see `05` Undecided.

## Undecided
Deployment platform; exact contents of `middleware/`, `config/`, `shared/`; dependency-injection mechanism.
