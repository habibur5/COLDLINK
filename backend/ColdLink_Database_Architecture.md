# ColdLink Database Architecture

## 1. Architecture Overview

ColdLink is modeled as a relational PostgreSQL database organized around one continuous workflow: **Requirements → Matching → Recommendation → Route/Cost → Booking → Capacity → Completion**. Rather than treating storage and transportation as two unrelated sub-systems, the schema is built around a small set of shared concepts that both services plug into:

- A single **account model** (`users` + role-specific profile tables) so a provider is one entity regardless of which services it offers.
- A single **service request** entity that can represent storage-only, transportation-only, or combined needs, instead of three parallel request systems.
- A **matching/recommendation layer** that is clearly separated from both the request (what the farmer wants) and the booking (what was actually committed to).
- A **booking hierarchy** — one parent `bookings` row with optional `storage_bookings` and `transportation_bookings` children — so combined bookings do not duplicate data and so a combined booking can legitimately involve two different providers (one for storage, one for transport).
- **Capacity as allocation records**, not as a single mutable counter, because both storage and vehicle capacity are date/time-dependent and must support overlap checks.
- **Pricing snapshots** embedded in booking records, so historical bookings remain accurate even after a provider changes their current prices.

The design targets 3NF for all transactional data. A handful of fields are intentionally denormalized (e.g. cached provider ratings, booking total cost) where recomputing them on every read would be wasteful; these are called out explicitly wherever they appear.

## 2. Domain Breakdown

- **Authentication & Users** — `users`, shared by all three roles; authentication/identity concerns are fully separated from role-specific business data.
- **Farmers** — `farmer_profiles`, `farm_locations`. Farmer-specific data extending a user.
- **Providers** — `provider_profiles`. A single provider account that can own both storage facilities and vehicles.
- **Crops** — `crops`. Independent master data, referenced by facilities (via a linking table), service requests, and bookings.
- **Storage** — `storage_facilities`, `facility_crop_configs`. Facilities and the crop-specific configuration they support.
- **Transportation** — `vehicles`, `provider_service_areas`. Vehicles and the geographic areas a provider is willing to serve.
- **Locations** — coordinates/addresses embedded directly on the entities that own them (`farm_locations`, `storage_facilities`, `provider_service_areas`), plus request/booking-level location snapshots. No separate generic "locations" master table is used, since each location has a clear owning entity.
- **Service Requests** — `service_requests`. The single entry point for a farmer's need, covering all three service types.
- **Matching & Recommendations** — `service_recommendations`. Persisted, short-lived snapshots of ranked eligible combinations.
- **Bookings** — `bookings`, `storage_bookings`, `transportation_bookings`, `booking_status_history`.
- **Capacity** — `storage_capacity_allocations`, `vehicle_availability_blocks`.
- **Pricing** — current pricing lives on `facility_crop_configs` and `vehicles`; historical pricing is snapshotted onto `storage_bookings` and `transportation_bookings`.
- **Notifications** — `notifications`.
- **Reviews** — `reviews`.
- **Administration** — `admin_action_logs`, plus read access to all operational tables above for monitoring and statistics (no separate stats tables).

## 3. Entity Inventory

| # | Entity/Table | Purpose | Domain | Type |
|---|---|---|---|---|
| 1 | `users` | Core identity/auth record for every farmer, provider, and admin | Authentication & Users | Master |
| 2 | `farmer_profiles` | Farmer-specific extension of a user | Farmers | Master |
| 3 | `provider_profiles` | Provider-specific extension of a user (single account for storage + transport) | Providers | Master |
| 4 | `crops` | Catalog of crop types the platform understands | Crops | Master |
| 5 | `storage_facilities` | A cold-storage facility owned by a provider | Storage | Master |
| 6 | `facility_crop_configs` | Which crops a facility supports, with crop-specific capacity/pricing | Storage / Crops | Associative |
| 7 | `storage_capacity_allocations` | Date-ranged reservation/occupation of facility capacity | Capacity | Transactional |
| 8 | `vehicles` | A transport vehicle owned by a provider | Transportation | Master |
| 9 | `provider_service_areas` | Geographic areas a provider is willing to serve | Transportation | Supporting |
| 10 | `vehicle_availability_blocks` | Time-ranged reservation/unavailability of a vehicle | Capacity | Transactional |
| 11 | `farm_locations` | Reusable farm/plot locations belonging to a farmer | Farmers / Locations | Supporting |
| 12 | `service_requests` | A farmer's storage/transport/combined requirement | Service Requests | Transactional |
| 13 | `service_recommendations` | Persisted snapshot of a ranked, eligible storage+transport combination | Matching & Recommendations | Supporting (transient) |
| 14 | `bookings` | Parent record representing a committed request | Bookings | Transactional |
| 15 | `storage_bookings` | Storage-side detail of a booking | Bookings | Transactional |
| 16 | `transportation_bookings` | Transport-side detail of a booking | Bookings | Transactional |
| 17 | `booking_status_history` | Full audit trail of status transitions for bookings/sub-bookings | Bookings | Historical |
| 18 | `notifications` | Persisted user-facing notifications | Notifications | Supporting |
| 19 | `reviews` | Farmer rating/review of a provider, tied to a specific storage or transport booking | Reviews | Transactional |
| 20 | `admin_action_logs` | Audit trail of administrative actions | Administration | Historical |

## 4. Entity Relationship Analysis

**1:1 relationships**

- `users` ↔ `farmer_profiles` — a user with role `farmer` has exactly one farmer profile; keeps authentication data separate from farmer-specific data.
- `users` ↔ `provider_profiles` — same pattern for providers; this is the mechanism that lets one provider own both storage and transport without duplicate accounts.
- `bookings` ↔ `storage_bookings` — a booking has at most one storage detail row (present only when the booking includes storage).
- `bookings` ↔ `transportation_bookings` — a booking has at most one transportation detail row (present only when the booking includes transport).
- `storage_bookings` ↔ `storage_capacity_allocations` — every confirmed storage booking has exactly one capacity allocation record.
- `transportation_bookings` ↔ `vehicle_availability_blocks` — every confirmed transportation booking has exactly one vehicle availability block.

