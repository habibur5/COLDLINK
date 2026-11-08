> **Planning warning:** This schema is not yet a migration-ready implementation contract. Legacy rows/notes mentioning `users.role`, structural roles, licensed custody, or live settlement are superseded. Reconcile model, table definitions, keys, and indexes against accepted ADRs before implementation.

# ColdLink — Database Schema (updated)

Data-model planning reference for MariaDB (InnoDB, utf8mb4) and Prisma ORM 7. This document contains legacy role-based and real-settlement assumptions that conflict with accepted ADR-0003 and the Waterfall feature boundary. Before implementing domain migrations, reconcile it with ADR-0003 (permission-based RBAC), ADR-0006 (#19 sandbox attempts only), ADR-0008 (academic finance simulation), `.ai/12-development-strategy.md`, and current issue decisions. Financial tables, if retained, model academic records and simulated external operations only; they must never imply ColdLink custody or real payout. Prisma mappings/conventions: `04`.
This version applies the review changes. Everything not tagged is exactly as in the previous schema. Compare against your current `10` before replacing it.

## Conventions
- Ids are `CHAR(36)` UUIDs unless stated.
- `created_at` / `updated_at` / `*_at` are `DATETIME` stored in **UTC**; convert to Bangladesh time in the UI. The previous schema listed these names without types, so `DATETIME` is an assumption.
- A column not marked `NULL` is `NOT NULL`.
- **Every FK is `ON DELETE RESTRICT`.** No hard deletes on anything a booking can reference (users, providers, facilities, vehicles, crops, farm locations): every "delete" flips a status field.
- Polymorphic references (`booking_status_history.entity_id`, `notifications.related_entity_id`, `admin_action_logs.target_entity_id`, `feature_flag_overrides.scope_id`) are **not** DB foreign keys; they are checked in the service layer.
- Tags used below:

| Tag | Meaning |
|---|---|
| `[NEW]` | Needed by the docs; the schema is incomplete without it |
| `[CHANGED]` | Existing column or key modified |
| `[SHOULD]` | Recommended; your decision |
| `[OPTIONAL]` | Optional extra |
| `[REMOVE?]` | Proposed removal (duplicate of another column) |

---

## 1. Users and access

```text
users
  id CHAR(36) PK · full_name VARCHAR(150) · email VARCHAR(150) UNIQUE · phone VARCHAR(20) UNIQUE
  password_hash VARCHAR(255) · role ENUM(farmer,provider,admin)
  status ENUM(active,suspended,deactivated) default active
  created_at · updated_at · last_login_at DATETIME NULL
  email_verified_at DATETIME NULL          -- [NEW] NULL = not verified; email verification flow (01 auth)

auth_tokens                                      -- [NEW TABLE] verification, password reset, refresh
  id CHAR(36) PK · user_id CHAR(36) FK→users.id
  token_type ENUM(email_verification,password_reset,refresh)
  token_hash VARCHAR(64) UNIQUE                  -- hash only (e.g. SHA-256 hex), never the raw token
  expires_at DATETIME
  used_at DATETIME NULL                          -- set when a one-time token is consumed
  revoked_at DATETIME NULL                       -- set on logout / refresh revocation
  created_at

farmer_profiles                                  -- 1:1 with users
  user_id CHAR(36) PK FK→users.id
  default_farm_address VARCHAR(255) NULL         -- [REMOVE?] duplicates farm_locations (see §6 S3)
  default_latitude DECIMAL(9,6) NULL             -- [REMOVE?]
  default_longitude DECIMAL(9,6) NULL            -- [REMOVE?]
  created_at

provider_profiles                                -- 1:1 with users
  user_id CHAR(36) PK FK→users.id · business_name VARCHAR(150)
  business_address VARCHAR(255) NULL · contact_person VARCHAR(150) NULL
  provider_status ENUM(pending_verification,verified,suspended)
  average_rating DECIMAL(3,2) NULL         -- cached, recomputed on new review
  total_reviews INT default 0              -- cached
  created_at · updated_at

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

## 2. Supply side (providers)

```text
crops
  id CHAR(36) PK · name VARCHAR(100) UNIQUE
  name_bn VARCHAR(100) NULL                      -- [DEFERRED] Bangla localization is outside V1; see ADR-0010
  category VARCHAR(100) NULL
  status ENUM(active,inactive) · created_at

storage_facilities
  id CHAR(36) PK · provider_id FK→provider_profiles.user_id
  name VARCHAR(150) · address VARCHAR(255)
  latitude DECIMAL(9,6) · longitude DECIMAL(9,6)      -- used for routing distance + Redis distance cache
  status ENUM(active,inactive,maintenance) · created_at · updated_at

facility_crop_configs                            -- resolves facility ↔ crop, carries capacity+price
  id CHAR(36) PK · facility_id FK→storage_facilities.id · crop_id FK→crops.id
  max_capacity_for_crop DECIMAL(10,2) · price_per_unit_per_day DECIMAL(10,2)
  is_available TINYINT(1)                  -- provider on/off toggle, separate from dated availability
  created_at · updated_at · UNIQUE(facility_id, crop_id)

storage_capacity_allocations                     -- the actual dated consumption
  id CHAR(36) PK · facility_crop_config_id FK→facility_crop_configs.id
  storage_booking_id FK→storage_bookings.id UNIQUE   -- 1:1, set once booked (create order: see §7 D3)
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
  start_datetime DATETIME
  end_datetime DATETIME                          -- = scheduled_datetime + duration_min (+ any buffer you choose)
  status ENUM(reserved,active,completed,cancelled,maintenance) · created_at · updated_at
```

## 3. Demand and booking (farmers)

```text
farm_locations                                   -- reusable, so requests don't re-enter coords
  id CHAR(36) PK · farmer_id FK→farmer_profiles.user_id
  label VARCHAR(100) NULL · address VARCHAR(255)
  latitude DECIMAL(9,6) · longitude DECIMAL(9,6)
  is_default TINYINT(1) default 0                -- [SHOULD] replaces farmer_profiles.default_*; one default per farmer (service layer)
  status ENUM(active,inactive) default active    -- [SHOULD] soft delete; service_requests reference this table
  created_at

service_requests                                 -- single entry point, all 3 service types
  id CHAR(36) PK · farmer_id FK→farmer_profiles.user_id · crop_id FK→crops.id
  quantity DECIMAL(10,2) · farm_location_id FK→farm_locations.id
  service_type ENUM(storage_only,transportation_only,both)
  storage_start_date DATE NULL · storage_end_date DATE NULL
  needs_transportation TINYINT(1)          -- app-derived from service_type, see §Booking scope; not independently settable
  pickup_datetime DATETIME NULL            -- [NEW] required when needs_transportation = 1
  destination_address VARCHAR(255) NULL · destination_latitude DECIMAL(9,6) NULL
  destination_longitude DECIMAL(9,6) NULL
  status ENUM(open,matched,booked,cancelled,expired) · created_at · updated_at

recommendations                                  -- persisted ranked deals (docs 00/01 call this service_recommendations; see §6 S1)
  id CHAR(36) PK · service_request_id FK→service_requests.id
  facility_id FK→storage_facilities.id NULL · vehicle_id FK→vehicles.id NULL
  storage_cost DECIMAL(10,2) NULL · transport_cost DECIMAL(10,2) NULL
  total_cost DECIMAL(10,2) · distance_km DECIMAL(7,2) NULL
  duration_min INT NULL                          -- [NEW] from the routing provider (durationMin)
  available_capacity_snapshot DECIMAL(10,2) NULL -- [NEW] shown per deal; ranking tie-break 4
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
  expires_at DATETIME NULL                        -- [OPTIONAL] created_at + TTL for the sweep job
  created_at · updated_at · cancelled_at DATETIME NULL · cancellation_reason VARCHAR(255) NULL

storage_bookings                                 -- present iff booking_type ∈ {storage_only, both}
  id CHAR(36) PK · booking_id FK→bookings.id UNIQUE
  facility_crop_config_id FK→facility_crop_configs.id
  quantity DECIMAL(10,2) · start_date DATE · end_date DATE
  price_per_unit_snapshot DECIMAL(10,2) · total_storage_cost DECIMAL(10,2)
  status ENUM(pending,approved,rejected,active,completed,cancelled)
  rejection_reason VARCHAR(255) NULL              -- [OPTIONAL]
  created_at · updated_at

transportation_bookings                          -- present iff booking_type ∈ {transportation_only, both}
  id CHAR(36) PK · booking_id FK→bookings.id UNIQUE · vehicle_id FK→vehicles.id
  pickup_address VARCHAR(255) · pickup_latitude DECIMAL(9,6) · pickup_longitude DECIMAL(9,6)
  dropoff_address VARCHAR(255) · dropoff_latitude DECIMAL(9,6) · dropoff_longitude DECIMAL(9,6)
  distance_km DECIMAL(7,2)
  duration_min INT                                -- [NEW] trip duration snapshot (routing provider)
  scheduled_datetime DATETIME
  base_charge_snapshot DECIMAL(10,2) · cost_per_km_snapshot DECIMAL(10,2)
  total_transport_cost DECIMAL(10,2)
  status ENUM(pending,approved,rejected,active,completed,cancelled)
  rejection_reason VARCHAR(255) NULL              -- [OPTIONAL]
  created_at · updated_at

reviews                                          -- one per booking side, so a combined booking
  id CHAR(36) PK · farmer_id FK→farmer_profiles.user_id       -- gets two independent reviews
  provider_id FK→provider_profiles.user_id
  storage_booking_id FK→storage_bookings.id UNIQUE NULL
  transportation_booking_id FK→transportation_bookings.id UNIQUE NULL
  rating TINYINT CHECK(rating BETWEEN 1 AND 5) · review_text TEXT NULL · created_at
  CHECK: exactly one of storage_booking_id / transportation_booking_id is set
```

## 4. System

```text
booking_status_history                           -- audit trail, polymorphic target
  id CHAR(36) PK · entity_type ENUM(booking,storage_booking,transportation_booking)
  entity_id CHAR(36)                              -- not a DB FK: target table varies by entity_type
  previous_status VARCHAR(30) NULL · new_status VARCHAR(30)
  changed_by FK→users.id NULL                     -- null = system-triggered
  reason VARCHAR(255) NULL · changed_at DATETIME

notifications
  id CHAR(36) PK · recipient_user_id FK→users.id
  notification_type VARCHAR(50) · title VARCHAR(150) · message TEXT
  related_entity_type VARCHAR(50) NULL · related_entity_id CHAR(36) NULL   -- not a DB FK
  is_read TINYINT(1) default 0 · created_at · read_at DATETIME NULL

admin_action_logs
  id CHAR(36) PK · admin_user_id FK→users.id · action_type VARCHAR(50)
  target_entity_type VARCHAR(50) · target_entity_id CHAR(36)               -- not a DB FK
  description VARCHAR(255) NULL · created_at

feature_flags                                    -- global default per named flag
  id CHAR(36) PK · flag_key VARCHAR(100) UNIQUE       -- e.g. 'reviews.enabled', 'booking.create'
  description VARCHAR(255) NULL · global_enabled TINYINT(1) default 0
  created_at · updated_at

feature_flag_overrides                           -- per-role, per-provider, or per-user override
  id CHAR(36) PK · flag_key FK→feature_flags.flag_key
  scope ENUM(role,provider,user) · scope_id VARCHAR(100)  -- role_key (scope=role), provider_profiles.user_id, or users.id; not a DB FK
  enabled TINYINT(1)                                       -- role-scope rows: only ever 1, see `01` §Feature Flags
  created_at · updated_at · UNIQUE(flag_key, scope, scope_id)
  CHECK(scope <> 'role' OR enabled = 1)                    -- [SHOULD] enforce "role overrides only grant"

idempotency_keys                                 -- survive a retried create request
  user_id CHAR(36) FK→users.id                        -- [NEW] key is unique per user
  idempotency_key VARCHAR(100)                        -- client-supplied, from the Idempotency-Key header
  PRIMARY KEY(user_id, idempotency_key)               -- [CHANGED] was idempotency_key alone
  endpoint VARCHAR(100)                               -- which route this key was used against
  request_hash VARCHAR(64)                            -- detects a reused key with a different body
  status ENUM(processing,completed) default processing  -- [NEW] stops two simultaneous retries both running
  response_status INT NULL · response_body JSON NULL  -- [CHANGED] now nullable: empty while processing
  created_at · expires_at DATETIME                    -- retention configurable, not hardcoded

payment_attempts                                 -- #19; sandbox provider attempts
  id CHAR(36) PK · merchant_reference · provider ENUM(bkash,sslcommerz)
  provider_reference NULL · amount BIGINT          -- integer poisha, never decimal/floating point
  currency · status · relevant timestamps
  -- No credentials, access tokens, PINs, OTPs, or unnecessary raw callback payloads.
  -- Enforce appropriate uniqueness for merchant/provider references and idempotent initiation.
  -- Exact ownership relationship/FK, column lengths, timestamp fields, status enum, and indexes
  -- are finalized during implementation; callbacks never update booking lifecycle state.
```

The approved minimum persisted data for #19 is merchant reference, provider reference, amount, currency, provider, status, and relevant timestamps. Payment-attempt ownership must be verifiable for authenticated initiation and callback correlation; determine its relation to existing records without making the Payment module an owner of booking transitions or ledger behavior.

---

## 5. Foreign keys (all `ON DELETE RESTRICT`)

| # | Child.column | → Parent.column | Cardinality | Child col NULL? |
|---|---|---|---|---|
| 1 | `farmer_profiles.user_id` | `users.id` | one-to-one | NO |
| 2 | `provider_profiles.user_id` | `users.id` | one-to-one | NO |
| 3 | `farm_locations.farmer_id` | `farmer_profiles.user_id` | many-to-one | NO |
| 4 | `storage_facilities.provider_id` | `provider_profiles.user_id` | many-to-one | NO |
| 5 | `facility_crop_configs.facility_id` | `storage_facilities.id` | many-to-one | NO |
| 6 | `facility_crop_configs.crop_id` | `crops.id` | many-to-one | NO |
| 7 | `storage_capacity_allocations.facility_crop_config_id` | `facility_crop_configs.id` | many-to-one | NO |
| 8 | `storage_capacity_allocations.storage_booking_id` | `storage_bookings.id` | one-to-one | NO |
| 9 | `vehicles.provider_id` | `provider_profiles.user_id` | many-to-one | NO |
| 10 | `provider_service_areas.provider_id` | `provider_profiles.user_id` | many-to-one | NO |
| 11 | `vehicle_availability_blocks.vehicle_id` | `vehicles.id` | many-to-one | NO |
| 12 | `vehicle_availability_blocks.transportation_booking_id` | `transportation_bookings.id` | zero-or-one-to-one | YES |
| 13 | `service_requests.farmer_id` | `farmer_profiles.user_id` | many-to-one | NO |
| 14 | `service_requests.crop_id` | `crops.id` | many-to-one | NO |
| 15 | `service_requests.farm_location_id` | `farm_locations.id` | many-to-one | NO |
| 16 | `recommendations.service_request_id` | `service_requests.id` | many-to-one | NO |
| 17 | `recommendations.facility_id` | `storage_facilities.id` | many-to-one | YES |
| 18 | `recommendations.vehicle_id` | `vehicles.id` | many-to-one | YES |
| 19 | `bookings.service_request_id` | `service_requests.id` | many-to-one | NO |
| 20 | `bookings.farmer_id` | `farmer_profiles.user_id` | many-to-one | NO |
| 21 | `bookings.recommendation_id` | `recommendations.id` | many-to-one | YES |
| 22 | `storage_bookings.booking_id` | `bookings.id` | one-to-zero-or-one | NO |
| 23 | `storage_bookings.facility_crop_config_id` | `facility_crop_configs.id` | many-to-one | NO |
| 24 | `transportation_bookings.booking_id` | `bookings.id` | one-to-zero-or-one | NO |
| 25 | `transportation_bookings.vehicle_id` | `vehicles.id` | many-to-one | NO |
| 26 | `booking_status_history.changed_by` | `users.id` | many-to-one | YES |
| 27 | `notifications.recipient_user_id` | `users.id` | many-to-one | NO |
| 28 | `reviews.farmer_id` | `farmer_profiles.user_id` | many-to-one | NO |
| 29 | `reviews.provider_id` | `provider_profiles.user_id` | many-to-one | NO |
| 30 | `reviews.storage_booking_id` | `storage_bookings.id` | zero-or-one-to-one | YES |
| 31 | `reviews.transportation_booking_id` | `transportation_bookings.id` | zero-or-one-to-one | YES |
| 32 | `admin_action_logs.admin_user_id` | `users.id` | many-to-one | NO |
| 33 | `feature_flag_overrides.flag_key` | `feature_flags.flag_key` | many-to-one | NO |
| 34 | `user_roles.user_id` | `users.id` | many-to-one | NO |
| 35 | `user_roles.role_key` | `roles.role_key` | many-to-one | NO |
| 36 | `auth_tokens.user_id` | `users.id` | many-to-one | NO |
| 37 | `idempotency_keys.user_id` | `users.id` | many-to-one | NO |

**Logical references (no DB FK):** `booking_status_history.entity_id` (→ `bookings` / `storage_bookings` / `transportation_bookings` by `entity_type`), `notifications.related_entity_id`, `admin_action_logs.target_entity_id`, `feature_flag_overrides.scope_id` (→ `roles.role_key` / `provider_profiles.user_id` / `users.id` by `scope`).

## 5a. Indexes

InnoDB also creates an index on each FK column automatically. Listed below are the unique keys plus the extra composite indexes the pipelines need. Tag `[NEW]` = added by this review.

| Table | Index | Columns | Unique | Purpose |
|---|---|---|---|---|
| `users` | `uq_users_email` | `email` | yes | Login lookup |
| `users` | `uq_users_phone` | `phone` | yes | Login lookup |
| `auth_tokens` | `uq_auth_tokens_hash` | `token_hash` | yes | Token lookup `[NEW]` |
| `auth_tokens` | `idx_auth_tokens_user` | `user_id, token_type` | no | A user's active tokens `[NEW]` |
| `auth_tokens` | `idx_auth_tokens_expires` | `expires_at` | no | Expired token pruning `[NEW]` |
| `crops` | `uq_crops_name` | `name` | yes | Catalog uniqueness |
| `farm_locations` | `idx_farm_locations_farmer` | `farmer_id, status` | no | Active locations per farmer `[NEW]` |
| `storage_facilities` | `idx_facilities_provider` | `provider_id, status` | no | Provider dashboard, ownership checks `[NEW]` |
| `storage_facilities` | `idx_facilities_status` | `status` | no | Matching filter: active facilities `[NEW]` |
| `facility_crop_configs` | `uq_fcc_facility_crop` | `facility_id, crop_id` | yes | One config per facility and crop |
| `facility_crop_configs` | `idx_fcc_crop_available` | `crop_id, is_available` | no | Matching: facilities supporting a crop `[NEW]` |
| `storage_capacity_allocations` | `uq_alloc_storage_booking` | `storage_booking_id` | yes | 1:1 with storage booking |
| `storage_capacity_allocations` | `idx_alloc_overlap` | `facility_crop_config_id, status, start_date, end_date` | no | Capacity overlap check, row locking `[NEW]` |
| `vehicles` | `uq_vehicles_registration` | `registration_number` | yes | Registration uniqueness |
| `vehicles` | `idx_vehicles_provider_status` | `provider_id, status` | no | Eligibility, ownership checks `[NEW]` |
| `provider_service_areas` | `idx_service_areas_provider` | `provider_id` | no | Coverage lookup `[NEW]` |
| `vehicle_availability_blocks` | `uq_vab_transport_booking` | `transportation_booking_id` | yes | 1:1 (NULLs allowed) |
| `vehicle_availability_blocks` | `idx_vab_overlap` | `vehicle_id, status, start_datetime, end_datetime` | no | Vehicle overlap check `[NEW]` |
| `service_requests` | `idx_sr_farmer` | `farmer_id, status, created_at` | no | Farmer history `[NEW]` |
| `recommendations` | `idx_rec_request_rank` | `service_request_id, rank_position` | no | Ranked deals in order `[NEW]` |
| `recommendations` | `idx_rec_generated` | `generated_at` | no | Pruning job (default 7 days) `[NEW]` |
| `recommendations` | `idx_rec_expires` | `expires_at` | no | Expiring recommendations `[NEW]` |
| `bookings` | `idx_bookings_status_created` | `overall_status, created_at` | no | TTL sweep `[NEW]` |
| `bookings` | `idx_bookings_farmer_created` | `farmer_id, created_at` | no | Farmer history `[NEW]` |
| `bookings` | `idx_bookings_request` | `service_request_id` | no | Booking by request `[NEW]` |
| `storage_bookings` | `uq_sb_booking` | `booking_id` | yes | One storage child per booking |
| `storage_bookings` | `idx_sb_config_status` | `facility_crop_config_id, status` | no | Provider approval queue `[NEW]` |
| `transportation_bookings` | `uq_tb_booking` | `booking_id` | yes | One transport child per booking |
| `transportation_bookings` | `idx_tb_vehicle_status` | `vehicle_id, status` | no | Provider approval queue `[NEW]` |
| `booking_status_history` | `idx_bsh_entity` | `entity_type, entity_id, changed_at` | no | History of one entity `[NEW]` |
| `notifications` | `idx_notif_recipient` | `recipient_user_id, is_read, created_at` | no | Unread list `[NEW]` |
| `notifications` | `idx_notif_created` | `created_at` | no | Pruning job (default 90 days) `[NEW]` |
| `reviews` | `uq_reviews_storage` | `storage_booking_id` | yes | One review per storage booking |
| `reviews` | `uq_reviews_transport` | `transportation_booking_id` | yes | One review per transport booking |
| `reviews` | `idx_reviews_provider` | `provider_id, created_at` | no | Rating recalculation `[NEW]` |
| `admin_action_logs` | `idx_aal_admin` | `admin_user_id, created_at` | no | Audit by admin `[NEW]` |
| `admin_action_logs` | `idx_aal_target` | `target_entity_type, target_entity_id` | no | Audit by target `[NEW]` |
| `feature_flags` | `uq_flags_key` | `flag_key` | yes | Flag lookup |
| `feature_flag_overrides` | `uq_ffo_flag_scope` | `flag_key, scope, scope_id` | yes | One override per target |
| `feature_flag_overrides` | `idx_ffo_scope` | `scope, scope_id` | no | Load overrides for a user/provider/role `[NEW]` |
| `idempotency_keys` | `idx_idem_expires` | `expires_at` | no | Retention pruning `[NEW]` |
| `user_roles` | `idx_user_roles_role` | `role_key` | no | Users holding a role `[NEW]` |

## 5b. Constraints

| Table | Type | Definition | Tag |
|---|---|---|---|
| `reviews` | CHECK | `rating BETWEEN 1 AND 5` | — |
| `reviews` | CHECK | exactly one of `storage_booking_id` / `transportation_booking_id` is set | — |
| `user_roles` | PK | `(user_id, role_key)` | — |
| `idempotency_keys` | PK | `(user_id, idempotency_key)` | `[CHANGED]` |
| `service_requests` | CHECK | `needs_transportation = 0 OR pickup_datetime IS NOT NULL` | `[NEW]` |
| `feature_flag_overrides` | CHECK | `scope <> 'role' OR enabled = 1` | `[SHOULD]` |
| `service_requests` | CHECK | `(service_type='storage_only' AND needs_transportation=0) OR (service_type<>'storage_only' AND needs_transportation=1)` | `[SHOULD]` |
| `service_requests` | CHECK | `storage_end_date >= storage_start_date` (when both set); `quantity > 0` | `[SHOULD]` |
| `storage_bookings` | CHECK | `end_date >= start_date AND quantity > 0` | `[SHOULD]` |
| `storage_capacity_allocations` | CHECK | `end_date >= start_date AND quantity > 0` | `[SHOULD]` |
| `vehicle_availability_blocks` | CHECK | `end_datetime > start_datetime` | `[SHOULD]` |
| `transportation_bookings` | CHECK | `duration_min > 0 AND distance_km >= 0` | `[SHOULD]` |
| `facility_crop_configs` | CHECK | `max_capacity_for_crop > 0 AND price_per_unit_per_day >= 0` | `[SHOULD]` |
| `vehicles` | CHECK | `capacity > 0 AND base_charge >= 0 AND cost_per_km >= 0` | `[SHOULD]` |
| `provider_service_areas` | CHECK | `radius_km > 0` | `[SHOULD]` |
| `bookings` | CHECK | `total_cost >= 0` | `[SHOULD]` |

Single-column `UNIQUE` keys are inline in §1–§4. MariaDB enforces `CHECK` from 10.2.

---

## 6. Changes vs previous schema

| ID | Priority | Table(s) | Change |
|---|---|---|---|
| M1 | Must | `users`, `auth_tokens` | Add `email_verified_at` and the new `auth_tokens` table; add an auth-token pruning job |
| M2 | Must | `service_requests`, `transportation_bookings`, `recommendations` | Add `pickup_datetime`; add `duration_min` (NOT NULL on bookings, NULL on recommendations) |
| M3 | Must | `recommendations` | Add `available_capacity_snapshot` |
| M4 | Must | `idempotency_keys` | Add `user_id`, composite PK, `status`; nullable response columns |
| M5 | Must | all | Add missing indexes (§5a); `ON DELETE RESTRICT` on every FK |
| S1 | Should | `recommendations` | Decide one name: schema says `recommendations`, docs `00`/`01` say `service_recommendations` |
| S2 | Should | docs | Define units (e.g. all quantities in kg) and whether `storage_days` counts both start and end dates |
| S3 | Should | `farm_locations`, `farmer_profiles` | `farm_locations` becomes the single source: add `is_default`, `status`; drop `farmer_profiles.default_*` |
| S4 | Should | `feature_flag_overrides` | CHECK that role-scope rows have `enabled = 1` |
| S5 | Should | all `DATETIME` | Store UTC; convert in the UI |
| S6 | Should | several | Data-integrity CHECKs (§5b) |
| O1 | Deferred | `crops` | `name_bn` — outside V1 per ADR-0010 |
| O2 | Optional | `bookings` | `expires_at` |
| O3 | Optional | `storage_bookings`, `transportation_bookings` | `rejection_reason` |

## 7. Doc gaps (not schema columns)

| ID | Gap | Suggested resolution |
|---|---|---|
| D1 | Nothing moves a booking `confirmed → active → completed`, or an allocation `reserved → occupied` | Scheduled job in `jobs`, driven by start/end dates, writing `booking_status_history` rows |
| D2 | For a `both` booking, one provider approves and the other rejects: undefined | Reject the parent, cancel the approved child, release its capacity |
| D3 | `01` inserts the allocation before the booking, but `storage_booking_id` is required | Transaction order: booking → storage_booking → allocation. Lock with `SELECT ... FOR UPDATE` on the `facility_crop_configs` row so bookings serialize per facility+crop even with no allocation rows yet |
| D4 | Auth token strategy (access/refresh, lifetimes) not decided | Decide before implementing `auth_tokens` |
| D5 | `booking_status_history` has no retention/archive plan | Keep as is for v1 (already deferred in `01`) |

## Undecided
S1 (table name), S2 (units and day counting), S3 (drop `farmer_profiles.default_*`), D4 (token strategy). Never invent these: follow existing code, else ask.
