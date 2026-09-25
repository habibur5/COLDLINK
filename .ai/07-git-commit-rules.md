# Git Commit Rules

Format: `type(scope): description`  e.g. `feat(users): add user registration`

**AI never creates a commit unless the user explicitly says so.** It may propose a message.

## Types (no others)
| Type | Use for | Example |
|---|---|---|
| `feat` | New capability actually implemented | `feat(bookings): add booking approval` |
| `fix` | Correcting a defect | `fix(bookings): prevent overbooking during approval` |
| `refactor` | Restructure, no behavior change | `refactor(matching): separate eligibility logic` |
| `test` | Tests only | `test(routes): add shortest-route tests` |
| `docs` | Documentation only | `docs(project): update architecture documentation` |
| `chore` | Maintenance not fitting another type | — |
| `perf` | Performance is the actual purpose | `perf(recommendations): optimize ranking calculation` |

## Scope
- Use the most specific module name from `01` §Modules (`users`, `storages`, `service-requests`, …). Do not invent scopes.
- Repo-wide docs: `project`.
- Cross-module change: split into one commit per module when practical; otherwise use the primary module. No multi-scope syntax (`a,b`).

## Message
- Concise, specific, imperative, no trailing punctuation.
- Describes what was **actually completed**, not intended or partial work.
  - Only validation done → `feat(users): add registration validation`, not "add complete registration system".
  - Only tests added → `test(users): …`, not `feat`.
- Bad: `working on registration`, `update`, `added some changes to the user module`.

## Commit boundaries
- One coherent purpose per commit (size is logical, not line count; several files are fine).
- Feature and its tests are separate commits.
- Never combine: feature + unrelated fix/refactor/docs/formatting; unrelated modules.
- Prepare a preparatory refactor as its own commit before the feature.
- Commit only when a change is complete and meaningful. Not for a few typed lines, partial work, or temporary debugging.
- `docs` commits contain no unrelated code; `test` commits are not for feature code.

## Checklist
```text
[ ] change is complete   [ ] one purpose   [ ] correct type   [ ] scope = module
[ ] description matches real change   [ ] no unrelated changes   [ ] type(scope): description
```

## Undecided
Max subject length; body and footer format; breaking-change notation; issue/PR reference syntax; commit linting tool.
