# ColdLink — Project Overview

Web marketplace where farmers find, compare, rank and book **cold storage** and **agricultural transport**. It solves an information/coordination gap, not a physical storage shortage. Bangladesh-focused, built as a portfolio/CV project with a real path to becoming a startup — architecture favors extendability over shortcuts.

**Doc map:** 00 product rules · 01 architecture + modules · 02 folders · 03 code · 04 Drizzle ORM · 05 API · 06 module rules · 07 git · 08 AI rules · 09 progress · 10 DB schema (source of truth for data) · 11 project schedule (WBS, PERT/CPM, Gantt, GitHub issue conventions).
**Undecided items** are listed at the end of each doc. Never invent them: follow existing code, else ask.

## Actors
| Actor | Capabilities |
|---|---|
| Farmer | Register/login; create service request (crop, quantity, storage period, farm location, transport needed or own); view ranked deals; book; track status; real-time notifications; history; cancel where allowed |
| Provider | **One account** offers storage, transport, or both (= owns facilities and/or vehicles; no role split). Storage: manage facilities, per-crop capacity/price/availability, approve/reject bookings. Transport: manage vehicles, service areas, transport bookings |
| Admin | Manage users/providers; monitor facilities, vehicles, bookings, capacity; dashboard stats |

## Core flow
```text
Service request → Eligibility → Storage+Transport matching → Route (routing provider)
→ Cost → Rank → Ranked deals (persisted) → Booking → Provider approval
→ Capacity allocation → Notifications (REST + Socket.IO)
```

## Business rules
**Booking scope (read this first — it governs everything below)**
- A farmer's service request — and the booking made from it — is **one of exactly three shapes**: `storage_only`, `transportation_only`, or `both`. This is controlled by one field, `service_requests.service_type`.
- These are **not three separate features or three separate code paths**. There is one `service-requests` module, one `matching` pipeline, one `recommendations` pipeline, one `bookings` pipeline. The `service_type` value changes what each pipeline *does* (e.g. skip vehicle matching for `storage_only`), never *which system runs*.
- Concretely: if `service_type = storage_only`, `needs_transportation` is `false` and no `transportation_bookings` row is ever created for that booking. If `service_type = transportation_only`, no `storage_bookings` row is created. If `service_type = both`, both child rows are created and can be approved/rejected independently by two different providers (`10` §Booking model).

**Accounts**
- One account = one role (`farmer | provider | admin`). A provider is one entity regardless of services offered.
- Transport is independent of storage; independent transport providers are supported.

**Storage**
- Crop support, capacity and price are per facility+crop (`facility_crop_configs`).
- Capacity is date-ranged and derived from allocation rows (formula and lifecycle: `10` §Capacity).
- Rejected/cancelled bookings release capacity. Overbooking is never allowed; conflict → `409`.

**Transport**
- Vehicle is eligible only if capacity ≥ quantity, status `available`, no overlapping block, provider serves the area.
- Own transport → `transport_cost = 0` and transport is excluded from ranking.

**Cost** (storage and transport always shown separately, plus total)
```text
storage_cost   = price_per_unit_per_day × quantity × storage_days
transport_cost = base_charge + (route_distance_km × cost_per_km)
total_cost     = storage_cost + transport_cost
```

**Matching / ranking** (deterministic, not AI/ML)
- Exclude: unsupported crop, `is_available=false`, inactive facility, insufficient capacity for the period, unsuitable/unavailable vehicle.
- Rank by: 1) lowest total cost → 2) shorter distance → 3) higher provider rating → 4) greater available capacity.
- Each deal shows: storage cost, transport cost, total, distance, available capacity, rating.
- Ranked results are persisted in `service_recommendations` (with `expires_at`); a booking references the exact row.

**Routes**
- Distance/duration come from a **routing provider** (real road data), never a hand-built graph — no algorithm is hand-rolled or "official"; the app depends on an interface, not a specific vendor (details: `01` §Routing).
- Leaflet/Google Maps are for visualization; the routing provider (which may be OSRM, Google, etc.) supplies the numbers used in cost/ranking.

**Bookings**
- `bookings.overall_status`: `requested → approved | rejected`; `approved → confirmed → active → completed`; `cancelled` where applicable; `expired` if a `requested` booking is not approved/rejected within its TTL (default **24h**, configurable — see `01` §Background Jobs).
- A booking has optional storage and transport children, each with its own status/provider. Parent reaches `confirmed` only when all applicable children are `approved`.
- Prices are snapshotted at booking time and never recalculated.
- `POST /bookings` requires an `Idempotency-Key` header; a retried request with the same key returns the original result instead of creating a duplicate (`01` §Idempotency, `05`).

**Deletion policy**
- No hard deletes on anything a booking can reference (users, providers, facilities, vehicles, crops). Every "delete" endpoint flips a status field to `inactive`/`suspended`/etc. instead of removing the row (`06`, `10` §Integrity rules).

