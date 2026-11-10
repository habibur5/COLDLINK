# ADR-0012: Permissioned admin-console operations and audit

**Status:** Accepted for V1 scope. Resolves [GitHub issue #11](https://github.com/habibur5/COLDLINK/issues/11). **Date:** 2026-11-10.

## Context

Issue #11 establishes a bounded backend admin console spanning production-grade operational work and academic-grade financial workflows. The project already rejects authority based on role names (ADR-0003), but the console additionally needs explicit staff operations, lifecycle actions, sensitive financial reads, and auditable administrative decisions. A role-based console or generic status editor would conflict with the authorization model and domain state machines.

## Decisions

### Surface and authority

1. V1 defines backend `/admin/*` operations; an admin UI is deferred. Exact routes and request/response contracts are API-design work and must not be inferred from this ADR.
2. Every console operation requires its own explicit permission. A staff member may perform any operation explicitly granted to them, independent of role name. A role named `admin`, `support`, or similar grants no authority by itself.
3. Permission grants, modifications, and revocations require the corresponding permission-management permission. A Platform Admin or another explicitly authorized permission manager may perform them. The Platform Admin has no implicit bypass; curated permission keys are held explicitly, per ADR-0003.
4. Permission scope follows ADR-0003: the base permission covers records where the caller is a party; `.any` is used only for cross-party access. There is no `.own` suffix. Each distinct operation receives a separate permission; this ADR does not expand the general permission catalog beyond #11's required operations.

### Administrative operations

The console scope and operation-permission pairs are listed in #11. It includes:

- Provider application/evidence review, information requests, independent capability and facility/vehicle decisions, and reasoned account/capability/resource suspensions and reinstatements (ADR-0005).
- Booking inspection and explicitly permissioned provider-component approval, component completion, and booking cancellation. These lifecycle actions require a reason and audit entry. They must follow the valid state transition and applicable party, verification, capacity, and business rules. No arbitrary status editing or case-evidence prerequisite is introduced.
- Permissioned dispute inspection, filing on a farmer's behalf, and resolution strictly under #8. Providers may respond and submit evidence but cannot resolve disputes.
- Sandbox payment-attempt inspection and the academic refund, penalty, ledger, modeled balance, withdrawal, settlement, and commission operations already defined by #21, #22, ADR-0008, and ADR-0009. All external financial actions remain simulated; no live provider calls or real-money movement.
- Existing role/permission, feature-flag, and platform-settings administration under ADR-0003 and issue #10. Platform settings are limited to the already-defined policy catalog. Commission configuration is limited to the provider/service rates and explicit negotiated exceptions and immutable snapshots in #21/ADR-0008. New financial policies, fees, charges, rules, or controls require a separate decision and approval.
- Read-only operational counts limited to pending provider reviews; pending facility and vehicle reviews; pending bookings; active disputes; and active/suspended facilities and vehicles.

No general-purpose user CRUD, advanced analytics, unlisted statistics, exports, regulator integration, partner outreach, or admin UI is included. Deletion is soft deletion/deactivation only; hard deletion is not an application operation. Delete permissions exist only for already-defined operations that support soft deletion/deactivation.

### Audit

1. Every state-changing administrative action is recorded in the append-only audit log with actor, action, target, before/after values, timestamp, and any required reason. Every booking lifecycle action above requires a reason. Existing policy-specific reason requirements remain in force.
2. Sensitive reads of payment, dispute, and ledger records also create audit entries. Ordinary reads follow existing access and security logging rules.
3. Audit entries cannot be edited or deleted through the Admin Console. The owner of the shared audit-recording/persistence boundary must be assigned during architecture reconciliation; domain modules must not create competing audit stores.

## Consequences

- The `admin` module is an entry point and coordinator, not the owner of booking, verification, dispute, payment, academic-finance, authorization, feature-flag, settings, or audit business rules. Commands delegate through owning-module boundaries and preserve their invariants.
- `.ai/01-architecture.md`, `.ai/05-api-standards.md`, `.ai/06-module-rules.md`, and `.ai/10-DB-SCHEMA.md` must reflect this decision before implementation. API route details, permission-catalog reconciliation, audit-module ownership, and implementation-specific schema details remain design work; they are not silently decided here.
- Mixed-grade scope remains classified in `.ai/12-development-strategy.md`: operational admin functions are production-grade; academic finance controls are persisted/simulated only. No live financial capability is authorized.

## Alternatives rejected

- **Role-name access or an implicit Platform Admin bypass:** conflicts with ADR-0003 and makes authority non-explicit.
- **A generic booking status editor:** bypasses state machines and domain invariants.
- **Admin-owned copies of domain logic or persistence:** violates the single-owner/module-boundary rules.
- **A full admin UI or analytics/reporting suite in V1:** exceeds the bounded backend scope and introduces unapproved work.
- **New financial rules or live actions under the admin-console umbrella:** exceeds the accepted academic simulation boundary and requires separate decisions.
