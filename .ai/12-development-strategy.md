# Development Strategy and Feature Classification

## Delivery model

ColdLink follows a **Waterfall Model**: complete and baseline requirements, architecture/data design, implementation, verification, and release in that order. Each phase has an explicit review/approval gate before the next begins. Within an approved implementation phase, tasks may be sequenced by dependency; scope changes return to requirements/design review before implementation. Do not treat exploratory prototypes or parallel feature delivery as the project lifecycle.

## Feature grades

### Production-grade core

Production-grade means secure, validated, persisted, tested, maintainable behavior suitable for the intended operational product (subject to operational readiness and approvals). This includes the already-planned core:

- Authentication, sessions, advanced permission-based RBAC, auditability, and security.
- User/provider management, service applications, capability/resource verification, and core admin operations.
- Catalog, facility/vehicle management, service areas, capacity integrity, and transactional booking lifecycle.
- Deterministic, rule-based bundle generation and ranking; routing-provider abstraction and route feasibility.
- API contracts, database constraints/migrations, idempotency, notifications, and core deployment/observability foundations.
- Payment attempts through **sandbox-only** bKash Tokenized Checkout and SSLCommerz Hosted Checkout. Sandbox success is not live-money capability.

Preserve accepted architecture and ADR decisions. Production-grade does not authorize real payment processing, custody, or payout.

### Academic-grade features

Academic-grade features implement useful end-to-end business logic with persistence, input/business validation, and tests where applicable. They are demonstrable and deliberately not represented as production financial infrastructure. External financial operations may be simulated; keep simulation boundaries explicit in APIs, data, UI, fixtures, and documentation.

Academic-grade includes:

- Automated installment schedules and collection orchestration, using only sandbox payment attempts or a deterministic simulator.
- Refund policy, refund records/workflows, and simulated refund outcomes; no production refund execution.
- Provider financial ledger and balances as persisted academic records.
- Commission calculation/configuration and immutable booking snapshots.
- Provider settlement/withdrawal workflows as stateful simulations only; no actual payout or settlement transfer.
- Dispute-resolution enhancements and financial consequences modeled as academic records.
- Other retained future/non-core features, including localization, reviews, advanced admin reporting, overstay/extension policy, and other open policy work unless explicitly promoted to core by a recorded decision.

The grade changes the assurance/operational claim, not the expectation of coherent business rules, durable data, validation, and tests.

## Explicit exclusions

- Production payment integrations, production credentials, live transactions, and all real-money operations.
- Hold.bd or any real-world payment/escrow/payout partnership; actual custody, payouts, and settlements.
- Production refund processing and real regulatory-system integrations.
- AI/ML recommendations; recommendations remain deterministic and rule-based.
- Weather prediction, live GPS tracking, blockchain, multi-currency, and native mobile applications.

Historical issues and ADRs may mention these concepts; mark superseded decisions clearly rather than deleting discussion.

## GitHub issue classification

Every retained open issue has exactly one grade label: `grade:production` or `grade:academic`. Preserve existing `wayfinder:*` type labels. Update issue scope, acceptance criteria, and dependencies to respect the grade and excluded scope. Use `grade:removed` for issues whose requested deliverable is explicitly excluded; close those issues with a concise reason while retaining their discussion. Do not close a mixed-scope issue until its retained work has been separated or its body clearly identifies retained and removed parts.

### Current allocation

| Issue | Grade | Boundary |
|---|---|---|
| #1 decision map | Production planning | Indexes both grades; completed decisions remain historical |
| #4 commission/settlement policy | Academic | Calculate/persist/simulate only; no actual settlement |
| #5 refund/penalty policy | Academic | Policy and simulated outcomes; no provider refund execution |
| #6 installments/overstay/extensions | Academic | Persisted schedules and simulated collection |
| #11 admin console | Production core + academic panels | RBAC, verification, core operations production; financial/dispute enhancements academic |
| #12 localization | Academic | Retained future feature |
| #13 sessions/contact verification | Production core | Secure auth/session behavior |
| #14 deployment/environments | Production core | No live payment configuration or real-money capability |
| #15 booking/component lifecycle | Production core | Core lifecycle/capacity production; financial consequences simulated and academic |
| #19 payment sandbox integrations | Production core | Sandbox only; no production credentials or live endpoint |
| #20 provider-evidence confirmation | Production-core planning gate | Manual evidence confirmation only; no regulator-system integration |

Issue #18 partner/custody research is historical and closed; its real-world partner deliverable is removed. #16 and #17 remain closed historical decisions; their prior real-custody assumptions do not authorize operations and are superseded by this strategy.
