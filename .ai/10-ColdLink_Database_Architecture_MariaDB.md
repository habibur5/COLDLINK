# ColdLink Database Architecture (MariaDB)

Designed from the product rules in `00`–`09`. Engine: MariaDB, InnoDB, `utf8mb4`. UUID PKs = `CHAR(36)`. Flags = `TINYINT(1)`. Timestamps = `DATETIME`. `created_at` defaults `CURRENT_TIMESTAMP`; `updated_at` defaults `CURRENT_TIMESTAMP` **and** is `ON UPDATE CURRENT_TIMESTAMP` — DB-managed everywhere it appears, never set by application code.

## Design decisions and why
| Decision | Reason |
|---|---|
| One `users` table + one profile table per role | A user is exactly one of farmer/provider/admin (`00`) |
| One `provider_profiles`, storage and vehicles both FK to it | Provider offers storage, transport, or both from a single account — no role split (`00`) |
| Capacity and price live on a facility↔crop table, not on the facility | Storage support, capacity and price are per crop (`00`) |
| Capacity = dated allocation rows, not a counter | Availability is date-ranged; a single number can't answer "free Jun 15–20 but not Jun 1–10" |
| One `service_requests` table with a `service_type` enum | Storage-only / transport-only / both must not be three separate systems (`00`) |
| Ranked results persisted (`recommendations`) | What's booked must match exactly what was shown, and re-ranking on every click is wasteful |
| `bookings` parent + optional `storage_bookings`/`transportation_bookings` children | A combined booking can span two different providers who approve independently (`01`) |
| Price snapshot columns on booking children | A later price change must not affect an existing booking (`00`) |
| No road-graph tables | Distance/duration come from a routing provider (default OSRM, pluggable) at request time — no hand-built graph, see `01` §Routing |
| No `payments`, no `service-types` table | Payments are out of scope; service type is an enum on the request, not master data (`01`) |
| No hard deletes on anything a booking can reference | Every entity that can be referenced by a booking uses an existing/added status field instead of row deletion (`01`, `06`) |
| `feature_flags` + `feature_flag_overrides`, not a third-party flag service | Self-built per-feature on/off, cached in Redis, with user > provider > global precedence (`01` §Feature Flags) |
| `idempotency_keys` table | `POST /bookings` and similar creates must survive a network retry without duplicating the write (`01` §Idempotency) |
| `updated_at` is DB-managed (`ON UPDATE CURRENT_TIMESTAMP`) everywhere it appears | Removes reliance on application code remembering to set it |
| `roles` + `user_roles`, multi-role, additive | `farmer`/`provider`/`admin` stay hardcoded & protected; admin can layer permission-only custom roles on any user without touching domain behavior (`01` §Roles) |

## Tables