**Authorization**
- Role checks alone are not sufficient. Every write to a provider-owned resource (facility, vehicle, its bookings) must verify in the service layer that the acting user actually owns that resource, not just that their role is `provider`.

**Roles & permissions**
- Three **protected system roles** drive real domain behavior and can never be renamed, redefined, or deleted: `farmer`, `provider`, `admin`. A user has exactly one of these as `users.role` — this is unchanged and structural (it decides which profile table applies).
- Admin can additionally create **custom, permission-only roles** (e.g. `support`, `moderator`, `logistics_staff`). These carry no domain behavior of their own — they only exist to grant feature access.
- A user can hold **multiple roles at once** (their one structural role, plus any number of custom roles). Custom-role grants are **additive**: if any assigned role grants a feature, the user has it — unless a user-level override says otherwise.

**Feature flags**
- Every feature is gated by a flat named flag (e.g. `reviews.enabled`, `booking.create`). Precedence, most specific wins: **user override > provider override > role override > global default**. A role override can only *grant* (never deny) — denying one specific user access to something a role would otherwise grant is done with a user-level override.
- Enforced server-side (`403` when disabled); frontend may additionally hide UI for UX. Disabling a feature never structurally unregisters its routes — it's an access check, not a deploy-time toggle. One centralized `feature-flags` service owns all evaluation and precedence — no module re-implements it (`01` §Feature Flags & §Roles, `06`).

**Real-time:** Socket.IO complements REST (never replaces it). Notifications are persisted, then pushed. Event types: new booking, approved, rejected, confirmed, status changed, notification.

## Tech stack
| Area | Decision |
|---|---|
| Frontend | React, TypeScript, Axios, Tailwind CSS, Socket.IO client |
| Backend | Node.js, Express, TypeScript, **Drizzle ORM** (latest) + `mysql2` driver, Socket.IO |
| Database | **MariaDB** (InnoDB, utf8mb4) |
| Cache / jobs infra | **Redis** — backs the job queue (BullMQ), the routing distance cache, and feature-flag caching |
| Background jobs | **BullMQ** (Redis-backed) — TTL sweep, notification delivery, rating recalculation, retention pruning (`01` §Background Jobs) |
| Logging | **pino** — structured JSON logging |
| Error tracking | **Sentry** |
| Validation | **Zod** — request validation; also the source for generated OpenAPI docs |
| Idempotency | `Idempotency-Key` header on create-endpoints (`bookings`, others as added), backed by a lookup table (`10`) |
| Routing | Provider-abstracted (interface in `routes`; default provider self-hosted OSRM on an OSM Bangladesh extract — no cost, no billing account needed; Google Maps Directions API pluggable via the same interface — **10,000 free requests/month** since Google retired the old $200/month credit in March 2025, ~$5/1k after that; needs a Google Cloud billing account + card even within the free tier. See `01` §Routing). Distance results are cached in Redis per facility↔location pair. |
| Maps (display) | Leaflet+OSM and/or Google Maps Platform (see Undecided) |

## Out of scope (v1) — but designed not to block later
Not built now, but the architecture must not make these hard to add:

| Deferred | Why deferred now | What keeps it easy later |
|---|---|---|
| Payments (bKash/Nagad, not Stripe — cards aren't the norm for BD farmers/providers) | No payment gateway selected | `bookings.total_cost` and the booking state machine are payment-agnostic; a `payments` table can attach to `bookings` without touching booking logic |
| SMS notifications | Not in v1 scope | `notifications` module is channel-agnostic; Socket.IO is one delivery channel among others, add an SMS channel without redesign |
| Multi-currency | Planned for later, not v1 | Don't hardcode currency formatting; a `currency` column can be added to price fields without restructuring them |
| Multi-language (Bangla + others) | Planned for later, not v1 | Don't hardcode English-only strings for user-facing catalog data (e.g. crop names) |
| Live traffic, GPS tracking, weather prediction, AI/ML recommendation, dynamic pricing, blockchain, full accounting | Out of scope entirely | Not designed for; add only on explicit decision |

## Timeline (12 weeks)
| Weeks | Work |
|---|---|
| 1–2 | Requirements, architecture, DB design |
| 3–4 | UI/UX, frontend, auth, roles |
| 5–6 | Storage, crop, capacity, vehicle management |
| 7–8 | Matching, cost, routing integration, recommendations |
| 9 | Booking, approval, capacity updates |
| 10–11 | Integration, testing, docs, demo |
| 12 | Buffer: bugs, extra testing, polish |

## Undecided
| Item | Rule until decided |
|---|---|
| Map provider for on-screen display (Leaflet+OSM vs Google Maps vs both) | Visualization only; separate decision from the routing provider; do not hard-wire one into backend logic |
| Reviews in v1 | Optional; ranking tie-break needs `provider_profiles.average_rating` |
| Admin scope in v1 | Not finalized; build only what the current task asks |
| Deployment platform | Not chosen |
| Frontend folder structure | Not finalized |