**1:N relationships**

- `provider_profiles` → `storage_facilities` (a provider can own many facilities)
- `provider_profiles` → `vehicles` (a provider can own many vehicles)
- `provider_profiles` → `provider_service_areas`
- `storage_facilities` → `facility_crop_configs`
- `vehicles` → `vehicle_availability_blocks`
- `farmer_profiles` → `farm_locations`
- `farmer_profiles` → `service_requests`
- `farm_locations` → `service_requests`
- `crops` → `service_requests`
- `service_requests` → `service_recommendations`
- `service_requests` → `bookings` (normally one, but modeled as 1:N to allow a cancelled/rejected booking to be re-attempted from the same request)
- `facility_crop_configs` → `storage_bookings`
- `vehicles` → `transportation_bookings`
- `users` → `notifications`
- `users` (admin) → `admin_action_logs`
- `farmer_profiles` → `reviews`, `provider_profiles` → `reviews`

**M:N relationships**

- `storage_facilities` ↔ `crops`, resolved through `facility_crop_configs`, which is the correct associative entity because the relationship itself carries attributes (max capacity for that crop, price, availability) that cannot live on either parent table.
- Conceptually, `service_requests` ↔ (`storage_facilities`, `vehicles`) is many-to-many at the matching stage — one request can match many facilities/vehicles, and one facility/vehicle can match many requests. This is resolved through `service_recommendations`, which also carries relationship-specific attributes (cost, distance, rank).

**Business rules encoded structurally**

- A provider is one row in `provider_profiles`; `storage_facilities.provider_id` and `vehicles.provider_id` both point to it, so offering "storage only", "transport only", or "both" is simply a matter of which child rows exist — no schema branching needed.
- A `service_requests.service_type` enum (`storage_only` / `transportation_only` / `both`) drives which child tables (`storage_bookings` / `transportation_bookings`) get populated once a booking is made, avoiding three separate request/booking systems.
- Capacity and vehicle-time conflicts are enforced through date/time-ranged rows in `storage_capacity_allocations` and `vehicle_availability_blocks` rather than a single mutable counter, which is the only correct way to support overlapping-period checks.
- Historical pricing correctness is guaranteed because `storage_bookings` and `transportation_bookings` store pricing **snapshots**, independent of whatever `facility_crop_configs`/`vehicles` say today.

## 5. ER Diagram

```mermaid
erDiagram
    users {
        uuid id PK
        string email UK
        string phone UK
        string role
        string status
    }
    farmer_profiles {
        uuid user_id PK FK
        string default_farm_address
    }
    provider_profiles {
        uuid user_id PK FK
        string business_name
        string provider_status
        decimal average_rating
    }
    crops {
        uuid id PK
        string name UK
        string status
    }
    storage_facilities {
        uuid id PK
        uuid provider_id FK
        string name
        decimal total_capacity
        string status
    }
    facility_crop_configs {
        uuid id PK
        uuid facility_id FK
        uuid crop_id FK
        decimal max_capacity_for_crop
        decimal price_per_unit_per_day
        boolean is_available
    }
    storage_capacity_allocations {
        uuid id PK
        uuid facility_crop_config_id FK
        uuid storage_booking_id FK
        decimal quantity
        date start_date
        date end_date
        string status
    }
    vehicles {
        uuid id PK
        uuid provider_id FK
        string vehicle_type
        string registration_number UK
        decimal capacity
        decimal base_charge
        decimal cost_per_km
        string status
    }
    provider_service_areas {
        uuid id PK
        uuid provider_id FK
        string region_name
        decimal radius_km
    }
    vehicle_availability_blocks {
        uuid id PK
        uuid vehicle_id FK
        uuid transportation_booking_id FK
        timestamp start_datetime
        timestamp end_datetime
        string status
    }
    farm_locations {
        uuid id PK
        uuid farmer_id FK
        string address
        decimal latitude
        decimal longitude
    }
    service_requests {
        uuid id PK
        uuid farmer_id FK
        uuid crop_id FK
        uuid farm_location_id FK
        decimal quantity
        string service_type
        date storage_start_date
        date storage_end_date
        boolean needs_transportation
        string status
    }
    service_recommendations {
        uuid id PK
        uuid service_request_id FK
        uuid facility_id FK
        uuid vehicle_id FK
        decimal total_cost
        decimal distance_km
        int rank_position
        string status
    }
    bookings {
        uuid id PK
        uuid service_request_id FK
        uuid farmer_id FK
        uuid recommendation_id FK
        string booking_type
        string overall_status
        decimal total_cost
    }
    storage_bookings {
        uuid id PK
        uuid booking_id FK
        uuid facility_crop_config_id FK
        decimal quantity
        date start_date
        date end_date
        decimal price_per_unit_snapshot
        decimal total_storage_cost
        string status
    }
    transportation_bookings {
        uuid id PK
        uuid booking_id FK
        uuid vehicle_id FK
        decimal distance_km
        decimal base_charge_snapshot
        decimal cost_per_km_snapshot
        decimal total_transport_cost
        string status
    }
    booking_status_history {
        uuid id PK
        string entity_type
        uuid entity_id
        string previous_status
        string new_status
        uuid changed_by FK
        timestamp changed_at
    }
    notifications {
        uuid id PK
        uuid recipient_user_id FK
        string notification_type
        boolean is_read
        timestamp created_at
    }
    reviews {
        uuid id PK
        uuid farmer_id FK
        uuid provider_id FK
        uuid storage_booking_id FK
        uuid transportation_booking_id FK
        smallint rating
    }
    admin_action_logs {
        uuid id PK
        uuid admin_user_id FK
        string action_type
        string target_entity_type
        uuid target_entity_id
    }

    users ||--o| farmer_profiles : "extends"
    users ||--o| provider_profiles : "extends"
    provider_profiles ||--o{ storage_facilities : owns
    provider_profiles ||--o{ vehicles : owns
    provider_profiles ||--o{ provider_service_areas : defines
    storage_facilities ||--o{ facility_crop_configs : supports
    crops ||--o{ facility_crop_configs : "offered via"
    facility_crop_configs ||--o{ storage_capacity_allocations : "capacity tracked by"
    vehicles ||--o{ vehicle_availability_blocks : has
    farmer_profiles ||--o{ farm_locations : owns
    farmer_profiles ||--o{ service_requests : creates
    crops ||--o{ service_requests : "requested for"
    farm_locations ||--o{ service_requests : "originates from"
    service_requests ||--o{ service_recommendations : generates
    storage_facilities ||--o{ service_recommendations : "candidate in"
    vehicles ||--o{ service_recommendations : "candidate in"
    service_requests ||--o{ bookings : "converted to"
    service_recommendations ||--o| bookings : "selected as"
    farmer_profiles ||--o{ bookings : places
    bookings ||--o| storage_bookings : includes
    bookings ||--o| transportation_bookings : includes
    facility_crop_configs ||--o{ storage_bookings : "booked under"
    storage_bookings ||--|| storage_capacity_allocations : allocates
    vehicles ||--o{ transportation_bookings : "assigned to"
    transportation_bookings ||--o| vehicle_availability_blocks : blocks
    users ||--o{ booking_status_history : "records (changed_by)"
    users ||--o{ notifications : receives
    farmer_profiles ||--o{ reviews : writes
    provider_profiles ||--o{ reviews : receives
    storage_bookings ||--o| reviews : "reviewed by"
    transportation_bookings ||--o| reviews : "reviewed by"
    users ||--o{ admin_action_logs : performs
```

