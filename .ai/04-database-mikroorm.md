# Database & MikroORM Conventions

Engine: **MariaDB**. Schema (tables, columns, keys, checks): `10`. This file covers only how MikroORM implements it.

## Decided
| Topic | Rule |
|---|---|
| Version | Latest MikroORM |
| Entity style | Class-based with decorators. Not `EntitySchema` |
| Files | One entity per file. File also holds a **custom repository class** (and entity-specific logic that belongs with the entity, not the service) |
| Repository link | Set on the entity via the `repository` option |
| Base classes | Shared **base entity** and **base repository**; all entities/repos extend them |
| Request flow | Router → Controller → Service → Repository → Entity |
| Primary key | UUID column `id` on every table (shared-PK pattern for profile tables) |
| Properties | Types and nullability follow `10` column by column |
| M:N | Never a MikroORM implicit pivot. Model the join as its own entity with two `ManyToOne` (e.g. `facility_crop_configs`) |
| 1:1 extension | Shared primary key (e.g. `farmer_profiles.user_id` = `users.id`) |
| FKs, unique, check | As defined in `10` |
| Table names | `snake_case`, plural (`storage_facilities`) |
| Column names | `snake_case` (`provider_id`, `created_at`) |

## Undecided (do not assume)
- Driver, connection, env-based config, entity discovery.
- Fields carried by the base entity.
- UUID generation (app vs DB).
- `columnType`/decimal precision conventions.
- FK on-delete/on-update behavior.
- Non-unique indexes.
- Check/default enforcement: DB, app, or both.
- Base vs per-entity repository method split.
- `EntityManager` usage (direct, repo-only, request-scoped fork), transactions, query style (QueryBuilder vs `find`), filters, pagination, populate/loading strategy.
- Migrations (tool, naming, generated vs hand-written).
- Raw SQL policy; database error handling.
- MikroORM-side names (classes, properties, indexes, constraints) beyond what `10` implies.

If existing code already shows a pattern for any item, follow it; otherwise ask.
