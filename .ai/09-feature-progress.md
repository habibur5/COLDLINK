# Feature Progress

**Current state: INF-01 and INF-02 backend foundations are complete; core business modules are not yet implemented.** Feature grades and Waterfall gates: `.ai/12-development-strategy.md` and `.ai/11-project-schedule.md`.
Design work done: concept/scope, three-tier architecture, module layout, stack, matching/route/cost/ranking approach, booking + capacity rules, REST API design, DB schema (`10`), project proposal, task-level schedule with dependencies and critical path (`11`).

## Status values
`Not started` · `In progress` · `Partial` · `Done` · `Blocked`

## Update rules
- Change a status **only after inspecting the real code**. Never infer progress from docs, API lists, plans or discussion.
- Move forward only: Not started → In progress → Partial → Done.
- Keep the Notes column short (what exists, what remains).

## Modules (feature scope per module: `01`, `05`, `10`)
| Module | Status | Notes |
|---|---|---|
| auth | Not started | |
| users | Not started | |
| providers | Not started | |
| crops | Not started | |
| storages | Not started | |
| storage-availability | Not started | |
| vehicles | Not started | |
| transport-options | Not started | |
| service-requests | Not started | |
| matching | Not started | |
| recommendations | Not started | |
| routes | Not started | provider-abstracted, default OSRM (`01` §Routing) |
| costs | Not started | |
| bookings | Not started | |
| payments | Not started | Production-grade sandbox-only checkout; INF-01/02 complete; no live transactions |
| installments / refunds / ledger / commission / settlements | Not started | Academic-grade persisted workflows; external operations simulated. Installment, overstay, and extension policy accepted in ADR-0010; implementation is #23. |
| notifications | Not started | includes Socket.IO |
| reviews | Not started | optional |
| admin | Not started | v1 scope undecided |
| jobs | Not started | TTL sweep, retention pruning, async notification delivery, rating recalc (Redis + BullMQ) |
| permissions / RBAC | Not started | Production-grade ADR-0003 model; replace legacy role-based design in planning docs |
| feature-flags | Not started | Availability gates distinct from permission-based authorization; exact policy per issue #10 |

## Infrastructure
| Item | Status | Notes |
|---|---|---|
| Repository scaffold, folder structure, lint/format (INF-01) | Done | Root npm tooling and ESLint/Prettier config; backend source root scaffolded |
| Backend base: Express + TypeScript + Prisma ORM 7 + MariaDB (INF-02) | Done | Express server, strict TS config, Prisma schema/client generation, and MariaDB adapter connection |
| Express API + `/api/v1` | In progress | Express app mounted at `/api/v1`; feature routes not implemented |
| Prisma ORM 7 + MariaDB setup, Prisma Client singleton and schema | Done | Prisma 7 config/schema and singleton; no domain models or migrations yet |
| Redis | Not started | jobs queue, distance cache, feature-flag cache |
| Auth middleware | Not started | |
| Ownership-check pattern | Not started | service-layer, per resource |
| Request validation | Not started | Zod |
| Logging | Not started | pino |
| Error tracking | Not started | Sentry |
| Idempotency-key handling | Not started | lookup table + middleware/service check |
| Health endpoints | Not started | |
| React frontend | Not started | |
| Map integration | Not started | provider undecided |
