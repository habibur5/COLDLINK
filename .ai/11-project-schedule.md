# ColdLink Waterfall Project Schedule

This schedule follows the Waterfall Model. Phases are sequential and each ends with a documented review gate before the next begins. Tasks within a phase follow architecture and issue dependencies; parallel delivery across phases is not the default. Grade and scope rules are authoritative in `.ai/12-development-strategy.md`.

## Phase 0 — Requirements and scope baseline

**Goal:** approve product scope, issue classifications, acceptance criteria, and explicit exclusions.

- Reconcile all open GitHub issues with production/academic grades.
- Resolve or explicitly defer product decisions without inventing requirements.
- Record excluded real-money and advanced features; preserve closed issue history.

**Exit gate:** issue list, grades, dependencies, and requirements baseline reviewed and accepted.

## Phase 1 — Architecture and data design

**Goal:** baseline technical design before feature implementation.

- Preserve accepted RBAC, auth, provider verification, matching, routing, booking, capacity, security, Prisma/MariaDB and database-integrity decisions.
- Reconcile architecture, API, module boundaries, schema, test strategy, and the academic simulation boundary.
- Define production-grade and academic-grade acceptance criteria; financial simulations must not connect to live endpoints.

**Exit gate:** docs/ADRs/schema/API design agree; unresolved decisions have owners and remain blockers where required.

## Phase 2 — Foundation and production-grade core implementation

**Goal:** implement in dependency order: repository/tooling and backend foundation (INF-01/02 complete per code inspection), auth/session and permissions, provider management/verification, catalog/resources, capacity, deterministic matching/routing, booking lifecycle, notifications, security and integrity.

Sandbox payments (#19) remain restricted to bKash Tokenized Checkout and SSLCommerz Hosted Checkout. They use sandbox credentials/endpoints only. Academic financial records do not turn them into live payment capabilities.

**Exit gate:** production-core acceptance criteria pass automated tests, security/integrity checks and documented review. A demo is not a substitute for tests.

## Phase 3 — Academic-grade workflows

**Goal:** implement retained non-core features with functional business logic, persistence, validation and tests where applicable:

- installment plans and simulated/sandbox collection;
- persisted provider ledger, commission snapshots, pending/available modeled balances;
- refund and provider-penalty decisions with simulated outcomes;
- simulated provider withdrawal/settlement lifecycle;
- dispute-resolution enhancements and financial consequences;
- other retained future features, including reviews/overstay policy as selected in the approved scope. Localization is excluded from V1; Bangla requires a separately approved feature (ADR-0010).

No academic workflow may issue a live payment, refund, custody instruction, payout or settlement.

**Exit gate:** each feature is clearly labeled academic, has persisted state and tests, and demonstrates external-operation simulation boundaries.

## Phase 4 — System verification and release readiness

**Goal:** integrate and verify the baselined system, fix defects, complete documentation and prepare a demonstrable release.

- End-to-end checks cover core marketplace journeys and academic financial simulations separately.
- Validate migrations, authorization, ownership, capacity concurrency, idempotency, sandbox isolation and failure handling.
- Release gate confirms exclusions remain disabled and no live financial configuration is present.

**Exit gate:** review evidence, test results, known limitations, deployment/rollback plan and release approval are recorded.

## Dependency and status rules

- Work proceeds phase-by-phase; a change to a baselined requirement returns to Phase 0/1 review before implementation.
- GitHub issue dependencies must reflect actual prerequisite work. #19 no longer waits on completed INF-01/INF-02. #15 core state-machine decisions can depend on academic #5/#6/#8 only for modeled financial transitions; financial implementation stays in Phase 3.
- Track code-inspected progress in `.ai/09-feature-progress.md`; issue state is not evidence of implementation completion.
- Preserve estimates and existing issue discussion as history; do not use the prior parallel Critical Path/PERT/Gantt as the governing delivery model.