```text
users
  id CHAR(36) PK · full_name VARCHAR(150) · email VARCHAR(150) UNIQUE · phone VARCHAR(20) UNIQUE
  password_hash VARCHAR(255) · role ENUM(farmer,provider,admin)
  status ENUM(active,suspended,deactivated) default active
  created_at · updated_at · last_login_at DATETIME NULL

farmer_profiles                                  -- 1:1 with users
  user_id CHAR(36) PK FK→users.id
  default_farm_address VARCHAR(255) NULL · default_latitude DECIMAL(9,6) NULL
  default_longitude DECIMAL(9,6) NULL · created_at

provider_profiles                                -- 1:1 with users
  user_id CHAR(36) PK FK→users.id · business_name VARCHAR(150)
  business_address VARCHAR(255) NULL · contact_person VARCHAR(150) NULL
  provider_status ENUM(pending_verification,verified,suspended)
  average_rating DECIMAL(3,2) NULL         -- cached, recomputed on new review
  total_reviews INT default 0              -- cached
  created_at · updated_at

crops
  id CHAR(36) PK · name VARCHAR(100) UNIQUE · category VARCHAR(100) NULL
  status ENUM(active,inactive) · created_at

farm_locations                                   -- reusable, so requests don't re-enter coords
  id CHAR(36) PK · farmer_id FK→farmer_profiles.user_id
  label VARCHAR(100) NULL · address VARCHAR(255)
  latitude DECIMAL(9,6) · longitude DECIMAL(9,6) · created_at

storage_facilities
  id CHAR(36) PK · provider_id FK→provider_profiles.user_id
  name VARCHAR(150) · address VARCHAR(255)
  latitude DECIMAL(9,6) · longitude DECIMAL(9,6)
  status ENUM(active,inactive,maintenance) · created_at · updated_at

facility_crop_configs                            -- resolves facility ↔ crop, carries capacity+price
  id CHAR(36) PK · facility_id FK→storage_facilities.id · crop_id FK→crops.id
  max_capacity_for_crop DECIMAL(10,2) · price_per_unit_per_day DECIMAL(10,2)
  is_available TINYINT(1)                  -- provider on/off toggle, separate from dated availability
  created_at · updated_at · UNIQUE(facility_id, crop_id)

storage_capacity_allocations                     -- the actual dated consumption
  id CHAR(36) PK · facility_crop_config_id FK→facility_crop_configs.id
  storage_booking_id FK→storage_bookings.id UNIQUE   -- 1:1, set once booked
  quantity DECIMAL(10,2) · start_date DATE · end_date DATE
  status ENUM(reserved,occupied,released,cancelled) · created_at · updated_at

vehicles
  id CHAR(36) PK · provider_id FK→provider_profiles.user_id
  vehicle_type ENUM(open_truck,covered_van,refrigerated_truck,pickup,other)
  registration_number VARCHAR(50) UNIQUE · capacity DECIMAL(10,2)
  base_charge DECIMAL(10,2) · cost_per_km DECIMAL(10,2)
  status ENUM(available,unavailable,maintenance) · created_at · updated_at

provider_service_areas                           -- filters candidate vehicles by coverage
  id CHAR(36) PK · provider_id FK→provider_profiles.user_id
  region_name VARCHAR(150) · center_latitude DECIMAL(9,6) · center_longitude DECIMAL(9,6)
  radius_km DECIMAL(6,2) · created_at

vehicle_availability_blocks                      -- the actual dated vehicle commitment
  id CHAR(36) PK · vehicle_id FK→vehicles.id
  transportation_booking_id FK→transportation_bookings.id UNIQUE NULL  -- null = manual block
  start_datetime DATETIME · end_datetime DATETIME
  status ENUM(reserved,active,completed,cancelled,maintenance) · created_at · updated_at

service_requests                                 -- single entry point, all 3 service types
  id CHAR(36) PK · farmer_id FK→farmer_profiles.user_id · crop_id FK→crops.id
  quantity DECIMAL(10,2) · farm_location_id FK→farm_locations.id
  service_type ENUM(storage_only,transportation_only,both)
  storage_start_date DATE NULL · storage_end_date DATE NULL
  needs_transportation TINYINT(1)          -- app-derived from service_type, see §Booking scope; not independently settable
  destination_address VARCHAR(255) NULL · destination_latitude DECIMAL(9,6) NULL
  destination_longitude DECIMAL(9,6) NULL
  status ENUM(open,matched,booked,cancelled,expired) · created_at · updated_at

recommendations                                  -- persisted ranked deals
  id CHAR(36) PK · service_request_id FK→service_requests.id
  facility_id FK→storage_facilities.id NULL · vehicle_id FK→vehicles.id NULL
  storage_cost DECIMAL(10,2) NULL · transport_cost DECIMAL(10,2) NULL
  total_cost DECIMAL(10,2) · distance_km DECIMAL(7,2) NULL
  provider_rating_snapshot DECIMAL(3,2) NULL · rank_position INT
  generated_at DATETIME · expires_at DATETIME
  status ENUM(active,expired,booked)

bookings                                         -- parent commitment
  id CHAR(36) PK · service_request_id FK→service_requests.id
  farmer_id FK→farmer_profiles.user_id            -- denormalized for direct querying
  recommendation_id FK→recommendations.id NULL
  booking_type ENUM(storage_only,transportation_only,both)
  overall_status ENUM(requested,approved,rejected,confirmed,active,completed,cancelled,expired)
  total_cost DECIMAL(10,2)                        -- snapshot sum of children
  created_at · updated_at · cancelled_at DATETIME NULL · cancellation_reason VARCHAR(255) NULL

storage_bookings                                 -- present iff booking_type ∈ {storage_only, both}
  id CHAR(36) PK · booking_id FK→bookings.id UNIQUE
  facility_crop_config_id FK→facility_crop_configs.id
  quantity DECIMAL(10,2) · start_date DATE · end_date DATE
  price_per_unit_snapshot DECIMAL(10,2) · total_storage_cost DECIMAL(10,2)
  status ENUM(pending,approved,rejected,active,completed,cancelled) · created_at · updated_at

transportation_bookings                          -- present iff booking_type ∈ {transportation_only, both}
  id CHAR(36) PK · booking_id FK→bookings.id UNIQUE · vehicle_id FK→vehicles.id
  pickup_address VARCHAR(255) · pickup_latitude DECIMAL(9,6) · pickup_longitude DECIMAL(9,6)
  dropoff_address VARCHAR(255) · dropoff_latitude DECIMAL(9,6) · dropoff_longitude DECIMAL(9,6)
  distance_km DECIMAL(7,2) · scheduled_datetime DATETIME
  base_charge_snapshot DECIMAL(10,2) · cost_per_km_snapshot DECIMAL(10,2)
  total_transport_cost DECIMAL(10,2)
  status ENUM(pending,approved,rejected,active,completed,cancelled) · created_at · updated_at

booking_status_history                           -- audit trail, polymorphic target
  id CHAR(36) PK · entity_type ENUM(booking,storage_booking,transportation_booking)
  entity_id CHAR(36)                              -- not a DB FK: target table varies by entity_type
  previous_status VARCHAR(30) NULL · new_status VARCHAR(30)
  changed_by FK→users.id NULL                     -- null = system-triggered
  reason VARCHAR(255) NULL · changed_at DATETIME

notifications
  id CHAR(36) PK · recipient_user_id FK→users.id
  notification_type VARCHAR(50) · title VARCHAR(150) · message TEXT
  related_entity_type VARCHAR(50) NULL · related_entity_id CHAR(36) NULL
  is_read TINYINT(1) default 0 · created_at · read_at DATETIME NULL

reviews                                          -- one per booking side, so a combined booking
  id CHAR(36) PK · farmer_id FK→farmer_profiles.user_id       -- gets two independent reviews
  provider_id FK→provider_profiles.user_id
  storage_booking_id FK→storage_bookings.id UNIQUE NULL
  transportation_booking_id FK→transportation_bookings.id UNIQUE NULL
  rating TINYINT CHECK(rating BETWEEN 1 AND 5) · review_text TEXT NULL · created_at
  CHECK: exactly one of storage_booking_id / transportation_booking_id is set

admin_action_logs
  id CHAR(36) PK · admin_user_id FK→users.id · action_type VARCHAR(50)
  target_entity_type VARCHAR(50) · target_entity_id CHAR(36)
  description VARCHAR(255) NULL · created_at

feature_flags                                    -- global default per named flag
  id CHAR(36) PK · flag_key VARCHAR(100) UNIQUE       -- e.g. 'reviews.enabled', 'booking.create'
  description VARCHAR(255) NULL · global_enabled TINYINT(1) default 0
  created_at · updated_at

feature_flag_overrides                           -- per-role, per-provider, or per-user override
  id CHAR(36) PK · flag_key FK→feature_flags.flag_key
  scope ENUM(role,provider,user) · scope_id VARCHAR(100)  -- role_key (scope=role), provider_profiles.user_id, or users.id
  enabled TINYINT(1)                                       -- role-scope rows: only ever TINYINT(1)=1, see `01` §Feature Flags
  created_at · updated_at · UNIQUE(flag_key, scope, scope_id)

idempotency_keys                                 -- survive a retried create request
  idempotency_key VARCHAR(100) PK                     -- client-supplied, from the Idempotency-Key header
  endpoint VARCHAR(100)                               -- which route this key was used against
  request_hash VARCHAR(64)                            -- detects a reused key with a different body
  response_status INT · response_body JSON
  created_at · expires_at DATETIME                    -- retention configurable, not hardcoded

roles                                            -- both system-protected and admin-created custom roles
  role_key VARCHAR(50) PK                             -- 'farmer', 'provider', 'admin', 'support', ...
  name VARCHAR(100) · description VARCHAR(255) NULL
  is_system TINYINT(1) default 0                      -- true ONLY for farmer/provider/admin; immutable once set
  status ENUM(active,inactive) default active         -- custom-role soft-delete; system roles never leave 'active'
  created_at · updated_at

user_roles                                       -- additive, many-to-many; a user's permission set
  user_id CHAR(36) FK→users.id · role_key VARCHAR(50) FK→roles.role_key
  assigned_at DATETIME · PRIMARY KEY(user_id, role_key)
  -- the row matching a user's structural users.role is auto-created at registration, never admin-editable alone
```

