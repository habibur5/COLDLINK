# ADR-0007: Prisma ORM 7 for MariaDB

**Status:** Accepted — supersedes the prior Drizzle ORM choice. **Date:** 2026-11-06.

## Context

ColdLink has no application code or migrations yet, so changing the ORM now avoids a code and schema migration later. The database remains MariaDB; the decision changes only the persistence tooling and its implementation conventions.

## Decision

Use **Prisma ORM 7** with its MySQL connector for MariaDB, plus Prisma's MariaDB driver adapter. Keep `10` as the data-model source of truth, map the existing snake_case table and column names explicitly in `schema.prisma`, and use Prisma Migrate for versioned schema changes. Use one generated Prisma Client singleton and module-owned repositories. Do not use Prisma ORM 8 until its MariaDB support is available; as of this decision, Prisma's ORM 8 database matrix lists MariaDB as coming soon, while ORM 7 explicitly supports MariaDB.

Preserve the capacity-safety requirement: the booking transaction must lock the `facility_crop_configs` row with parameterized raw SQL inside a Prisma interactive transaction before checking overlapping allocations. This is necessary because the Prisma model-query API does not expose `SELECT ... FOR UPDATE`.

## Consequences

- Replace the Drizzle-specific `04` conventions with Prisma conventions; update architecture, folder layout, progress tracking, schedule, and the payment implementation gate.
- The Prisma schema must explicitly map names and MariaDB-native types to avoid unintended schema drift. Required constraints unsupported by Prisma's schema language must be preserved in reviewed migrations.
- This is a technology choice only: it does not alter domain behavior, database design decisions, module ownership, or API contracts.

## Sources

- [Prisma ORM 7 MySQL connector (including MariaDB)](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/mysql)
- [Prisma ORM 8 supported database matrix](https://www.prisma.io/docs/orm/supported-databases)
