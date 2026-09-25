# ColdLink Database Architecture (MariaDB)

Source of truth for the data model. ORM mapping rules: `04`.

## Conventions
- MariaDB, InnoDB, `utf8mb4`. UUIDs = `CHAR(36)` (or native `UUID` on 10.7+). Flags = `TINYINT(1)`. Timestamps = `DATETIME`.
- Legend: `PK` primary key · `UK` unique · `FK→t.c` foreign key · `?` nullable · `V150` = `VARCHAR(150)` · `D(10,2)` = `DECIMAL(10,2)` · `DT` = `DATETIME` · `U` = `CHAR(36)`.
- `created_at`/`updated_at` are `DT` NOT NULL wherever listed.

## Design principles
- One account model: `users` + one profile table per role. A provider is one entity offering storage, transport, or both simply by owning facility and/or vehicle rows.
- One `service_requests` entity for storage-only, transport-only, or both. Request ≠ recommendation ≠ booking.
- Booking = parent + optional storage/transport children (may involve two different providers).
- Capacity = dated allocation rows, never a mutable counter.
- Prices are snapshotted on bookings.
- Intentional denormalization: `provider_profiles.average_rating/total_reviews`, `bookings.total_cost`, `bookings.farmer_id`, recommendation cost/rating snapshots.
- MariaDB has no exclusion constraints or partial unique indexes → overlap checks (capacity, vehicle scheduling) live in the service layer.

