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
- Comments explain non-obvious things only (business rule, routing-provider integration detail, capacity consistency). Never restate code or preserve outdated design.

## Layers (responsibilities in `01`)
- Business rules (eligibility, matching, routing-provider calls, cost, ranking, booking, capacity) go in services, never in routes, controllers or repositories.
- Repositories are persistence only.
- Express base path: `/api/v1`.

## Errors
- Handle at the right layer; never swallow business-rule violations.
- Meaningful failures: invalid request, unsupported crop, insufficient capacity, storage unavailable for period, no suitable vehicle, invalid booking transition, capacity conflict (`409`), disabled feature (`403`).
- Do not invent an error format (see `05` Undecided).
- Unhandled/unexpected errors are reported to **Sentry**; do not silently catch-and-discard an error that isn't a known business failure.

## Logging
- **pino** for structured (JSON) logging. Log at service-layer boundaries and on business-rule failures, not on every line.
- Never log secrets, passwords, tokens, or full request bodies containing sensitive data.

## Security
- Enforce authentication and authorization in the backend, not only the frontend.
- Every write to a provider-owned resource verifies **ownership** in the service layer, not just role (`01` §Authorization).
- Hash passwords; never store plain text. Never hard-code secrets — see `.env.example` and the secrets rule below.
- Do not expose provider/admin operations to unauthorized users.
- A disabled feature flag is enforced server-side and returns `403`, regardless of what the frontend shows (`01` §Feature Flags).

## Secrets
- Every required env var is listed in a single root `.env.example` (values blank/placeholder).
- Secrets are never committed. Local dev uses `.env` (gitignored); production uses environment variables or a secrets manager/vault — never a committed file.
- For #19, only sandbox credentials and sandbox endpoints may be configured. Keep sandbox and production configuration separate; do not load production credentials or provide a production fallback. Never persist provider credentials, access tokens, PINs, or OTPs.

## Deletion policy
- No `DELETE` that removes a row for any entity a booking can reference (users, providers, facilities, vehicles, crops, etc.). Every such "delete" endpoint sets an existing status field (`inactive`, `suspended`, etc.) instead. See `10` §Integrity rules for which entities this applies to.

## Idempotency
- `POST /bookings` and other create-endpoints that mutate meaningfully require an `Idempotency-Key` header, checked against the idempotency lookup table before processing (`01` §Idempotency). Do not skip this when adding a new create-endpoint that shares the same risk (payment-like or capacity-affecting writes).

## Validation
Validate all incoming data (registration, requests, crop/quantity, storage config, capacity, vehicles, bookings) before business logic, using **Zod**.

## Dependencies
Before adding one: confirm the stack or existing code cannot do it, and that it does not change the architecture — **and get explicit approval first**; do not add a dependency unilaterally. Approved so far: Zod (validation), pino (logging), Sentry (error tracking), Redis + BullMQ (jobs/cache), plus the base stack in `00`. Never treat an undecided technology as selected.

## Refactoring
Preserve module boundaries, API contracts, business rules and terminology. Do not add layers or features while refactoring.

## Testing focus (framework undecided)
Eligibility, capacity availability, transport matching, route calculation, cost calculation, ranking, booking state changes, capacity allocation/release, overbooking prevention.

## Undecided
Variable/function/constant casing; import order; path aliases vs relative imports; max function length/params; DTO naming and structure; auth/authz libraries; password-hashing tech; token format; env var names and config library; testing framework; ESLint/Prettier config; dependency injection.
