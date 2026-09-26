# Database & Drizzle Conventions

Engine: **MariaDB**. Schema (tables, columns, keys, checks): `10`. This file covers only how Drizzle implements it — nothing here redefines the data model.

## Why Drizzle (context, not a decision to revisit)
Chosen over MikroORM/TypeORM/Prisma for this project specifically: no query-engine binary (lighter to host on a modest BD VPS), SQL-shaped queries (nothing hidden behind a generated client), and it was the stronger 2026 market signal for a CV-facing project. See project history if this needs re-justifying — it isn't an open question.

## Core setup
| Topic | Rule |
|---|---|
| Package | `drizzle-orm` (query layer) + `drizzle-kit` (migrations CLI), MariaDB via the `mysql2` driver (`drizzle-orm/mysql2`) |
| Dialect | Drizzle's **MySQL** dialect — MariaDB is wire-compatible; there is no separate "MariaDB dialect" in Drizzle, this is expected, not a workaround |
| Schema location | `backend/src/db/schema/`, **one file per table** — required so Drizzle Kit can generate migrations from a single schema tree (`02`) |
| DB client | One singleton `backend/src/db/client.ts` exporting the configured `drizzle()` instance; every repository imports from here — never instantiate a second client |
| No entity classes, no decorators | A "table" is a plain exported `mysqlTable(...)` object + its inferred TypeScript types (`typeof table.$inferSelect` / `$inferInsert`) — this replaces the class-based entity pattern entirely |

## Schema files (`src/db/schema/`)
- One file per table, named after the table: `storage-facilities.schema.ts` defines `storageFacilities`.
- Export the table object and its two inferred types from the same file:
  ```ts
  export const storageFacilities = mysqlTable('storage_facilities', { ... });
  export type StorageFacility = typeof storageFacilities.$inferSelect;
  export type NewStorageFacility = typeof storageFacilities.$inferInsert;
  ```
- Relations are declared with Drizzle's `relations()` helper in the **same file** as the table they're declared for (not a separate relations file), so a table's connections are visible next to its columns.
- A barrel file `src/db/schema/index.ts` re-exports every table — this is what gets passed to `drizzle({ schema })` and to Drizzle Kit's config, so a new table is invisible to migrations until it's added there.

## Primary keys, columns, naming
- UUID primary keys, matching `10`: `char('id', { length: 36 }).primaryKey()`, generated in application code (`crypto.randomUUID()`) at insert time — not DB-generated, so the same ID is known before the insert executes (useful for the FK-heavy inserts this schema has, e.g. writing an allocation row alongside its booking).
- Column names: `snake_case` in the DB (per `10`), camelCase in the JS/TS object key — Drizzle's `mysqlTable` maps this explicitly per column: `fullName: varchar('full_name', { length: 150 })`. Never rely on implicit casing conversion.
- `created_at`: `datetime('created_at').notNull().default(sql\`CURRENT_TIMESTAMP\`)`.
- `updated_at`: `datetime('updated_at').notNull().default(sql\`CURRENT_TIMESTAMP\`).onUpdateNow()` — DB-managed per `10`, never set from application code.
- Enums: Drizzle's `mysqlEnum('status', ['active', 'inactive', ...])`, values matching `10` exactly.
- Foreign keys: `.references(() => otherTable.id)` declared on the column, plus a matching `relations()` entry for query-side joins.

## Repositories (the persistence layer, per `01`/`02`/`06`)
- One `*.repository.ts` file per table a module owns (`02` §Module template) — a thin, typed wrapper around Drizzle queries for that table only. No business logic here (`06`).
- A **shared base repository** (`src/shared/base.repository.ts` or similar — exact location tracked in `02` Undecided) provides generic `findById`, `findMany`, `create`, `updateById` used by every per-table repository, so common CRUD isn't reimplemented per table. Table-specific queries (joins, filters unique to that table's domain) live in the table's own repository, not the base.
- A repository method takes and returns the table's inferred types (`NewStorageFacility` in, `StorageFacility` out) — never `any`, never a hand-written duplicate type.
- Repositories never import Express req/res, never contain a business rule (capacity math, ranking, cost formulas) — that's the service layer's job (`01`).

## Relationships in queries
- Prefer Drizzle's **relational query API** (`db.query.bookings.findMany({ with: { storageBookings: true } })`) for straightforward loads (a booking with its children) — it reads closest to the actual relationship shape from `10`.
- Use the **query builder** (`db.select().from(...).innerJoin(...)`) when the query needs conditions, aggregation, or projections that the relational API doesn't express well (e.g. the capacity-overlap sum in `10` §Capacity model).
- M:N-with-attributes tables (`facility_crop_configs`) are modeled as an ordinary table with two `relations()` entries, exactly as `10` describes them — never as an implicit Drizzle many-to-many (Drizzle doesn't have one; this is consistent with `10`'s own rule, not a Drizzle-specific workaround).

## Transactions
- Drizzle's `db.transaction(async (tx) => { ... })` for every multi-step write that must be atomic — the booking-creation flow (`01` §Booking pipeline) is the primary example: the capacity-overlap check, the allocation insert, and the booking + child inserts all happen inside one `tx`.
- Row locking for the overlap check uses `.for('update')` on the `SELECT` inside the transaction (MariaDB `SELECT ... FOR UPDATE`) — this is what makes the overlap check safe under concurrent requests; without it the check-then-insert has a race window.

## Migrations
- Drizzle Kit generates migrations from the schema tree (`drizzle-kit generate`), applied with `drizzle-kit migrate` (or `push` only in early/throwaway local dev, never against a shared/prod database).
- Generated migration files are **committed to the repo** under `src/db/migrations/` (`02`) and never hand-edited after being generated — if a migration is wrong, generate a new one that corrects it, don't rewrite history.
- One migration per schema change that ships together; don't batch unrelated table changes into one migration "for convenience."

## Validation boundary
- Zod schemas (`03`, `05`) validate **incoming request data** before it reaches a service. Drizzle's inferred types validate **what actually goes to the DB**. These are two different layers with two different jobs — a Zod schema is not a substitute for a Drizzle type and vice versa; don't try to derive one from the other automatically unless a specific need for it comes up.

## Undecided
Exact base-repository method set beyond generic CRUD; whether `drizzle-kit push` is ever acceptable outside local dev; connection pool sizing; whether soft-deleted (status-flipped) rows are excluded by default in repository reads or require an explicit filter each time — decide this before writing the first repository, since getting it wrong silently leaks inactive/suspended rows into normal queries.
