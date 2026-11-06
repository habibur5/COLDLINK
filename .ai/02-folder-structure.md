# Folder Structure

```text
ColdLink/
├── package.json      Root repository scripts and lint/format tooling
├── package-lock.json npm dependency lockfile
├── eslint.config.mjs ESLint flat configuration
├── .prettierrc.json  Prettier configuration
├── .prettierignore   Prettier exclusions
├── frontend/          React + TypeScript (internal structure undecided)
├── backend/
│   ├── prisma.config.ts  Prisma CLI configuration
│   ├── prisma/
│   │   ├── schema.prisma  database models and relations (details: `04`)
│   │   └── migrations/    Prisma Migrate history, committed to the repo
│   └── src/
│       ├── db/
│       │   └── client.ts  the single Prisma Client instance, imported by repositories
│       ├── generated/prisma/ generated Prisma Client (not hand-edited)
│       ├── modules/   one folder per module (list: 01 §Modules)
│       │   └── payments/
│       │       └── providers/  provider-specific adapters owned by payments
│       ├── middleware/
│       ├── config/
│       └── shared/
└── .ai/               AI-development docs (this folder)
```

The root npm package owns repository lint/format tooling. Backend runtime dependencies and application scripts are established by INF-02, not this root scaffold.

## Module template
Use only the files a module actually needs. Do not create empty or speculative files.
```text
src/modules/<module>/
├── dto/                       Zod schemas (request/response contracts)
├── <module>.repository.ts     Prisma Client persistence queries only
├── <module>.service.ts
├── <module>.controller.ts
└── <module>.routes.ts
```
Example: `users/user.repository.ts`, `user.service.ts`, `user.controller.ts`, `user.routes.ts`, `dto/`.
A module owning several tables (e.g. `bookings` owns `bookings`, `storage_bookings`, `transportation_bookings`) has one repository file per table it owns, e.g. `booking.repository.ts`, `storage-booking.repository.ts`, `transportation-booking.repository.ts` — never one giant repository mixing unrelated tables.

| File | Purpose |
|---|---|
| `dto/*` | Zod schemas — API request/response contracts, also the OpenAPI source (`05`) |
| `*.repository.ts` | Prisma Client persistence queries for the module's owned models (details: `04`) |
| `*.service.ts` | Business logic |
| `*.controller.ts` | HTTP handling only |
| `*.routes.ts` | Endpoints → controller methods, middleware |

Database **model definitions** live centrally in `backend/prisma/schema.prisma`, not inside modules. Prisma generates the typed client from this contract; module repositories import the singleton client from `src/db/client.ts`. Keep generated client output out of hand-edited source.

## Naming
- Module folders: kebab-case (`service-requests`).
- File pattern: `<name>.<layer>.ts`.
- Follow the existing style in a module before adding files.

## Undecided
Frontend structure; contents of `middleware/`, `config/`, `shared/`; which module owns `farmer_profiles`, `farm_locations`, `booking_status_history`, `admin_action_logs`, `idempotency_keys`, `roles`, `user_roles`.
`jobs` and `feature-flags` (§01) follow the same module template as any other module; `jobs` additionally holds scheduled-job definitions (e.g. a `*.job.ts` file per job) rather than HTTP routes.

`payments` follows the module template. Its orchestration, repository, controller, and routes own payment attempts and callback processing. Provider-specific adapters live under `payments/providers/` and own only provider protocol/HTTP behavior; they do not import booking, ledger, wallet, or marketplace internals.
