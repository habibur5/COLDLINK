# ColdLink V1 — UML Component Diagram

> **Planned modular-monolith design.** The modules and dependency boundaries below come from `.ai/01-architecture.md` and `.ai/06-module-rules.md`; they do not imply implementation status.

```mermaid
flowchart LR
    subgraph Client[Client components]
        Farmer[Farmer React UI]
        Provider[Provider React UI]
        Admin[Admin React UI\nplanned; no V1 Admin UI per ADR-0012]
    end

    subgraph Backend[Node.js + Express modular monolith]
        REST[REST API\nRouter → Controller → Service]
        WS[Socket.IO gateway]
        Middleware[Auth middleware]
        Auth[auth]
        Authorization[authorization]
        Users[users / providers]
        Catalog[crops / storages / vehicles]
        Requests[service-requests]
        Matching[matching]
        Routing[routes\nprovider interface]
        Costs[costs]
        Recommendations[recommendations]
        Bookings[bookings]
        StorageAvailability[storage-availability]
        Payments[payments\nsandbox adapters]
        Finance[installments / refunds / ledger / commission / settlements / disputes]
        Notifications[notifications]
        Reviews[reviews]
        AdminOps[admin]
        Flags[feature-flags]
        Audit[audit]
        Jobs[jobs / BullMQ workers]
        Prisma[Repositories + Prisma Client]
    end

    subgraph Data[Data and infrastructure]
        Maria[(MariaDB)]
        Redis[(Redis\nqueue + caches)]
        Providers[External sandbox payment providers]
        RouteProvider[Routing provider\nOSRM or Google Maps]
    end

    Farmer -->|REST| REST
    Provider -->|REST| REST
    Admin -.->|REST, if introduced| REST
    Farmer <-->|Socket.IO| WS
    Provider <-->|Socket.IO| WS
    Admin -.->|Socket.IO, if introduced| WS

    REST --> Middleware --> Auth
    Middleware --> Authorization
    REST --> Users
    REST --> Requests
    REST --> Recommendations
    REST --> Bookings
    REST --> Payments
    REST --> Finance
    REST --> AdminOps
    REST --> Flags

    Requests --> Matching
    Matching --> Catalog
    Matching --> StorageAvailability
    Matching --> Routing
    Matching --> Costs
    Routing --> RouteProvider
    Costs --> Recommendations
    Recommendations --> Bookings
    Bookings --> StorageAvailability
    Bookings --> Notifications
    Payments --> Providers
    Payments -. verified result only .-> Bookings
    Payments -. verified result only .-> Finance
    Finance --> Notifications
    Reviews --> Notifications
    AdminOps --> Users
    AdminOps --> Bookings
    AdminOps --> Finance
    AdminOps --> Audit
    Flags -. availability checks .-> REST
    WS --> Notifications

    Auth --> Prisma
    Authorization --> Redis
    Catalog --> Prisma
    Requests --> Prisma
    StorageAvailability --> Prisma
    Recommendations --> Prisma
    Bookings --> Prisma
    Payments --> Prisma
    Finance --> Prisma
    Users --> Prisma
    Flags --> Prisma
    Audit --> Prisma
    Jobs --> Redis
    Jobs --> Prisma
    Notifications --> Prisma
    Notifications --> Redis
    Prisma --> Maria
```

### Ownership rules represented

- `matching` decides eligibility; `recommendations` ranks and persists results; `costs` owns formulas; `routes` alone calls the routing-provider interface.
- `bookings` owns lifecycle and delegates storage-capacity changes to `storages` / `storage-availability`. The capacity check and allocation writes share one transaction.
- `payments` owns sandbox initiation/callback verification. It reports verified facts to the domain owner and does not transition bookings or finance state itself.
- `admin` checks its explicit permission and delegates to the owning domain service; it does not bypass domain rules.
- Domain services submit required events to the single `audit` boundary. `jobs` owns deferred delivery and scheduled sweeps. Notification delivery goes through `notifications`.

| Component                                                                         | Responsibility                                                                                                                      |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `auth` / `authorization`                                                          | Session and identity validation; centralized permission resolution and ownership-aware access checks.                               |
| `service-requests`                                                                | Validate and persist the farmer's crop, quantity/unit, service type, dates, and location.                                           |
| `matching`                                                                        | Eligibility filtering for crop compatibility, full quantity, availability, vehicle suitability/service area, and route feasibility. |
| `storages` / `storage-availability` / `vehicles` / `transport-options`            | Own resource configuration and resource-specific capacity/availability/suitability operations.                                      |
| `routes` / `costs`                                                                | Obtain route facts through one provider interface; calculate storage, transport, and total prices.                                  |
| `recommendations`                                                                 | Rank feasible complete alternatives and persist expiring results.                                                                   |
| `bookings`                                                                        | Booking transitions and transactional capacity reservation, allocation, and release.                                                |
| `payments`                                                                        | Sandbox-only attempt initiation, provider adapters, callback correlation, and authoritative result verification.                    |
| `installments` / `refunds` / `ledger` / `commission` / `settlements` / `disputes` | Persist academic finance workflows and simulated outcomes; no live financial movement.                                              |
| `notifications` / `jobs`                                                          | Persist and deliver notifications; run scheduled sweeps and deferred work outside request handlers.                                 |
| `admin` / `audit` / `feature-flags`                                               | Permissioned admin entry points, centralized append-only audit boundary, and separate feature-availability evaluation.              |