*Note: `booking_status_history.entity_id` references `bookings`, `storage_bookings`, or `transportation_bookings` polymorphically depending on `entity_type`, and so is not drawn as a single fixed-target FK line in the diagram above (see Section 6 and Section 13 for details on this design choice).*

## 6. Detailed Table Design

### Table: `users`
**Purpose:** Master identity and authentication record for every person on the platform (farmer, provider, or admin).

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique user identifier |
| full_name | VARCHAR(150) | | No | Display name |
| email | VARCHAR(150) | UK | No | Login email |
| phone | VARCHAR(20) | UK | No | Login/contact phone number |
| password_hash | VARCHAR(255) | | No | Hashed credential |
| role | ENUM(`farmer`,`provider`,`admin`) | | No | Determines which profile table extends this row |
| status | ENUM(`active`,`suspended`,`deactivated`) | | No | Account status, default `active` |
| created_at | TIMESTAMP | | No | Registration time |
| updated_at | TIMESTAMP | | No | Last profile update |
| last_login_at | TIMESTAMP | | Yes | Last successful login |

### Table: `farmer_profiles`
**Purpose:** Extends `users` with farmer-specific data. One row per farmer.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| user_id | UUID | PK, FK → users.id | No | Shared primary key (1:1 with users) |
| default_farm_address | VARCHAR(255) | | Yes | Optional default address, convenience only |
| default_latitude | DECIMAL(9,6) | | Yes | Optional default coordinate |
| default_longitude | DECIMAL(9,6) | | Yes | Optional default coordinate |
| national_id | VARCHAR(50) | UK | Yes | Optional verification identifier |
| created_at | TIMESTAMP | | No | Profile creation time |

### Table: `provider_profiles`
**Purpose:** Extends `users` with provider/business data. A single account regardless of whether the provider offers storage, transportation, or both.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| user_id | UUID | PK, FK → users.id | No | Shared primary key (1:1 with users) |
| business_name | VARCHAR(150) | | No | Registered/trading name |
| slug | VARCHAR(150) | | No | Unique slug for URL, generated from business_name |
| business_registration_no | VARCHAR(100) | UK | Yes | Optional official registration number |
| business_address | VARCHAR(255) | | Yes | Registered business address |
| contact_person | VARCHAR(150) | | Yes | Primary contact name |
| provider_status | ENUM(`pending_verification`,`verified`,`suspended`) | | No | Verification/moderation state |
| average_rating | DECIMAL(3,2) | | Yes | Cached average of `reviews.rating`; denormalized for fast display, recalculated on new review |
| total_reviews | INT | | No | Cached count of reviews, default 0 |
| created_at | TIMESTAMP | | No | Registration time |
| updated_at | TIMESTAMP | | No | Last update |

### Table: `crops`
**Purpose:** Master catalog of crop types, allowing new crops to be added without schema changes.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique crop identifier |
| name | VARCHAR(100) | UK | No | Crop name, e.g. "Potato" |
| category | VARCHAR(100) | | Yes | Optional grouping, e.g. "Vegetable", "Grain" |
| description | TEXT | | Yes | Optional description |
| status | ENUM(`active`,`inactive`) | | No | Whether selectable in new requests |
| created_at | TIMESTAMP | | No | Creation time |

### Table: `storage_facilities`
**Purpose:** A cold-storage facility owned by a provider.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique facility identifier |
| provider_id | UUID | FK → provider_profiles.user_id | No | Owning provider |
| name | VARCHAR(150) | | No | Facility name |
| description | TEXT | | Yes | Facility details |
| address | VARCHAR(255) | | No | Physical address |
| latitude | DECIMAL(9,6) | | No | Geographic coordinate, used for route/distance calculation |
| longitude | DECIMAL(9,6) | | No | Geographic coordinate |
| total_capacity | DECIMAL(10,2) | | No | Total facility capacity across all crops |
| capacity_unit | VARCHAR(20) | | No | Unit of measure, default "ton" |
| status | ENUM(`active`,`inactive`,`maintenance`) | | No | Operating status |
| created_at | TIMESTAMP | | No | Creation time |
| updated_at | TIMESTAMP | | No | Last update |