## Relationships at a glance
```text
users ──1:1── farmer_profiles ──1:N── farm_locations
   │                             └──1:N── service_requests ──crop_id──▶ crops
   │                                          ├──1:N── recommendations
   │                                          └──1:N── bookings ──recommendation_id──▶ recommendations
   │                                                       ├──0:1── storage_bookings ──▶ facility_crop_configs
   │                                                       │             └──1:1── storage_capacity_allocations
   │                                                       └──0:1── transportation_bookings ──▶ vehicles
   │                                                                     └──1:1── vehicle_availability_blocks
   ├──1:1── provider_profiles ──1:N── storage_facilities ──1:N── facility_crop_configs ──crop_id──▶ crops
   │                             ├──1:N── vehicles
   │                             └──1:N── provider_service_areas
   ├──1:N── notifications
   └──1:N── admin_action_logs (role=admin)

reviews:                 farmer_profiles + provider_profiles + (storage_booking XOR transportation_booking)
booking_status_history:  polymorphic → bookings | storage_bookings | transportation_bookings
roles ──1:N── user_roles ──N:1── users   (many-to-many; every user has ≥1 row, their structural role)
```
M:N relationships (`storage_facilities`↔`crops` via `facility_crop_configs`; `service_requests`↔ candidate facilities/vehicles via `recommendations`) are resolved through associative tables because the relationship itself carries data (capacity, price, cost, rank) — never as a bare pivot table.

