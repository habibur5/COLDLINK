# ColdLink V1 — UML Sequence Diagrams

> Chronological interactions for the planned application. The main sequence shows recommendation retrieval and booking creation; the second shows a sandbox attempt boundary. No diagram implies live payment or completed implementation.

## A. Recommendation request and booking creation

```mermaid
sequenceDiagram
    actor Farmer
    participant UI as React + TypeScript UI
    participant API as Express REST API
    participant Auth as Auth / Authorization
    participant Request as Service Requests
    participant Match as Matching
    participant Supply as Storage / Vehicle modules
    participant Route as Routes provider interface
    participant Cost as Costs
    participant Recs as Recommendations
    participant Booking as Bookings
    participant Prisma as Prisma Client / Repository
    participant DB as MariaDB
    participant Jobs as Jobs / BullMQ
    participant Notify as Notifications

    Farmer->>UI: Enter request and submit
    UI->>API: POST /api/v1/recommendations
    API->>Auth: Validate session, permission and party scope
    Auth-->>API: Authorized identity
    API->>Request: Validate request DTO and controlled unit
    Request->>Prisma: Read crop, location and request inputs
    Prisma->>DB: SELECT request-related records
    DB-->>Prisma: Crop, unit, location, dates
    Request->>Match: Evaluate service request
    Match->>Supply: Query resource suitability, capacity and availability
    Supply->>Prisma: Read eligible supply
    Prisma->>DB: SELECT resources/configurations/blocks
    DB-->>Prisma: Candidate resources
    Match->>Match: Convert compatible quantities exactly and require full quantity per resource
    Match->>Route: Check required route feasibility
    Route-->>Match: Feasible/infeasible and route facts
    Match->>Cost: Calculate eligible service costs
    Cost-->>Match: Costed complete candidates
    Match->>Recs: Rank and persist alternatives
    Recs->>Prisma: Insert recommendation rows
    Prisma->>DB: INSERT recommendations
    DB-->>Prisma: Persisted result
    Recs-->>API: Ranked alternatives
    API-->>UI: 200 response
    UI-->>Farmer: Display complete alternatives

    Farmer->>UI: Select one recommendation
    UI->>API: POST /api/v1/bookings + Idempotency-Key
    API->>Auth: Revalidate session, permission and ownership
    Auth-->>API: Authorized identity
    API->>Booking: Create booking
    Booking->>Prisma: Begin interactive transaction
    opt Storage component included
        Prisma->>DB: SELECT facility_crop_config FOR UPDATE
        DB-->>Prisma: Locked config row
        Prisma->>DB: Check overlapping reserved/occupied allocation capacity
        DB-->>Prisma: Current capacity result
    end
    alt Capacity/availability invalidated
        Booking->>Prisma: Roll back transaction
        API-->>UI: 409 Conflict
    else Still eligible
        Booking->>Prisma: Insert booking, children and allocation
        Prisma->>DB: INSERT booking records and capacity allocation
        Booking->>Prisma: Insert required audit event in same transaction
        Prisma->>DB: INSERT audit record
        Booking->>Prisma: Commit transaction and persist idempotent response
        Prisma->>DB: COMMIT
        Booking->>Jobs: Enqueue notification work
        Jobs->>Notify: Deliver through notification owner
        Notify-->>UI: Socket.IO event (asynchronously)
        API-->>UI: Booking response
    end
```

## B. Sandbox payment attempt and domain update boundary

```mermaid
sequenceDiagram
    actor User as Farmer / authorized operator
    participant UI as React UI
    participant API as Express REST API
    participant Payment as Payments module
    participant Adapter as bKash or SSLCommerz sandbox adapter
    participant Gateway as Sandbox provider
    participant DB as MariaDB via Prisma
    participant Owner as Owning booking / finance workflow

    User->>UI: Start an applicable one-time payment
    UI->>API: Initiate payment request
    API->>Payment: Authenticated initiation + ownership validation
    Payment->>DB: Persist attempt and merchant reference
    Payment->>Adapter: Create sandbox checkout
    Adapter->>Gateway: Sandbox initiation only
    Gateway-->>Adapter: Checkout result/reference
    Adapter-->>Payment: Provider result
    Payment->>DB: Persist attempt state/reference
    Payment-->>API: Checkout response
    API-->>UI: Checkout instructions/result
    UI->>Gateway: User completes sandbox flow
    Gateway->>Adapter: Callback / return / IPN
    Adapter->>Payment: Normalize untrusted callback
    Payment->>Gateway: Verify authoritatively using stored references
    Gateway-->>Payment: Verified payment facts
    Payment->>DB: Persist verified attempt result
    Payment-->>Owner: Return verified result without changing domain state
    Owner->>DB: Apply own allowed booking/finance transition and audit atomically
    Owner-->>API: Domain outcome
    API-->>UI: Updated domain response
```

Payment-attempt ownership and obligation associations remain subject to ADR-0006/#19. The sequence deliberately does not draw a direct PaymentAttempt-to-Booking database relationship or allow a callback to transition booking/ledger state.
