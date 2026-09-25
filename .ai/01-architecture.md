# ColdLink Architecture

## Tiers
```text
React (presentation) ── REST + Socket.IO ──▶ Node/Express/TS/MikroORM (application) ──▶ MariaDB (data)
```
- **All business decisions live in the backend**: eligibility, matching, routing, cost, ranking, booking, capacity. The frontend never decides or orchestrates them.
- Frontend calls one high-level `POST /api/v1/recommendations`; it does not chain matching → route → cost → rank itself.

## Backend request flow
```text
Router → Controller → Service → Repository → Entity → MariaDB
```
| Layer | Responsibility | Must NOT |
|---|---|---|
| Router | HTTP method/path, attach middleware | contain business or DB logic |
| Controller | Parse request, call service, return response | hold business rules |
| Service | Business rules, orchestration, transactions | touch HTTP req/res objects |
| Repository | Persistence/queries (base repo + per-entity repo) | decide ranking, eligibility, cost, booking policy |
| Entity | Persistent data (base entity + per-entity class) | hold unrelated workflows |
| DTO | API input/output contract | hold business logic |

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
| `routes` | Dijkstra shortest route |
| `road-network` | Road graph used by `routes` (source: see `00` Undecided) |
| `costs` | Storage, transport, total cost |
| `bookings` | Booking lifecycle, capacity reserve/allocate/release |
| `notifications` | Persisted notifications + Socket.IO delivery |
| `reviews` | Ratings (optional module) |
| `admin` | Admin management and monitoring |

Not modules: `payments` (out of scope), `service-types` (replaced by `service_requests.service_type` enum and provider-owned rows).

## Module interaction
```text
service-requests → matching ─┬→ storages / storage-availability
                             └→ vehicles / transport-options
                  → routes → costs → recommendations → bookings → notifications
```

## Recommendation pipeline (`POST /recommendations`)
```text
1 Filter storage: crop supported, config available, facility active, capacity free for period
2 If transport needed: filter vehicles (capacity, status, service area, no overlapping block)
3 Route distance via Dijkstra (farm → facility)
4 Costs (storage, transport, total)
5 Rank (order in 00) → persist service_recommendations → return
```
Own transport skips steps 2–3 and transport cost.

## Booking pipeline (capacity-safe)
```text
Request → validate
→ ONE DB transaction with row locking:
    sum overlapping reserved|occupied + new quantity ≤ max_capacity_for_crop ?
    insert allocation(status=reserved) → create booking + child rows (price snapshots)
  (violation → 409 Conflict, nothing written)
→ notify provider(s)
Provider approve → child approved | reject → allocation cancelled/released
Both children approved → booking confirmed → active → completed
```
MariaDB has no exclusion constraints, so overlap checks are enforced in the service layer.

## Hard constraints
- Cold storage is the primary domain; transport is optional and integrated.
- Storage capacity and price are per crop.
- Ranking is deterministic, not ML.
- One Dijkstra implementation (`routes`), one cost implementation (`costs`), one capacity implementation (`storages`/`storage-availability`).
- Socket.IO is separate from REST; it does not replace it.
- Do not introduce any technology not listed in `00` §Tech stack.

## Errors
Failures propagate through the request lifecycle to an HTTP response. Business failures: insufficient capacity, storage unavailable for period, no suitable vehicle, invalid booking transition, capacity conflict (`409`). Response format: see `05` Undecided.

## Undecided
Deployment platform; exact contents of `middleware/`, `config/`, `shared/`; dependency-injection mechanism.