## Capacity model
```text
available(config, date_range) = max_capacity_for_crop
    − Σ quantity of allocations for that config
      where status IN (reserved, occupied) AND date range overlaps
```
- Never stored — computed per query.
- Allocation row is created `reserved` **the moment a booking is requested** (before provider approval), so two farmers can't both claim the same window while one request is pending.
- `reserved → occupied` when the storage period starts. `→ released`/`cancelled` on completion/cancellation/rejection. Rows are never deleted — they double as capacity history.
- Overbooking check (Σ overlapping + new quantity ≤ `max_capacity_for_crop`) runs in a DB transaction with row locking, in the service layer — MariaDB has no exclusion constraint to enforce this natively. Violation → `409 Conflict`.
- Vehicles follow the identical pattern via `vehicle_availability_blocks`, using datetimes instead of dates.

## Booking model
- `booking_type` decides which child row(s) exist.
- Each child has its own `status` and its own provider (via facility→provider or vehicle→provider), so a combined booking with two different providers lets one approve while the other is still pending.
- `bookings.overall_status` becomes `confirmed` only once every applicable child is `approved`.
- Quantity, dates, and pricing are stored once, only on the owning child — never duplicated onto the parent.

## Pricing
- Current price lives on `facility_crop_configs.price_per_unit_per_day` and `vehicles.base_charge`/`cost_per_km` — mutable, provider-controlled.
- At booking time these are copied into `*_snapshot`/`total_*` columns and never recalculated afterward, so a later price change never alters an existing booking's cost.

## Recommendations
- Live matching/eligibility is never stored (it would go stale instantly).
- Its **ranked output** is persisted in `recommendations`, with `expires_at`/`status`, so the farmer gets a stable priced list and a booking can reference the exact row it was created from (`bookings.recommendation_id`) — guaranteeing what was shown matches what was charged.

## Booking TTL and expiry
A `requested` booking not approved/rejected within its TTL (default **24h**, read from config/env, not hardcoded) is expired by a scheduled job (`01` §Background Jobs): `bookings.overall_status → expired`, its `storage_capacity_allocations`/`vehicle_availability_blocks` rows → `cancelled`, releasing the held capacity.