## Tables (20)
```text
users — identity/auth for every role
  id U PK · full_name V150 · email V150 UK · phone V20 UK · password_hash V255
  role ENUM(farmer,provider,admin) · status ENUM(active,suspended,deactivated) default active
  created_at · updated_at · last_login_at DT?

farmer_profiles — 1:1 extension of users
  user_id U PK FK→users.id · default_farm_address V255? · default_latitude D(9,6)?
  default_longitude D(9,6)? · national_id V50 UK? · created_at

provider_profiles — 1:1 extension of users
  user_id U PK FK→users.id · business_name V150 · business_registration_no V100 UK?
  business_address V255? · contact_person V150?
  provider_status ENUM(pending_verification,verified,suspended)
  average_rating D(3,2)? (cached from reviews.rating, recalc on new review)
  total_reviews INT default 0 (cached) · created_at · updated_at

crops
  id U PK · name V100 UK · category V100? · description TEXT?
  status ENUM(active,inactive) · created_at

storage_facilities
  id U PK · provider_id FK→provider_profiles.user_id · name V150 · description TEXT?
  address V255 · latitude D(9,6) · longitude D(9,6)
  total_capacity D(10,2) (facility-wide) · capacity_unit V20 default 'ton'
  status ENUM(active,inactive,maintenance) · created_at · updated_at

facility_crop_configs — M:N facility↔crop with attributes
  id U PK · facility_id FK→storage_facilities.id · crop_id FK→crops.id
  max_capacity_for_crop D(10,2) · price_per_unit_per_day D(10,2)
  is_available TINYINT(1) (provider toggle, independent of dated availability)
  created_at · updated_at · UK(facility_id, crop_id)

storage_capacity_allocations — dated capacity consumption
  id U PK · facility_crop_config_id FK→facility_crop_configs.id
  storage_booking_id FK→storage_bookings.id UK (1:1) · quantity D(10,2)
  start_date DATE · end_date DATE
  status ENUM(reserved,occupied,released,cancelled) · created_at · updated_at

vehicles
  id U PK · provider_id FK→provider_profiles.user_id
  vehicle_type ENUM(open_truck,covered_van,refrigerated_truck,pickup,other)
  registration_number V50 UK · capacity D(10,2) · capacity_unit V20 default 'ton'
  base_charge D(10,2) · cost_per_km D(10,2)
  status ENUM(available,unavailable,maintenance) · created_at · updated_at

provider_service_areas — radius coverage used to filter vehicles
  id U PK · provider_id FK→provider_profiles.user_id · region_name V150
  center_latitude D(9,6) · center_longitude D(9,6) · radius_km D(6,2) · created_at

vehicle_availability_blocks — dated vehicle commitment
  id U PK · vehicle_id FK→vehicles.id
  transportation_booking_id FK→transportation_bookings.id UK? (null = manual/maintenance block)
  start_datetime DT · end_datetime DT
  status ENUM(reserved,active,completed,cancelled,maintenance) · created_at · updated_at

farm_locations
  id U PK · farmer_id FK→farmer_profiles.user_id · label V100? · address V255
  latitude D(9,6) · longitude D(9,6) · created_at

service_requests
  id U PK · farmer_id FK→farmer_profiles.user_id · crop_id FK→crops.id
  quantity D(10,2) · quantity_unit V20 default 'ton' · farm_location_id FK→farm_locations.id
  service_type ENUM(storage_only,transportation_only,both)
  storage_start_date DATE? · storage_end_date DATE? (required when storage involved)
  needs_transportation TINYINT(1) (false = farmer arranges own transport)
  destination_address V255? · destination_latitude D(9,6)? · destination_longitude D(9,6)?
  status ENUM(open,matched,booked,cancelled,expired) · created_at · updated_at

service_recommendations — persisted ranked eligible combos (short-lived)
  id U PK · service_request_id FK→service_requests.id
  facility_id FK→storage_facilities.id? (null if transport-only)
  vehicle_id FK→vehicles.id? (null if storage-only)
  storage_cost D(10,2)? · transportation_cost D(10,2)? · total_cost D(10,2)
  distance_km D(7,2)? · provider_rating_snapshot D(3,2)? · rank_position INT
  generated_at DT · expires_at DT · status ENUM(active,expired,booked)

bookings — parent commitment
  id U PK · service_request_id FK→service_requests.id
  farmer_id FK→farmer_profiles.user_id (denormalized)
  recommendation_id FK→service_recommendations.id?
  booking_type ENUM(storage_only,transportation_only,both)
  overall_status ENUM(requested,approved,rejected,confirmed,active,completed,cancelled)
  total_cost D(10,2) (snapshot sum of children) · created_at · updated_at
  cancelled_at DT? · cancellation_reason V255?

storage_bookings — present only if booking_type ∈ {storage_only, both}
  id U PK · booking_id FK→bookings.id UK (1:1) · facility_crop_config_id FK→facility_crop_configs.id
  quantity D(10,2) · start_date DATE · end_date DATE
  price_per_unit_snapshot D(10,2) · total_storage_cost D(10,2)
  status ENUM(pending,approved,rejected,active,completed,cancelled) · created_at · updated_at

transportation_bookings — present only if booking_type ∈ {transportation_only, both}
  id U PK · booking_id FK→bookings.id UK (1:1) · vehicle_id FK→vehicles.id
  pickup_address V255 · pickup_latitude D(9,6) · pickup_longitude D(9,6)
  dropoff_address V255 · dropoff_latitude D(9,6) · dropoff_longitude D(9,6)
  distance_km D(7,2) · scheduled_datetime DT
  base_charge_snapshot D(10,2) · cost_per_km_snapshot D(10,2) · total_transport_cost D(10,2)
  status ENUM(pending,approved,rejected,active,completed,cancelled) · created_at · updated_at

booking_status_history — audit trail, polymorphic
  id U PK · entity_type ENUM(booking,storage_booking,transportation_booking)
  entity_id U (no DB FK; app-enforced) · previous_status V30? (null on first entry)
  new_status V30 · changed_by FK→users.id? (null = system) · reason V255? · changed_at DT

notifications — persisted; delivered live via Socket.IO
  id U PK · recipient_user_id FK→users.id · notification_type V50 · title V150 · message TEXT
  related_entity_type V50? · related_entity_id U? · is_read TINYINT(1) default 0
  created_at · read_at DT?

reviews — per booking side, so two providers in one combined booking are reviewed separately
  id U PK · farmer_id FK→farmer_profiles.user_id · provider_id FK→provider_profiles.user_id
  storage_booking_id FK→storage_bookings.id UK? · transportation_booking_id FK→transportation_bookings.id UK?
  rating TINYINT CHECK 1–5 · review_text TEXT? · created_at
  CHECK exactly one of storage_booking_id / transportation_booking_id is set

admin_action_logs — audit only (no stats tables; stats derive from operational tables)
  id U PK · admin_user_id FK→users.id · action_type V50 · target_entity_type V50
  target_entity_id U · description V255? · created_at
```

