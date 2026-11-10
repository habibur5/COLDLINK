# ADR-0003: Permission-based authorization — deny-wins, party-scoped, resolved server-side

**Status:** Accepted (MVP scope) — supersedes authorization based on account types, the legacy `users.role` enum, or role names. Predefined roles are permitted as editable permission collections; their names never grant authority. Complements [ADR-0001](0001-bundle-based-matching-and-recommendations.md) and [ADR-0002](0002-per-vehicle-service-area.md), which are unaffected.
**Date context:** decided during the Wayfinder decision phase, before any application code existed.

## Context

The original design carried a fixed account type — `users.role` with `farmer | provider | admin` — and authorized actions by checking it. That model fails in several ways that showed up during design:

1. **It is the wrong shape for the domain.** A person may farm, own a facility, and drive for a transport provider at the same time, in any combination and over time. A single-valued role cannot express this, and changing the value silently rewrites history.
2. **A role name is not a capability.** "Admin" tells you nothing about *which* operations are permitted. Authorization must be a statement about an operation on a resource, not about who someone is.
3. **Fixed roles cannot be reconfigured.** Operations need to be adjustable at runtime — a support person granted exactly one capability, a provider suspended, a new privileged action introduced — without code changes or a schema migration of an enum.
4. **Revocation must be immediate.** Suspending a user or withdrawing a permission has to take effect *now*. Any scheme that embeds authority in a token defers revocation until the token expires, which is unacceptable for suspensions and for money-adjacent operations.

The decision phase established the policy first (explicit permissions, editable role collections, explicit DENY always wins, default deny, feature flags separate from permissions). This ADR records the resulting model in full.

## Decision

**1. Authority is a named permission, never a role name or account type.**
A **permission** is an atomic capability to perform one operation on one resource, named `<resource>.<action>` — lowercase kebab-case ASCII, separator `.` (e.g. `facility.update`, `booking.cancel`, `refund.approve`, `payment.refund`, `role.assign`). Actions are `create`, `read`, `update`, `delete`, or a business verb where the domain needs one (`approve`, `reject`, `cancel`, `verify`, `suspend`, `reinstate`, `refund`, `waive`, `settle`, `resolve`, `assign`, `export`). `<resource>.*` is a resource wildcard. **Granularity is resource + action only — never per-field, never per-record.** A **role** is a named, admin-defined collection of permissions; the name carries no authority.

Initial setup seeds editable predefined roles, including `user`, `admin`, `farmer`, `provider`, and `staff`. These are starter permission collections, not account types or immutable system roles. Authorized administrators may create, update, assign, deactivate, and manage their permissions through the role-management system, subject to the same permission resolver, audit, and other approved authorization rules. No role receives authority from its name; each role grants only its explicitly assigned permissions. The `user` role is the existing baseline role granted at registration, with only the ordinary permissions explicitly assigned to it. Any bootstrap administrator access is likewise represented by explicit permission assignments, never by checking the `admin` name.

**2. There is no global wildcard.**
`*` does not exist. The bootstrap **Platform Admin** holds every curated key explicitly. The catalog is a **fixed, seeded, versioned list**, extended only by migration; the migration that introduces a key assigns it to the Platform Admin explicitly. New keys are never granted automatically to ordinary roles.

**3. Permissions attach to roles and to users — nothing else.**
Effective permissions come from **role membership plus user-level assignments**. There are no provider-level or platform-level permission scopes. (Scopes of that kind exist for **feature flags**, which are a separate concept: flags control availability, permissions control authorization, and both must pass.)

**4. `own` means party to the record; `.any` grants cross-party access.**
A permission without `.any` applies only to records the caller is a **party** to — its owner *or* a counterparty. Many records have several parties: a booking has the farmer, the storage provider and the transport provider; a payment, a settlement and a dispute likewise. `.any` extends a permission to records the caller is not a party to. Non-party resources (`crop`, `role`, `permission`, `audit-log`, `feature-flag`, `platform-setting`, `translation`, `report`) have no `.any` variant. **There is no implicit administrative bypass:** cross-party access is always an explicitly granted permission, and the service layer still verifies ownership, party relationship, resource status and other business rules.

**5. The state machine governs transitions; permissions govern authorization.**
Ordinary lifecycle transitions (`booking.complete`, a provider accepting a job) take effect because the **state machine** permits them in the current state and the caller is a party — not because each transition is its own permission. Permissions decide *whether* the caller may perform the operation at all. Administrative and exceptional operations do require explicit permissions: `booking.cancel`, `refund.approve`, `refund.reject`, `penalty.waive`, `dispute.resolve`, `user.suspend`, `user.reinstate`, `facility.suspend`, `facility.reinstate`, and so on. This avoids a second, drifting copy of the state machine in the permission catalog.