### Table: `facility_crop_configs`
**Purpose:** Associative entity resolving the many-to-many relationship between facilities and crops, carrying crop-specific capacity/pricing/availability. This replaces any comma-separated or JSON crop list.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique configuration identifier |
| facility_id | UUID | FK → storage_facilities.id | No | Facility supporting this crop |
| crop_id | UUID | FK → crops.id | No | Crop supported |
| max_capacity_for_crop | DECIMAL(10,2) | | No | Maximum capacity this facility will allocate to this crop |
| price_per_unit_per_day | DECIMAL(10,2) | | No | Current storage price for this crop at this facility |
| is_available | BOOLEAN | | No | Provider-controlled toggle, independent of date-based booking availability |
| created_at | TIMESTAMP | | No | Creation time |
| updated_at | TIMESTAMP | | No | Last update |
| *(unique)* | facility_id + crop_id | UK | | A facility has at most one configuration per crop |

### Table: `storage_capacity_allocations`
**Purpose:** Represents actual date-ranged consumption of a facility's crop-specific capacity. This is the mechanism that makes capacity date-dependent and prevents overbooking — capacity is never a single mutable number, it is derived by summing overlapping allocation rows.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique allocation identifier |
| facility_crop_config_id | UUID | FK → facility_crop_configs.id | No | Which facility/crop configuration this allocation draws from |
| storage_booking_id | UUID | FK → storage_bookings.id, UK | No | The storage booking this allocation belongs to (1:1) |
| quantity | DECIMAL(10,2) | | No | Quantity allocated |
| start_date | DATE | | No | Allocation start date |
| end_date | DATE | | No | Allocation end date |
| status | ENUM(`reserved`,`occupied`,`released`,`cancelled`) | | No | Lifecycle state, see Section 8 |
| created_at | TIMESTAMP | | No | Creation time |
| updated_at | TIMESTAMP | | No | Last status change |

### Table: `vehicles`
**Purpose:** A transport vehicle owned by a provider.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique vehicle identifier |
| provider_id | UUID | FK → provider_profiles.user_id | No | Owning provider |
| vehicle_type | ENUM(`open_truck`,`covered_van`,`refrigerated_truck`,`pickup`,`other`) | | No | Vehicle category |
| registration_number | VARCHAR(50) | UK | No | Government registration number |
| capacity | DECIMAL(10,2) | | No | Load capacity |
| capacity_unit | VARCHAR(20) | | No | Unit of measure, default "ton" |
| base_charge | DECIMAL(10,2) | | No | Current flat charge per trip |
| cost_per_km | DECIMAL(10,2) | | No | Current per-kilometer rate |
| status | ENUM(`available`,`unavailable`,`maintenance`) | | No | Current operating status |
| created_at | TIMESTAMP | | No | Creation time |
| updated_at | TIMESTAMP | | No | Last update |

### Table: `provider_service_areas`
**Purpose:** Geographic areas a provider is willing to serve, used to filter vehicles during matching.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique area identifier |
| provider_id | UUID | FK → provider_profiles.user_id | No | Owning provider |
| region_name | VARCHAR(150) | | No | Human-readable area name (e.g. district) |
| center_latitude | DECIMAL(9,6) | | No | Center point of the service area |
| center_longitude | DECIMAL(9,6) | | No | Center point of the service area |
| radius_km | DECIMAL(6,2) | | No | Radius defining the served area |
| created_at | TIMESTAMP | | No | Creation time |

### Table: `vehicle_availability_blocks`
**Purpose:** Represents actual time-ranged commitment of a vehicle (booked or manually blocked), preventing conflicting assignments.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique block identifier |
| vehicle_id | UUID | FK → vehicles.id | No | Vehicle being blocked |
| transportation_booking_id | UUID | FK → transportation_bookings.id, UK | Yes | Related booking; null for manual/maintenance blocks |
| start_datetime | TIMESTAMP | | No | Block start |
| end_datetime | TIMESTAMP | | No | Block end |
| status | ENUM(`reserved`,`active`,`completed`,`cancelled`,`maintenance`) | | No | Lifecycle/reason state |
| created_at | TIMESTAMP | | No | Creation time |
| updated_at | TIMESTAMP | | No | Last update |

### Table: `farm_locations`
**Purpose:** Reusable named farm/plot locations belonging to a farmer, referenced by service requests instead of re-entering coordinates each time.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique location identifier |
| farmer_id | UUID | FK → farmer_profiles.user_id | No | Owning farmer |
| label | VARCHAR(100) | | Yes | Optional label, e.g. "North Plot" |
| address | VARCHAR(255) | | No | Address text |
| latitude | DECIMAL(9,6) | | No | Coordinate used for distance/route calculation |
| longitude | DECIMAL(9,6) | | No | Coordinate |
| created_at | TIMESTAMP | | No | Creation time |

### Table: `service_requests`
**Purpose:** The single, unified entry point for a farmer's requirement — storage only, transportation only, or both. Distinct from both recommendations and bookings.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique request identifier |
| farmer_id | UUID | FK → farmer_profiles.user_id | No | Requesting farmer |
| crop_id | UUID | FK → crops.id | No | Crop involved |
| quantity | DECIMAL(10,2) | | No | Quantity to store/transport |
| quantity_unit | VARCHAR(20) | | No | Unit of measure, default "ton" |
| farm_location_id | UUID | FK → farm_locations.id | No | Origin location |
| service_type | ENUM(`storage_only`,`transportation_only`,`both`) | | No | Drives downstream matching and booking structure |
| storage_start_date | DATE | | Yes | Required when storage is involved |
| storage_end_date | DATE | | Yes | Required when storage is involved |
| needs_transportation | BOOLEAN | | No | Explicit "own transport vs. needs transport" flag |
| destination_address | VARCHAR(255) | | Yes | Used when transportation is needed and destination isn't a matched facility |
| destination_latitude | DECIMAL(9,6) | | Yes | Optional explicit destination coordinate |
| destination_longitude | DECIMAL(9,6) | | Yes | Optional explicit destination coordinate |
| status | ENUM(`open`,`matched`,`booked`,`cancelled`,`expired`) | | No | Request lifecycle state |
| created_at | TIMESTAMP | | No | Creation time |
| updated_at | TIMESTAMP | | No | Last update |

