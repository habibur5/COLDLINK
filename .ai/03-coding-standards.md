# Coding Standards

Follow the architecture in `01`. Do not redesign it while implementing a feature.

## TypeScript
- Backend and frontend are TypeScript.
- Prefer explicit domain types; keep types aligned with the schema in `10`. Do not duplicate one domain concept in competing types.
- Avoid `any`. Do not use type assertions just to silence an error you do not understand.
- `interface` or `type` are both fine; pick what fits the contract.

## Naming
- Reuse project terms: `ServiceRequest`, `ColdStorage`/`StorageFacility`, `Vehicle`, `TransportOption`, `Booking`, `Recommendation`, `Provider`, `Crop`. Match the surrounding module. No unexplained abbreviations.
- Files: `<name>.<layer>.ts`. Modules: kebab-case. DB: snake_case (see `04`).
- Do not rename established concepts for personal preference.

## Code rules
- One clear responsibility per function; explicit inputs; explicit return types where they help; reuse existing operations.
- Imports: only what is needed, no duplicates, no circular dependencies.
- I/O uses `async/await`; do not mix callbacks with it.
- Comments explain non-obvious things only (business rule, Dijkstra detail, capacity consistency). Never restate code or preserve outdated design.

## Layers (responsibilities in `01`)
- Business rules (eligibility, matching, Dijkstra, cost, ranking, booking, capacity) go in services, never in routes, controllers or repositories.
- Repositories are persistence only.
- Express base path: `/api/v1`.

## Errors
- Handle at the right layer; never swallow business-rule violations.
- Meaningful failures: invalid request, unsupported crop, insufficient capacity, storage unavailable for period, no suitable vehicle, invalid booking transition, capacity conflict (`409`).
- Do not invent an error format (see `05` Undecided).

## Security
- Enforce authentication and authorization in the backend, not only the frontend.
- Hash passwords; never store plain text. Never hard-code secrets.
- Do not expose provider/admin operations to unauthorized users.

## Validation
Validate all incoming data (registration, requests, crop/quantity, storage config, capacity, vehicles, bookings) before business logic. Library is undecided.

## Dependencies
Before adding one: confirm the stack or existing code cannot do it, and that it does not change the architecture. Allowed stack is in `00`. Never treat an undecided technology as selected.

## Refactoring
Preserve module boundaries, API contracts, business rules and terminology. Do not add layers or features while refactoring.

## Testing focus (framework undecided)
Eligibility, capacity availability, transport matching, route calculation, cost calculation, ranking, booking state changes, capacity allocation/release, overbooking prevention.

## Undecided
Variable/function/constant casing; import order; path aliases vs relative imports; max function length/params; DTO naming and structure; validation library; auth/authz libraries; password-hashing tech; token format; env var names and config library; logging library/format; testing framework; ESLint/Prettier config; dependency injection.