## Relationships
```text
users
├─ farmer_profiles (1:1, shared PK)
│  ├─ farm_locations
│  └─ service_requests ── crop → crops
│     ├─ service_recommendations (facility?, vehicle?)
│     └─ bookings (recommendation?)
│        ├─ storage_bookings (0..1) → facility_crop_configs ; 1:1 storage_capacity_allocations
│        └─ transportation_bookings (0..1) → vehicles ; 1:1 vehicle_availability_blocks
├─ provider_profiles (1:1, shared PK)
│  ├─ storage_facilities ─ facility_crop_configs ─ crops
│  ├─ vehicles
│  └─ provider_service_areas
├─ notifications
└─ admin_action_logs
reviews:                farmer_profiles + provider_profiles + (storage_booking XOR transportation_booking)
booking_status_history: polymorphic → bookings | storage_bookings | transportation_bookings
```
One request may yield many bookings (a rejected/cancelled one can be retried).

## Capacity & availability
```text
available(config, range) = max_capacity_for_crop
                         − Σ quantity of allocations for that config
                           with status IN (reserved, occupied) and [start_date,end_date] overlapping range
```
- Never stored; always computed for the requested range.
- Allocation is created `reserved` **when the booking is requested** (before provider approval) so pending requests block overbooking.
- `reserved → occupied` when the storage period starts; → `released` or `cancelled` on completion, cancellation or rejection. Rows are never deleted (they are the capacity history).
- Overbooking check: Σ overlapping + new quantity ≤ `max_capacity_for_crop`, in a transaction with row locking, in the service layer. Failure → `409`.
- Vehicles use the same pattern with `vehicle_availability_blocks` and datetimes: no two overlapping `reserved`/`active` blocks per vehicle.

## Bookings
- `booking_type` decides which child rows exist. Each child has its own status and provider (facility→provider; vehicle→provider) and its own capacity mechanism.
- `overall_status` aggregates children; it becomes `confirmed` only when all applicable children are `approved`.
- Quantity, dates and prices live once, on the relevant child only.
- Every status change on `bookings`, `storage_bookings` or `transportation_bookings` appends a `booking_status_history` row.

## Pricing
- Current prices: `facility_crop_configs.price_per_unit_per_day`; `vehicles.base_charge`, `vehicles.cost_per_km`.
- On booking, copy them into the `*_snapshot` and `total_*` columns. Never recalculate from current prices.

## Recommendations
- Eligibility/matching is not stored (stale immediately); its **ranked result** is, in `service_recommendations`.
- Rows expire (`expires_at`, `status`) and are regenerated/purged; no permanent recommendation history beyond what a booking preserves.
- Ranking inputs: total cost, distance, `provider_profiles.average_rating`, available capacity.
- Booking from a recommendation sets `bookings.recommendation_id`; the recommendation becomes `booked`.

## Geography
- Stored: endpoint coordinates only (`farm_locations`, `storage_facilities`, `provider_service_areas` center+radius, `transportation_bookings` pickup/dropoff snapshots) and calculation results (`distance_km`).
- **Not stored:** the road graph. Dijkstra runs on graph data supplied at request time (OSM/Google). No road tables.

## Integrity rules
- `users.role` decides the single profile table that may reference a user; a user is never both farmer and provider.
- `provider_profiles` is the only provider entity; `storage_facilities.provider_id` and `vehicles.provider_id` reference it.
- Crop support is a `facility_crop_configs` row, never a delimited string or JSON list.
- Capacity and vehicle-overlap limits are enforced in the service layer (above).
- `bookings.booking_type` constrains which child rows may exist.
- `reviews`: CHECK for exactly-one FK; each FK is UK (MariaDB allows multiple NULLs); app allows a review only when that child is `completed`.
- Snapshot columns are written once at booking creation.
- `booking_status_history.entity_type + entity_id` must resolve to a real row (app-enforced; no DB FK).
- `service_recommendations.status` becomes `booked` once referenced by `bookings.recommendation_id`.

## Undecided
- Allowed combinations of `service_requests.service_type` × `needs_transportation` (e.g. `storage_only` with `needs_transportation=true`).
- `storage_days` convention (is `end_date` inclusive?).
- Whether Σ `max_capacity_for_crop` must stay ≤ `storage_facilities.total_capacity`.
- When the `vehicle_availability_blocks` row is created (on request as `reserved`, or on confirmation).
- Future extensions (not in v1): `price_change_log`, multi-vehicle transport bookings, polygon service areas.