### Table: `service_recommendations`
**Purpose:** A persisted, ranked, eligible combination of facility and/or vehicle for a request, along with the cost/distance figures calculated for it at generation time. See Section 11 for the rationale on persisting rather than purely calculating on demand.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique recommendation identifier |
| service_request_id | UUID | FK → service_requests.id | No | Request this recommendation answers |
| facility_id | UUID | FK → storage_facilities.id | Yes | Candidate facility (null if transport-only) |
| vehicle_id | UUID | FK → vehicles.id | Yes | Candidate vehicle (null if storage-only) |
| storage_cost | DECIMAL(10,2) | | Yes | Calculated storage cost component |
| transportation_cost | DECIMAL(10,2) | | Yes | Calculated transportation cost component |
| total_cost | DECIMAL(10,2) | | No | Combined calculated cost |
| distance_km | DECIMAL(7,2) | | Yes | Calculated route distance |
| provider_rating_snapshot | DECIMAL(3,2) | | Yes | Provider rating at the time of ranking |
| rank_position | INT | | No | Position in the ranked list shown to the farmer |
| generated_at | TIMESTAMP | | No | When this recommendation was calculated |
| expires_at | TIMESTAMP | | No | Validity window, after which it must be recalculated |
| status | ENUM(`active`,`expired`,`booked`) | | No | Whether still valid, expired, or converted into a booking |

### Table: `bookings`
**Purpose:** Parent record representing a farmer's commitment to one or more matched services. Holds the overall status and cost; storage/transport specifics live in child tables.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique booking identifier |
| service_request_id | UUID | FK → service_requests.id | No | Originating request |
| farmer_id | UUID | FK → farmer_profiles.user_id | No | Booking farmer (denormalized from request for direct querying) |
| recommendation_id | UUID | FK → service_recommendations.id | Yes | Recommendation this booking was created from, if any |
| booking_type | ENUM(`storage_only`,`transportation_only`,`both`) | | No | Determines which child tables are populated |
| overall_status | ENUM(`requested`,`approved`,`rejected`,`confirmed`,`active`,`completed`,`cancelled`) | | No | Aggregate booking status |
| total_cost | DECIMAL(10,2) | | No | Sum of child booking costs, snapshotted at booking time |
| created_at | TIMESTAMP | | No | Request time |
| updated_at | TIMESTAMP | | No | Last status change |
| cancelled_at | TIMESTAMP | | Yes | Cancellation time, if applicable |
| cancellation_reason | VARCHAR(255) | | Yes | Free-text reason, if applicable |

### Table: `storage_bookings`
**Purpose:** Storage-side detail of a booking. Present only when `bookings.booking_type` is `storage_only` or `both`.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique storage booking identifier |
| booking_id | UUID | FK → bookings.id, UK | No | Parent booking (1:1) |
| facility_crop_config_id | UUID | FK → facility_crop_configs.id | No | Facility/crop configuration booked |
| quantity | DECIMAL(10,2) | | No | Quantity booked |
| start_date | DATE | | No | Storage start date |
| end_date | DATE | | No | Storage end date |
| price_per_unit_snapshot | DECIMAL(10,2) | | No | Price at time of booking, independent of later provider price changes |
| total_storage_cost | DECIMAL(10,2) | | No | Calculated cost for the storage period |
| status | ENUM(`pending`,`approved`,`rejected`,`active`,`completed`,`cancelled`) | | No | Storage-side lifecycle, independently trackable from transport side |
| created_at | TIMESTAMP | | No | Creation time |
| updated_at | TIMESTAMP | | No | Last update |

### Table: `transportation_bookings`
**Purpose:** Transport-side detail of a booking. Present only when `bookings.booking_type` is `transportation_only` or `both`.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique transportation booking identifier |
| booking_id | UUID | FK → bookings.id, UK | No | Parent booking (1:1) |
| vehicle_id | UUID | FK → vehicles.id | No | Assigned vehicle |
| pickup_address | VARCHAR(255) | | No | Snapshot of pickup location text |
| pickup_latitude | DECIMAL(9,6) | | No | Snapshot pickup coordinate |
| pickup_longitude | DECIMAL(9,6) | | No | Snapshot pickup coordinate |
| dropoff_address | VARCHAR(255) | | No | Snapshot of drop-off location text |
| dropoff_latitude | DECIMAL(9,6) | | No | Snapshot drop-off coordinate |
| dropoff_longitude | DECIMAL(9,6) | | No | Snapshot drop-off coordinate |
| distance_km | DECIMAL(7,2) | | No | Route distance used for costing (from routing component) |
| scheduled_datetime | TIMESTAMP | | No | Planned pickup time |
| base_charge_snapshot | DECIMAL(10,2) | | No | Vehicle base charge at time of booking |
| cost_per_km_snapshot | DECIMAL(10,2) | | No | Vehicle per-km rate at time of booking |
| total_transport_cost | DECIMAL(10,2) | | No | Calculated total transport cost |
| status | ENUM(`pending`,`approved`,`rejected`,`active`,`completed`,`cancelled`) | | No | Transport-side lifecycle, independently trackable from storage side |
| created_at | TIMESTAMP | | No | Creation time |
| updated_at | TIMESTAMP | | No | Last update |

### Table: `booking_status_history`
**Purpose:** Full audit trail of status changes across the booking hierarchy. Uses a polymorphic reference (`entity_type` + `entity_id`) so one history table can log transitions for the parent booking and either child, instead of three near-identical history tables. This is an intentional simplification — see Section 15.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique history entry identifier |
| entity_type | ENUM(`booking`,`storage_booking`,`transportation_booking`) | | No | Which table `entity_id` refers to |
| entity_id | UUID | | No | ID of the booking/storage_booking/transportation_booking row (not FK-enforced due to polymorphism) |
| previous_status | VARCHAR(30) | | Yes | Status before the change (null for the initial "requested" entry) |
| new_status | VARCHAR(30) | | No | Status after the change |
| changed_by | UUID | FK → users.id | Yes | User who triggered the change; null for system-triggered transitions |
| reason | VARCHAR(255) | | Yes | Optional free-text reason/note |
| changed_at | TIMESTAMP | | No | When the change occurred |

