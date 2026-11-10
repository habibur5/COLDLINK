# ColdLink V1 — UML Activity Diagrams

> Mermaid activity-style flowcharts for the principal V1 flows. These describe approved/planned behavior, not implemented features. Expanded issue #15 lifecycle behavior is deferred; booking statuses remain the basic architecture/API set.

## A. Generate complete recommendations

```mermaid
flowchart TD
    Start((Farmer starts)) --> Input[Enter crop, quantity + controlled unit, service type, location and dates]
    Input --> Validate{Request valid and unit allowed for crop?}
    Validate -- No --> ValidationError[Return validation error]
    Validate -- Yes --> FindStorage{Storage requested?}
    FindStorage -- Yes --> FilterFacilities[Filter verified/active facilities with crop config and availability]
    FilterFacilities --> ConvertStorage[Convert units exactly; require each facility to cover full quantity]
    ConvertStorage --> HasStorage{Any eligible facilities?}
    HasStorage -- No --> NoMatch[Return no complete recommendations]
    HasStorage -- Yes --> NeedTransport{Transportation requested?}
    FindStorage -- No --> NeedTransport
    NeedTransport -- Yes --> FilterVehicles[Filter suitable vehicles by status, service area and availability]
    FilterVehicles --> ConvertVehicle[Require each vehicle independently covers full quantity in compatible unit]
    ConvertVehicle --> Route[Check route feasibility through routes provider]
    Route --> HasVehicle{Any feasible vehicles?}
    HasVehicle -- No --> NoMatch
    HasVehicle -- Yes --> Combine[Build complete alternatives: one facility and/or one vehicle per service type]
    NeedTransport -- No --> RouteStorage{Storage route feasible?}
    RouteStorage -- No --> NoMatch
    RouteStorage -- Yes --> Combine
    Combine --> Cost[Calculate costs]
    Cost --> Rank[Deterministically rank only feasible alternatives]
    Rank --> Persist[Persist expiring recommendations]
    Persist --> Return[Return ranked complete alternatives]
    Return --> End((Done))
    ValidationError --> End
    NoMatch --> End
```

## B. Create booking with capacity safety

```mermaid
flowchart TD
    Start((Farmer selects one complete recommendation)) --> Send[POST booking with Idempotency-Key]
    Send --> Auth{Authenticated, authorized, owns request?}
    Auth -- No --> Deny[Return authorization error]
    Auth -- Yes --> Replay{Existing idempotency result?}
    Replay -- Yes --> Stored[Return stored response]
    Replay -- No --> Begin[Begin one database transaction]
    Begin --> Lock[Lock relevant facility-crop config row when storage is requested]
    Lock --> Check[Recheck eligibility and overlapping capacity under lock]
    Check --> Enough{Capacity and vehicle availability still valid?}
    Enough -- No --> Rollback[Rollback; return 409 Conflict]
    Enough -- Yes --> Write[Create booking, requested child records and capacity allocation]
    Write --> Audit[Persist required audit event in same transaction]
    Audit --> Commit[Commit transaction and save idempotent response]
    Commit --> Notify[Queue provider notification through jobs]
    Notify --> Decision{Provider decision}
    Decision -- Reject --> Release[Cancel/release applicable reserved capacity]
    Decision -- Approve --> AllApproved{All required providers approved?}
    AllApproved -- No --> Wait[Remain pending for remaining response]
    AllApproved -- Yes --> Confirm[Confirm booking under its applicable policy]
    Confirm --> End((Done))
    Stored --> End
    Deny --> End
    Rollback --> End
    Release --> End
    Wait --> End
```

**Storage payment branch:** for storage bookings with a non-zero down payment, ADR-0010 requires the simulated payment before confirmation and schedule creation. With a zero deposit, provider approval confirms directly. Collection is simulated; the payment adapter never changes booking or finance state itself. The detailed overall booking state machine remains bounded by ADR-0014 and issue #15's deferred scope.

## C. Process a due installment (academic simulation)

```mermaid
flowchart TD
    Start((Scheduled job / authorized operator)) --> Due[Find storage installment due by schedule]
    Due --> Mark[Mark due/overdue according to due date and snapshotted grace period]
    Mark --> Collect{Authorized user starts simulated collection?}
    Collect -- No --> Remain[Keep due/overdue; no ledger collection entry]
    Collect -- Yes --> Simulate[Run deterministic academic collection workflow]
    Simulate --> Result{Simulation succeeds?}
    Result -- No --> Failed[Record failed/inconclusive attempt; installment remains unpaid]
    Result -- Yes --> Tx[Atomically record paid installment + append-only ledger entries]
    Tx --> Notify[Persist notification; enqueue asynchronous delivery]
    Remain --> End((Done))
    Failed --> End
    Notify --> End
```
