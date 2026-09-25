# Feature Progress

**Current state: design complete, no application code confirmed.** Nothing is `Completed`.
Design work done: concept/scope, three-tier architecture, module layout, stack, matching/route/cost/ranking approach, booking + capacity rules, REST API design, DB schema (`10`), project proposal.

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
| routes | Not started | |
| road-network | Not started | source undecided (`00`) |
| costs | Not started | |
| bookings | Not started | |
| notifications | Not started | includes Socket.IO |
| reviews | Not started | optional |
| admin | Not started | v1 scope undecided |

## Infrastructure
| Item | Status | Notes |
|---|---|---|
| Express API + `/api/v1` | Not started | |
| MikroORM + MariaDB setup, base entity/repo | Not started | |
| Auth middleware | Not started | |
| Request validation | Not started | library undecided |
| Health endpoints | Not started | |
| React frontend | Not started | |
| Map integration | Not started | provider undecided |