**6. Resolution is deny-wins, default-deny, and server-side on every request.**
Every request evaluates the caller's **effective permission set**. Any applicable **DENY** wins; otherwise any **ALLOW** permits; otherwise access is denied. A user-level grant cannot override a role-level DENY. Resolution happens once, centrally, **server-side**, from a Redis-cached effective set. **Access tokens carry identity only and never permission claims.**

**7. Invalidation is immediate.**
Any change to roles, permissions, assignments or suspension state invalidates the affected users' caches immediately, via a **version counter**; a short TTL is a backstop against a missed invalidation, not the primary mechanism. TTL-only expiry is explicitly rejected: revocations and suspensions must not wait for a token to expire.

**8. Deletion is deactivation.**
`delete` always maps to soft-delete or deactivation. No entity is hard-deletable through the v1 API — including entities a booking references. Hard deletion is a controlled database or migration operation, never an application permission or API capability.

**9. Authorization changes are audited.**
Every change records actor, target type and id, before/after state, timestamp and reason, with **reason mandatory for DENY grants and deletions**. Role create/update/delete, permission grant/revoke, role assign/unassign, user-level ALLOW/DENY changes, catalog seeding and recovery-command execution are all audited. Permission *evaluation failures* go to security logs, not the audit log.

**10. Registration grants a baseline, and bootstrap is explicit.**
A newly registered account receives the seeded, **admin-editable `user` baseline role** holding ordinary capabilities (own account, profile and sessions; farm locations; catalog reading; service requests; recommendations; booking create/read/cancel; own payment/installment/refund/ledger reads; reviews; disputes; notifications). It contains no `.any` keys and no administrative, provider-approval or settlement capability. Predefined role names, including `admin`, do not imply permissions. Any initial Platform Admin access is provisioned through explicit assignments of curated permissions; the one-time System Admin recovery command remains atomic, refuses re-execution, and survives restarts and migrations.

## Consequences

- **`users.role` and every role-guarded check must go.** `/admin/*` endpoints and all module guards switch from role checks to permission checks against the central resolver. This is a behavioral change, not a rename.
- **The permission catalog becomes a first-class seeded artifact** — 29 resources across identity & access (`user`, `role`, `permission`, `session`, `profile`), supply (`farm-location`, `crop`, `facility`, `facility-crop-config`, `vehicle`, `vehicle-service-area`), provider onboarding (`service-application`, `provider-verification`), marketplace (`service-request`, `recommendation`, `booking`), finance (`payment`, `installment`, `refund`, `penalty`, `settlement`, `ledger`), trust & communication (`dispute`, `review`, `notification`) and platform administration (`feature-flag`, `platform-setting`, `translation`, `audit-log`, `report`). One umbrella `booking` resource covers storage and transportation bookings; the state machine and service layer enforce the per-type rules.
- **New tables are required** (not yet in `10`): roles, permissions (catalog), role-permission grants, role assignments, and user-level ALLOW/DENY assignments.
- **Redis becomes an authorization dependency.** Effective permission sets are cached and version-invalidated; a stale cache is a security defect, so invalidation is on the critical path of every authorization-relevant write.
- **Every protected endpoint declares its required permission**, and the admin console and feature-flag tickets build on this model.
- **Authoring cost:** new privileged operations need a migrated key, and the migration must grant it to the Platform Admin deliberately — the safe default is that a new key grants nothing.
- `01`, `05`, `06`, `10`, `11` are still not updated to match this — same "not yet applied" status as ADR-0001 and ADR-0002.

## Alternatives considered

- **Keep `users.role` (`farmer | provider | admin`) as an account-type enum or authorize by role name** — rejected; it conflates identity with capability and cannot express one person holding several domain relationships. Editable predefined roles remain supported as permission collections.
- **Role-name-based checks with an implicit "admin bypasses everything"** — rejected; a hidden bypass is unauditable and makes cross-party access impossible to reason about. Cross-party access is now an explicit `.any` permission.
- **Embed permissions in the access token** — rejected; revocation and suspension would be delayed until token expiry, which is unacceptable for suspensions and money-adjacent operations. Tokens carry identity only.
- **TTL-only cache expiry instead of invalidation** — rejected for the same reason; a short TTL remains only as a backstop.
- **A global `*` permission for the Platform Admin** — rejected; it hides which capabilities exist, makes "grant everything but this one" impossible, and silently expands authority when a new key is added. Every key is explicit, and new keys grant nothing until deliberately assigned.
- **A permission per lifecycle transition** (`booking.accept`, `booking.start`, `booking.complete`, …) — rejected; it duplicates the booking state machine in the catalog and drifts. Permissions gate the operation and the exceptional overrides; the state machine gates the sequence.
- **A separate permission resource per booking type** (`storage-booking.*`, `transportation-booking.*`) — rejected; the database split does not justify a doubled catalog. One `booking` resource, with per-type rules enforced by the service layer and state machine.
- **Provider-level or global permission scopes** — rejected; those scopes belong to feature flags. Permissions attach to roles and users.
