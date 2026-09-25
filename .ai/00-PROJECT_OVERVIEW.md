# ColdLink — Project Overview

Web marketplace where farmers find, compare, rank and book **cold storage** and **agricultural transport**. It solves an information/coordination gap, not a physical storage shortage. Bangladesh-focused, 3-1 undergraduate scope.

**Doc map:** 00 product rules · 01 architecture + modules · 02 folders · 03 code · 04 MikroORM · 05 API · 06 module rules · 07 git · 08 AI rules · 09 progress · 10 DB schema (source of truth for data).
**Undecided items** are listed at the end of each doc. Never invent them: follow existing code, else ask.

## Actors
| Actor | Capabilities |
|---|---|
| Farmer | Register/login; create service request (crop, quantity, storage period, farm location, transport needed or own); view ranked deals; book; track status; real-time notifications; history; cancel where allowed |
| Provider | **One account** offers storage, transport, or both (= owns facilities and/or vehicles; no role split). Storage: manage facilities, per-crop capacity/price/availability, approve/reject bookings. Transport: manage vehicles, service areas, transport bookings |
| Admin | Manage users/providers; monitor facilities, vehicles, bookings, capacity; dashboard stats |

## Core flow
```text
Service request → Eligibility → Storage+Transport matching → Route (Dijkstra)
→ Cost → Rank → Ranked deals (persisted) → Booking → Provider approval
→ Capacity allocation → Notifications (REST + Socket.IO)
```

## Business rules
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
- Dijkstra is the official algorithm; graph edge weight = road distance.
- Leaflet/Google Maps are for visualization only and never replace Dijkstra.

**Bookings**
- `bookings.overall_status`: `requested → approved | rejected`; `approved → confirmed → active → completed`; `cancelled` where applicable.
- A booking has optional storage and transport children, each with its own status/provider. Parent reaches `confirmed` only when all applicable children are `approved`.
- Prices are snapshotted at booking time and never recalculated.

**Real-time:** Socket.IO complements REST (never replaces it). Notifications are persisted, then pushed. Event types: new booking, approved, rejected, confirmed, status changed, notification.

## Tech stack
| Area | Decision |
|---|---|
| Frontend | React, TypeScript, Axios, Tailwind CSS, Socket.IO client |
| Backend | Node.js, Express, TypeScript, MikroORM (latest), Socket.IO |
| Database | **MariaDB** (InnoDB, utf8mb4) |
| Routing | Dijkstra |
| Maps | Leaflet+OSM and/or Google Maps Platform (see Undecided) |

## Out of scope
Payment gateways (no payments module), live traffic, GPS tracking, weather prediction, AI chatbot/ML recommendation, dynamic pricing, blockchain, full accounting.

## Timeline (12 weeks)
| Weeks | Work |
|---|---|
| 1–2 | Requirements, architecture, DB design |
| 3–4 | UI/UX, frontend, auth, roles |
| 5–6 | Storage, crop, capacity, vehicle management |
| 7–8 | Matching, cost, Dijkstra, recommendations |
| 9 | Booking, approval, capacity updates |
| 10–11 | Integration, testing, docs, demo |
| 12 | Buffer: bugs, extra testing, polish |

## Undecided
| Item | Rule until decided |
|---|---|
| Road graph source | Schema `10` has **no road tables**; graph is built at request time from OSM/Google data. Do not add `road_nodes`/`road_edges` without approval |
| Map provider (Leaflet+OSM vs Google Maps vs both) | Visualization only; do not hard-wire one into backend logic |
| Reviews in v1 | Optional; ranking tie-break needs `provider_profiles.average_rating` |
| Admin scope in v1 | Not finalized; build only what the current task asks |
| Deployment platform | Not chosen |
| Frontend folder structure | Not finalized |
