# Database & Prisma ORM Conventions

Engine: **MariaDB**. The data contract (tables, columns, keys, checks) is defined in `10`; this file describes how the application maps and accesses it. The project uses **Prisma ORM 7** with the MySQL connector. Prisma ORM 8 does not yet support MariaDB, so do not upgrade the major version until MariaDB support is available and the upgrade is explicitly reviewed.

## Core setup

| Topic | Rule |
|---|---|
| Packages | `prisma`, `@prisma/client`, and the Prisma-maintained MariaDB driver adapter (`@prisma/adapter-mariadb`) |
| Connector | `provider = "mysql"` for MariaDB; use a MariaDB connection URL |
| Contract | `backend/prisma/schema.prisma`, containing models, relations, mappings, and generated-client configuration |
| Client | One singleton in `backend/src/db/client.ts`; repositories import it rather than creating clients |
| Generated client | Use an explicit output path under `backend/src/generated/prisma/`; generated files are never hand-edited |
| Configuration | Prisma 7 CLI connection configuration in `backend/prisma.config.ts`; the runtime MariaDB adapter receives connection settings from the approved environment configuration |

Prisma ORM 7 supports self-hosted MariaDB through its MySQL connector and `mariadb` driver adapter. Do not use Prisma ORM 8 for this project while MariaDB is listed as unsupported/coming soon. See the official [Prisma ORM 7 MySQL connector documentation](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/mysql) and [supported databases for Prisma ORM 8](https://www.prisma.io/docs/orm/supported-databases).

## Schema mapping

- Define one Prisma model per table in `10`. Keep domain/model identifiers readable, and explicitly preserve existing table/column names with `@@map("table_name")` and `@map("column_name")` where they differ.
- Preserve MariaDB types and constraints with native type annotations where required (for example `@db.Char(36)`, `@db.Decimal(10, 2)`, and `@db.DateTime(0)`). Do not accept Prisma defaults that silently change the established schema.
- Represent relations and their referential actions explicitly. All foreign keys remain `ON DELETE RESTRICT` per `10`; never introduce cascading hard deletes.
- Use generated Prisma model and payload types at persistence boundaries. Keep request DTOs and domain concepts distinct; do not expose generated database types as the public API contract.
- Model database-backed enums in Prisma only where the MariaDB connector and schema support match `10`; otherwise preserve the required database constraint through a reviewed migration.
- `updated_at` behavior must match the contract in `10`. Prisma's `@updatedAt` is maintained by Prisma Client, not by MariaDB for writes made outside Prisma; use an explicit database default/trigger or equivalent only if the data contract requires database-managed updates.

## Repositories and queries

- One repository file per table/model a module owns, following `02`. Repositories use the singleton Prisma Client and contain persistence/query code only; business policy remains in the service layer (`01`, `06`).
- Do not build a generic base repository solely to wrap Prisma's generated model delegates. Add shared persistence abstractions only when a concrete repeated need exists and the boundary remains typed.
- Use Prisma's generated relation queries for straightforward related-record reads. Use typed query composition where practical; keep provider-specific raw SQL inside the owning repository and parameterized.
- A Prisma model represents one table. Join tables with attributes (for example `facility_crop_configs`) remain explicit models, not implicit many-to-many relations.
- Filter inactive, suspended, and otherwise ineligible records explicitly in repository queries; a generic lookup must not accidentally expose them to marketplace flows.

## Transactions and capacity safety

- Use Prisma interactive transactions for multi-step writes that must be atomic. Booking creation, capacity checks, allocation, and booking/component inserts must share one transaction (`01`).
- MariaDB has no exclusion constraint for overlapping capacity intervals. Prisma does not provide a model-query API for `SELECT ... FOR UPDATE`; the capacity repository must issue a parameterized `$queryRaw` lock against the relevant `facility_crop_configs` row inside the same transaction, then perform the overlap check and writes through that transaction client.
- Keep the lock and check in one transaction and preserve the existing `409 Conflict` behavior. Never replace the lock with an unlocked read/check/write sequence.
- Raw SQL is a narrow persistence escape hatch for database features Prisma cannot express. It must be parameterized, reviewed, and covered by tests; it does not move business rules into repositories.

## Migrations

- Use Prisma Migrate: `prisma migrate dev` for development and `prisma migrate deploy` for deployment. Commit migration directories with the schema change they implement.
- Review generated SQL before applying it, especially for MariaDB-specific types, checks, indexes, referential actions, and data preservation. Use a custom migration SQL statement when Prisma's schema language cannot express a required constraint or operation.
- Never edit an already-applied migration. Correct shipped history with a new migration. Do not use `prisma db push` against shared or production databases.
- Keep schema changes and migration history aligned with `10`; generated Prisma Client output is regenerated, not hand-maintained.

## Validation boundary

Zod (`03`, `05`) validates incoming API data. Prisma Client's generated types describe persistence inputs/outputs. They are separate contracts: a generated type does not replace request validation, and request DTOs should not be derived blindly from the database model.

## Undecided

Connection pool sizing and runtime configuration details; exact repository method set; which MariaDB constraints require custom migration SQL; whether generated Prisma Client output is committed or generated during build/CI. Resolve these before the first implementation rather than assuming a default.
