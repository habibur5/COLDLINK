# Module Rules

A module = one coherent business capability. Module list and ownership: `01` §Modules. Layers and file template: `01`, `02`.

## Boundaries
A module owns its domain rules, contracts, persistence and HTTP handling, and must not absorb another module's responsibility. Single owners:

| Concern | Sole owner | Never |
|---|---|---|
| Capacity rules (available/reserved/occupied) | `storages`, `storage-availability` | duplicate them in `bookings` or `matching` |
| Booking lifecycle + allocation/release calls | `bookings` (calls storage capacity operations) | build a second capacity implementation |
| Sandbox payment attempt lifecycle, initiation, callback processing, and provider verification | `payments` | enable live payment operations or mutate booking/academic finance state from provider adapters |
| Provider protocol and HTTP/API details | The respective adapter under `payments/providers/` | leak provider-specific payloads or status rules into callers or other modules |
| Feasibility filtering | `matching` | move ranking into it |
| Ranking + persisted deals | `recommendations` | put eligibility rules in it |
| Routing (distance/duration) | `routes`, via its provider interface (`01` §Routing) | call a routing vendor SDK from another module |
| Cost formulas | `costs` | recompute transport cost in `matching` |
| Persisted notifications + Socket.IO delivery | `notifications` | other modules emit events, they don't deliver |
| Authentication mechanism | `auth` + middleware | re-implement it in business modules (domain-specific authorization checks are fine) |
| Resource-ownership checks | Owning module's service layer (e.g. `storages` checks facility ownership) | assume role alone is sufficient |
| Scheduled/background work (TTL sweep, retention pruning, async delivery) | `jobs` | run cleanup or delivery inline inside a request handler |
| Feature-flag evaluation | `feature-flags` | re-implement flag availability policy in another module |
| Permission catalog, role assignment, user-level ALLOW/DENY, and resolution | `authorization` | infer authority from role names or feature flags |

## Dependency direction
```text
Route → Controller → Service → Repository → Prisma Client → Prisma schema → MariaDB
```
- Each layer may depend only on the next one down.
- Business logic must not depend on frontend code.
- Persistence must not touch HTTP request/response objects.
- Routes must not run database or business workflows.
- Cross-module calls go through the owning module's service/repository boundary, never its internals.
- Dependencies must be purposeful and directional; avoid bidirectional ones and chains through internals.

## `shared/`
Only for code that is (1) not owned by one business module **and** (2) genuinely used by several. Domain logic stays in its owning module even if many modules call it. Never a dump (`misc`, `utils-everything`, business logic).

## New module
Create only if the capability has a distinct business boundary and no existing module owns it. Use project terminology, minimal dependencies, kebab-case. Never for technical convenience or to sidestep ownership.

## Extending a module
1. Identify the owning module. 2. Keep domain logic there. 3. Reuse existing operations. 4. Preserve API contracts and business rules. 5. Add cross-module calls only when the business relationship requires it. 6. Do not move logic to `shared/` for reuse. 7. Add no new library or pattern. 8. Follow the module's existing style.

## Forbidden shortcuts
Business logic in routes, controllers, repositories or `shared/`; reaching into another module's internals.

## Undecided
Formal new-module approval process; complete module dependency graph beyond the flow in `01`.


Feature grades and delivery gates: `.ai/12-development-strategy.md`. Refund, installment, ledger, commission, dispute-finance and settlement workflows are academic-grade; provider-facing external financial actions are simulations only.