## Feature flags
`feature_flags.global_enabled` is the default for a flag. `feature_flag_overrides` scopes a flag to one `role`, one `provider`, or one `user`, taking precedence over the global default in that order: **user override > provider override > role override > global default**. A role-scope row is only ever a grant (`enabled=1`) — see `01` §Feature Flags for why role-level denial isn't supported. Evaluation is cached in Redis and invalidated on write; all evaluation logic lives in the `feature-flags` service (`01`, `06`) — no module queries these tables directly.

## Roles
`roles` holds both the three system-protected roles (`farmer`, `provider`, `admin`, `is_system=1`) and any admin-created custom roles (`is_system=0`). `users.role` is unchanged — the single structural role that decides which profile table applies and drives real domain behavior. `user_roles` is a separate, additive overlay: at registration, a user's structural role is auto-inserted here; admin can then assign additional custom roles on top. A user's permission set for flag evaluation is their structural role **plus** every custom role assigned to them.

## Idempotency
`idempotency_keys` stores the client-supplied `Idempotency-Key` from `POST /bookings` (and similar) against the response that was produced, so a network-retried request with the same key returns the original result instead of re-executing the write. `request_hash` lets the service detect (and reject) the same key reused with a different body. Rows expire and are pruned on a configurable retention window, same pattern as recommendations/notifications below.

## Retention & pruning (scheduled jobs, `01` §Background Jobs)
| Table | Default retention | Configurable? |
|---|---|---|
| `service_recommendations` | 7 days after `expires_at`/expiry | Yes, via env/config |
| `notifications` | 90 days | Yes, via env/config |
| `idempotency_keys` | Short-lived (long enough to cover realistic retries) | Yes, via env/config |
| `booking_status_history` | Indefinite — no pruning job yet | Archive strategy deferred |
None of these windows are hardcoded in job code; they're read from config so they can be tuned without a deploy.

## Geography
Stored: endpoint coordinates only — `farm_locations`, `storage_facilities`, `provider_service_areas` (center + radius), and `transportation_bookings` pickup/dropoff snapshots — plus the calculated `distance_km`. **Not stored:** any road graph; the routing provider (`01` §Routing) computes distance/duration on demand from real road data.

## Integrity rules
- `users.role` gates which single profile table may reference the user.
- `provider_profiles` is the only provider entity; both `storage_facilities.provider_id` and `vehicles.provider_id` point to it.
- One config per (facility, crop) — enforced by a unique constraint, never a delimited/JSON crop list.
- Capacity/vehicle overlap limits: service-layer enforced (MariaDB has no exclusion constraints).
- **No hard deletes** on `users`, `provider_profiles`, `storage_facilities`, `vehicles`, `crops`, or any other entity a booking can reference — their existing `status` enum (`active`/`inactive`/`suspended`/`deactivated`/`maintenance` as applicable) is the only way to "remove" them. A row is only ever physically deleted if nothing could ever reference it historically (none of the tables above qualify).
- `reviews`: CHECK enforces exactly one FK set; each FK is UNIQUE (MariaDB permits multiple NULLs so "unique only when set" works natively); app restricts review creation to `completed` bookings.
- `booking_status_history.entity_id` is app-validated against the table named by `entity_type` (a FK can't conditionally target multiple tables).
- `recommendations.status` flips to `booked` once referenced by a `bookings.recommendation_id`.
- `feature_flag_overrides` is unique per `(flag_key, scope, scope_id)` — one override row per flag per role/provider/user.
- `roles.is_system=1` rows (`farmer`, `provider`, `admin`) can never be edited or deleted, and `is_system` is immutable once set — enforced in the `feature-flags` service, not just by this flag (`01` §Roles).
- A `user_roles` row where `role_key` equals the user's `users.role` is system-managed — created automatically at registration, never removable via the admin API on its own.
- `service_requests.needs_transportation` must always equal `service_type IN (transportation_only, both)` — app-validated on write, not independently settable (`00` §Booking scope resolves this; no longer an open question).

## Open items (need your decision — flagged in `00`)
| Item | Why it matters |
|---|---|
| Is `end_date` inclusive in storage-day/cost calculation? | Affects the `costs` formula directly |
| Vehicle block created on request (like storage) or only on confirmation? | Changes when a vehicle becomes unavailable to other requests |
| Map display provider: Leaflet+OSM, Google Maps, or both? (routing itself is decided: provider-abstracted, default OSRM — `01` §Routing) | Frontend map integration only |