### Table: `notifications`
**Purpose:** Persisted record of user-facing notifications, delivered in real time via Socket.IO but retained here for history and read/unread tracking.

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique notification identifier |
| recipient_user_id | UUID | FK → users.id | No | Who the notification is for |
| notification_type | VARCHAR(50) | | No | e.g. "booking_requested", "booking_approved" |
| title | VARCHAR(150) | | No | Short title |
| message | TEXT | | No | Full message body |
| related_entity_type | VARCHAR(50) | | Yes | e.g. "booking", "service_request" |
| related_entity_id | UUID | | Yes | ID of the related entity, for deep-linking |
| is_read | BOOLEAN | | No | Read/unread flag, default false |
| created_at | TIMESTAMP | | No | Creation time |
| read_at | TIMESTAMP | | Yes | When marked read |

### Table: `reviews`
**Purpose:** Farmer rating/review of a provider, tied to a specific completed storage or transportation booking (not the parent booking, so a combined booking involving two different providers can be reviewed separately for each).

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique review identifier |
| farmer_id | UUID | FK → farmer_profiles.user_id | No | Reviewing farmer |
| provider_id | UUID | FK → provider_profiles.user_id | No | Reviewed provider |
| storage_booking_id | UUID | FK → storage_bookings.id, UK | Yes | Set when reviewing the storage side |
| transportation_booking_id | UUID | FK → transportation_bookings.id, UK | Yes | Set when reviewing the transport side |
| rating | SMALLINT | | No | 1–5, constrained at the application/DB check-constraint level |
| review_text | TEXT | | Yes | Optional written review |
| created_at | TIMESTAMP | | No | Creation time |
| *(constraint)* | exactly one of storage_booking_id / transportation_booking_id set | CK | | Enforces "one review per completed booking side"; combined with the UK on each column, prevents duplicate reviews of the same booking |

### Table: `admin_action_logs`
**Purpose:** Audit trail of administrative actions across the platform, for accountability. Not a statistics table — statistics are derived from operational data directly (see Section 21/11 principles).

| Column | Data Type | Key | Nullable | Description |
|---|---|---|---|---|
| id | UUID | PK | No | Unique log entry identifier |
| admin_user_id | UUID | FK → users.id | No | Admin who performed the action |
| action_type | VARCHAR(50) | | No | e.g. "suspend_user", "verify_provider" |
| target_entity_type | VARCHAR(50) | | No | e.g. "user", "storage_facility", "booking" |
| target_entity_id | UUID | | No | ID of the affected row |
| description | VARCHAR(255) | | Yes | Optional free-text detail |
| created_at | TIMESTAMP | | No | Action time |

## 7. Core Business Relationships

**User → Provider.** `users` and `provider_profiles` share a primary key (`provider_profiles.user_id` = `users.id`). This is what allows one account to be "the provider" for both storage and transport — there's no separate `storage_provider`/`transport_provider` distinction anywhere in the schema.

**Provider → Facilities / Provider → Vehicles.** Both `storage_facilities.provider_id` and `vehicles.provider_id` point at the same `provider_profiles.user_id`. A provider's total service offering is simply the union of its facility and vehicle rows — offering "both" requires no special flag, it's just having rows in both child tables.

**Facility → Supported Crops.** Resolved through `facility_crop_configs`, which is the correct associative table because the relationship carries its own attributes (max capacity for that crop, price, availability) rather than being a bare linking row.

**Farmer → Service Requests.** One farmer can raise many requests over time (`farmer_profiles` 1:N `service_requests`), each independent and self-contained.

**Service Request → Recommendations.** One request can produce many ranked recommendation rows (`service_requests` 1:N `service_recommendations`); this is the matching engine's output, kept structurally distinct from the request itself.

**Service Request → Booking.** A request converts into a booking when the farmer commits to a recommendation. The `bookings.recommendation_id` link preserves which specific ranked option was chosen, while `bookings.service_request_id` preserves the original ask — both are kept so partial/failed attempts (e.g. a rejected booking, followed by trying a different recommendation from the same request) are traceable.

**Booking → Storage / Booking → Transportation.** `bookings` is the parent; `storage_bookings` and `transportation_bookings` are optional 1:1 children, present according to `bookings.booking_type`. This avoids duplicating farmer/request/status-summary information across two booking "kinds," and naturally supports the case where the storage provider and transport provider are different businesses with independently trackable statuses.

**Facility → Capacity.** A facility's real-time capacity is never stored as a single number on `storage_facilities`; it's derived by combining `facility_crop_configs.max_capacity_for_crop` (the ceiling) with the sum of overlapping `storage_capacity_allocations` rows (the consumption) for a requested date range.

**Vehicle → Transportation Booking.** `vehicles` 1:N `transportation_bookings`, with each confirmed booking producing a `vehicle_availability_blocks` row that prevents a second booking from being confirmed over an overlapping time window.

**Booking → Status History.** Every status transition on `bookings`, `storage_bookings`, or `transportation_bookings` is expected to append a row to `booking_status_history`, giving a full "Requested → Approved → Confirmed → Active → Completed" (or rejected/cancelled) trail per entity.

**Booking → Review.** A review attaches to a specific `storage_bookings` or `transportation_bookings` row (not the parent `bookings` row), so a combined booking spanning two providers can receive two independent reviews, one per provider/service.

**User → Notifications.** Any user (farmer, provider, or admin) can be a `notifications.recipient_user_id`, keeping notification delivery role-agnostic.

## 8. Capacity & Availability Architecture

