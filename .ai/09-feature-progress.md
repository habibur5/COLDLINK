# Feature Progress

**Current state: INF-01 and INF-02 backend foundations are complete; business modules are not implemented.**
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
| payments | Not started | #19 approved sandbox-only scope; implementation is gated on INF-01 and INF-02 completion |
| notifications | Not started | includes Socket.IO |
| reviews | Not started | optional |
| admin | Not started | v1 scope undecided |
| jobs | Not started | TTL sweep, retention pruning, async notification delivery, rating recalc (Redis + BullMQ) |
| feature-flags | Not started | flat named flags + custom roles, precedence user > provider > role > global, Redis-cached |

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
