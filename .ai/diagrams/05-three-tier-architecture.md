# ColdLink V1 — Three-Tier Architecture

```mermaid
flowchart TB
    Farmer([Farmer])
    Provider([Provider])
    Admin([Administrator])

    subgraph Presentation[Presentation Tier — React + TypeScript]
        FarmerUI[Farmer marketplace and booking UI]
        ProviderUI[Provider resource and booking UI]
        AdminUI[Admin interface — planned only]
    end

    subgraph Application[Application Tier — Node.js + Express + TypeScript]
        REST[REST API]
        Socket[Socket.IO gateway]
        Business[Business logic modules\nAuth · Authorization · Requests · Matching · Recommendations · Routes · Costs · Bookings]
        Domain[Domain modules\nProviders · Storage · Vehicles · Payments · Finance · Reviews · Admin · Audit · Flags]
        DataAccess[Repositories + Prisma ORM]
        Worker[Background jobs / BullMQ workers]
        Notify[Notifications / async delivery]
    end

    subgraph Data[Data Tier]
        Maria[(MariaDB\nPersistent relational records)]
        Redis[(Redis\nBullMQ queue + caches)]
    end

    Farmer --> FarmerUI
    Provider --> ProviderUI
    Admin -.-> AdminUI

    FarmerUI -->|HTTPS REST requests / JSON| REST
    ProviderUI -->|HTTPS REST requests / JSON| REST
    AdminUI -.->|HTTPS REST requests / JSON, if built| REST
    REST --> Business
    REST --> Domain
    Business --> DataAccess
    Domain --> DataAccess
    DataAccess -->|Prisma Client queries and transactions| Maria
    Maria -->|Rows / transaction results| DataAccess
    DataAccess --> Domain
    Domain --> REST
    REST -->|JSON responses| FarmerUI
    REST -->|JSON responses| ProviderUI
    REST -.->|JSON responses, if built| AdminUI

    FarmerUI <-->|Socket.IO over secure WebSocket| Socket
    ProviderUI <-->|Socket.IO over secure WebSocket| Socket
    AdminUI <-.->|Socket.IO, if built| Socket
    Socket <--> Notify
    Domain -->|enqueue deferred work| Worker
    Worker <-->|BullMQ jobs| Redis
    Worker -->|Prisma persistence| DataAccess
    Notify -->|persist notification| DataAccess
    Notify -->|deliver asynchronously| Socket

    classDef planned stroke-dasharray: 5 5;
    class AdminUI planned;
```

## Communication and data flow

1. Farmers and providers use the React/TypeScript presentation tier. The administrator-facing UI is shown as planned: ADR-0012 specifies a backend Admin console but no V1 Admin UI.
2. The browser communicates with the Express application over REST for request/response work and Socket.IO for real-time notification delivery. The frontend never connects directly to MariaDB or Redis.
3. Express routes/controllers delegate to TypeScript business services. Those services enforce authentication/authorization and own workflow decisions such as eligibility, cost, booking, and capacity.
4. Repositories use Prisma ORM to read/write MariaDB. Multi-record booking/capacity operations use one transaction with the required capacity row lock.
5. Work that should not block the request is queued to BullMQ backed by Redis. Workers persist domain outcomes through module-owned services/repositories; notifications are persisted before asynchronous Socket.IO delivery.

> **Status:** This documents the approved target architecture. It does not claim that all tiers, modules, schemas, or workflows have been implemented.