Capacity is modeled as **allocation records with date ranges**, not as a single mutable "available capacity" field, for one core reason: availability in ColdLink is inherently date-dependent (Section 14's example — 5 tons booked Jun 1–10, 4 tons booked Jun 5–15 — cannot be represented correctly by a single running counter, since the "available capacity on June 7" and "available capacity on June 20" are different numbers).

- **Total capacity** — stored as source/master data: `storage_facilities.total_capacity` (facility-wide ceiling) and `facility_crop_configs.max_capacity_for_crop` (per-crop ceiling within that facility).
- **Available capacity for a date range** — calculated dynamically as `max_capacity_for_crop` minus the sum of `storage_capacity_allocations.quantity` for rows on that `facility_crop_config_id` whose `[start_date, end_date]` overlaps the requested range and whose `status` is `reserved` or `occupied`. This is never stored directly, since it would need to be recomputed per query anyway.
- **Reserved capacity** — a `storage_capacity_allocations` row with `status = reserved`, created the moment a booking is requested (before provider approval), so two farmers cannot simultaneously overbook the same window while a request is pending.
- **Occupied capacity** — the same row's `status` is updated to `occupied` once the storage period actually begins.
- **Capacity release** — on completion, cancellation, or rejection, the row's `status` is updated to `released` or `cancelled`; it is never deleted, so it remains as capacity history.
- **Capacity history** — is simply the full set of `storage_capacity_allocations` rows over time; no separate history table is needed because allocation rows are never overwritten in place, only status-transitioned.
- **Overbooking prevention** — enforced by requiring the sum of overlapping `reserved`/`occupied` allocations plus the new request's quantity to stay within `max_capacity_for_crop` before a new allocation row can be created (an application-level check backed by this date-ranged structure; a partial/exclusion constraint can additionally be applied in PostgreSQL to enforce this at the database level).

The same pattern applies to vehicles via `vehicle_availability_blocks`, using `start_datetime`/`end_datetime` instead of dates, since vehicle scheduling is time-of-day sensitive rather than just date-sensitive.

## 9. Booking Architecture

`bookings` is the single parent for any commitment a farmer makes, holding `booking_type`, `overall_status`, and `total_cost`. Depending on `booking_type`:

- **Storage only** — one `storage_bookings` row exists; `transportation_bookings` is absent.
- **Transportation only** — one `transportation_bookings` row exists; `storage_bookings` is absent.
- **Storage + Transportation** — both child rows exist, each referencing the same `bookings.id`, but otherwise fully independent: each has its own `status`, its own provider (via `facility_crop_config_id` → facility → provider, and `vehicle_id` → provider, respectively), and its own capacity mechanism (`storage_capacity_allocations` vs. `vehicle_availability_blocks`).

This means a combined booking correctly supports two different providers approving/rejecting their half independently (e.g. the storage provider approves while the transport provider is still pending), while `bookings.overall_status` reflects the aggregate (e.g. only moves to `confirmed` once all applicable child statuses are `approved`). No booking information is duplicated between the storage and transport sides — quantity, dates, and pricing are stored once each, on the relevant child table only.

## 10. Pricing Architecture

- **Storage pricing (current)** — lives on `facility_crop_configs.price_per_unit_per_day`, scoped per facility *and* per crop (since the same facility may price different crops differently).
- **Transportation pricing (current)** — lives on `vehicles.base_charge` and `vehicles.cost_per_km`.
- **Crop-specific pricing** — inherently supported because pricing sits on the facility↔crop associative table rather than a flat facility-level field.
- **Historical booking pricing** — `storage_bookings.price_per_unit_snapshot`/`total_storage_cost` and `transportation_bookings.base_charge_snapshot`/`cost_per_km_snapshot`/`total_transport_cost` are copied at booking time and never recalculated from current provider pricing afterward. If a provider later changes `facility_crop_configs.price_per_unit_per_day` or `vehicles.cost_per_km`, existing bookings are structurally unaffected — the snapshot columns are the source of truth for what was actually charged.

This gives a clean separation between "what a provider currently charges" (current, mutable, master data) and "what a farmer was actually charged" (historical, immutable once written).

## 11. Matching & Recommendation Data Architecture

- **Eligibility filtering / storage matching** draws from `facility_crop_configs` (crop support + pricing), `storage_facilities` (location, status), and `storage_capacity_allocations` (date-based availability, per Section 8).
- **Vehicle matching** draws from `vehicles` (capacity, status) and `provider_service_areas` (coverage), combined with `vehicle_availability_blocks` for time-based availability.
- **Route calculation and cost calculation** are performed by the application layer (Dijkstra's algorithm over OpenStreetMap/Google Maps data) and are **not** persisted as a road-network graph in the database — see Section 12.
- **Ranking** combines total cost, route distance, `provider_profiles.average_rating`, and available capacity — all either read directly from the tables above or computed on the fly.

**Persistence decision:** eligibility/matching itself is not stored — it's a filter over live data and would go stale immediately. The **result of ranking**, however, is persisted in `service_recommendations`, for two reasons: (1) it gives the farmer a stable, priced list to browse and choose from without every click re-running the matching engine, and (2) when a farmer books from a recommendation, the booking can reference the exact `service_recommendations` row (`bookings.recommendation_id`), guaranteeing that what they booked matches what they were shown, closing the gap between "recommendation shown" and "cost committed to." `service_recommendations` rows carry an `expires_at` and a `status`, since they are meant to be short-lived and periodically regenerated/purged rather than treated as durable master data — no permanent "recommendation history" is intended beyond what a resulting booking already preserves.

## 12. Geographic Data Architecture

Persisted geographic data is limited to **endpoint coordinates**, not a road network:

- `farm_locations.latitude/longitude` — farmer/farm locations.
- `storage_facilities.latitude/longitude` — facility locations.
- `provider_service_areas.center_latitude/longitude` + `radius_km` — a simple radius-based representation of a provider's coverage area, sufficient for filtering candidate vehicles without needing polygon/boundary storage.
- `transportation_bookings.pickup_*`/`dropoff_*` — a snapshot of the exact coordinates used for a specific booking's route/cost calculation, preserved for history even if the underlying facility/farm location record changes later.

**What is not persisted:** the road/street graph itself. Dijkstra's algorithm runs against data supplied at request time by OpenStreetMap/Leaflet or the Google Maps API; the database only needs to store the origin/destination points and the *result* of that calculation (`distance_km`, and implicitly duration if needed) on `service_recommendations` and `transportation_bookings`. Building and maintaining a persisted road-network database is unnecessary for ColdLink's scope and is explicitly out of scope for this schema.

## 13. Data Integrity Rules

- A `users` row's `role` determines which single profile table (`farmer_profiles` or `provider_profiles`) may reference it; a user is never both.
- `provider_profiles` is the only provider entity — `storage_facilities.provider_id` and `vehicles.provider_id` both reference it, so one provider can legitimately own facilities and vehicles simultaneously.
- `facility_crop_configs` enforces one configuration per (facility, crop) pair via a unique constraint — crop support is never represented as a delimited string or JSON array.
- `storage_capacity_allocations.quantity`, summed over overlapping-date rows with status `reserved`/`occupied` for a given `facility_crop_config_id`, must never exceed `facility_crop_configs.max_capacity_for_crop`.
- `vehicle_availability_blocks` must not contain two overlapping time ranges with status `reserved`/`active` for the same `vehicle_id`.
- `bookings.booking_type` constrains which of `storage_bookings`/`transportation_bookings` may exist for that booking.
- `reviews` enforces exactly one of `storage_booking_id`/`transportation_booking_id` set (check constraint), and a unique constraint on each column individually prevents more than one review per booking side. Application logic additionally restricts review creation to bookings whose relevant child status is `completed`.
- Pricing snapshot columns on `storage_bookings`/`transportation_bookings` are set once at booking creation and are not updated when the corresponding current-price columns on `facility_crop_configs`/`vehicles` change later.
- `booking_status_history.entity_type` + `entity_id` must resolve to an existing row in the corresponding table; this is enforced at the application layer rather than a database foreign key, since PostgreSQL foreign keys cannot target one of several tables conditionally (a deliberate, documented trade-off — see Section 15).
- `service_recommendations.status` transitions to `booked` (and is no longer offered) once referenced by a `bookings.recommendation_id`.

## 14. Final Table Summary

| # | Table | Main Responsibility | Key Relationships |
|---|---|---|---|
| 1 | `users` | Core account/auth for all roles | → `farmer_profiles`, `provider_profiles`, `notifications`, `admin_action_logs` |
| 2 | `farmer_profiles` | Farmer-specific data | → `farm_locations`, `service_requests`, `bookings`, `reviews` |
| 3 | `provider_profiles` | Single account for storage + transport | → `storage_facilities`, `vehicles`, `provider_service_areas`, `reviews` |
| 4 | `crops` | Crop master catalog | → `facility_crop_configs`, `service_requests` |
| 5 | `storage_facilities` | A cold-storage facility | → `facility_crop_configs`, `service_recommendations` |
| 6 | `facility_crop_configs` | Facility↔crop config (capacity/price) | → `storage_capacity_allocations`, `storage_bookings` |
| 7 | `storage_capacity_allocations` | Date-ranged capacity consumption | → `storage_bookings` (1:1) |
| 8 | `vehicles` | A transport vehicle | → `vehicle_availability_blocks`, `transportation_bookings` |
| 9 | `provider_service_areas` | Provider's coverage regions | → `provider_profiles` |
| 10 | `vehicle_availability_blocks` | Time-ranged vehicle commitment | → `transportation_bookings` (1:1) |
| 11 | `farm_locations` | Reusable farm/plot locations | → `service_requests` |
| 12 | `service_requests` | Unified farmer requirement | → `service_recommendations`, `bookings` |
| 13 | `service_recommendations` | Ranked, priced eligible combinations | → `bookings` |
| 14 | `bookings` | Parent commitment record | → `storage_bookings`, `transportation_bookings`, `booking_status_history` |
| 15 | `storage_bookings` | Storage side of a booking | → `storage_capacity_allocations`, `reviews` |
| 16 | `transportation_bookings` | Transport side of a booking | → `vehicle_availability_blocks`, `reviews` |
| 17 | `booking_status_history` | Status-change audit trail | → `bookings`/`storage_bookings`/`transportation_bookings` (polymorphic), `users` |
| 18 | `notifications` | Persisted user notifications | → `users` |
| 19 | `reviews` | Provider ratings tied to bookings | → `farmer_profiles`, `provider_profiles`, `storage_bookings`, `transportation_bookings` |
| 20 | `admin_action_logs` | Admin action audit trail | → `users` |

## 15. Architecture Assessment

**Why this fits ColdLink.** The schema mirrors the platform's actual workflow rather than a generic CRUD structure: a request is not a booking, a recommendation is not a request, and capacity is a series of dated commitments rather than a single number — each of these distinctions exists because ColdLink's core value (route/cost-aware matching with real capacity constraints) depends on them being separable. The single-provider-account model and the parent/child booking structure directly satisfy the "one provider, multiple service types, possibly two providers per combined booking" requirement without special-casing.

**Why it's suitable for a 3-1 undergraduate project.** Twenty tables is enough to demonstrate real relational modeling skill — proper M:N resolution, date-ranged availability, historical pricing snapshots, polymorphic status history — without ballooning into infrastructure the project doesn't need (no persisted road graph, no per-feature dashboard tables, no duplicated provider accounts). Every table maps to a concept explicitly named in the requirements; none exist "just to look thorough."

**Room for thesis expansion.** Natural extensions that don't require restructuring the current schema: a proper `price_change_log` for full pricing audit trails (currently only booking-time snapshots are kept); multi-leg/multi-vehicle transportation bookings (currently one vehicle per transportation booking); provider service areas as real polygons instead of radius circles; a persisted `recommendation_feedback` table if the ranking algorithm is later trained/tuned on farmer choices; and richer capacity forecasting built on top of the existing `storage_capacity_allocations` history.

**Intentional simplifications/trade-offs.**
- `booking_status_history` uses a polymorphic `entity_type`/`entity_id` pair instead of three separate history tables (one per `bookings`, `storage_bookings`, `transportation_bookings`). This avoids near-duplicate tables but means the `entity_id` reference is enforced at the application layer, not by a database foreign key — a deliberate, documented trade-off rather than an oversight.
- `provider_profiles.average_rating`/`total_reviews` are denormalized caches of `reviews` data, recalculated on write, chosen over recomputing an aggregate on every read.
- `bookings.total_cost` and `farmer_id` are denormalized (derivable from child bookings and `service_requests` respectively) purely for query convenience on the most frequently accessed table.
- Service areas are modeled as a single radius per row rather than arbitrary polygons, which is sufficient for matching purposes at this project's scale.
