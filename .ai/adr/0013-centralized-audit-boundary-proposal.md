# ADR-0013: Centralized audit-recording boundary

**Status:** Accepted. **Date:** 2026-11-10. Resolves the audit architecture decision for [issue #11](https://github.com/habibur5/COLDLINK/issues/11). Related: ADR-0003 and ADR-0012.

## Context

The approved #11 scope requires an append-only audit record for every state-changing administrative action and for sensitive reads of payment, dispute, and ledger records. ADR-0003 separately requires audit records for authorization changes. These events originate in multiple domain areas. This decision assigns one shared audit owner while preserving business and state-change ownership in each domain module. This is an architecture decision, not implementation authorization.

## Decision

### Ownership boundary

1. A dedicated `audit` module in the existing modular monolith owns centralized audit-record creation and persistence, append-only storage, authorized retrieval, common event metadata, and audit integrity. It is not a microservice and does not use a separate audit database.
2. Domain-owning services remain responsible for authorization context, business rules, state transitions, and the facts of their own changes. They record required events through a shared application-level audit interface. The audit module records events; it does not decide whether an operation is valid or authorized.
3. Relevant events come from authorization, provider verification/onboarding, facilities and vehicles, bookings, finance/payment/refund/penalty/settlement/ledger, disputes, feature flags, platform settings, and admin operations, limited to the event classes already required by ADR-0003, ADR-0012, and #10.
4. The Admin module is a consumer of audit records and does not own shared audit recording. Domain modules must not maintain separate audit stores or independent recording mechanisms.

### Event content and immutability

Required events contain the actor, action, target type and identifier, UTC timestamp, and reason when required. Include a request/correlation identifier when available. State-changing administrative events also contain the relevant before/after state. Sensitive-read events identify the actor, action, and target, but do not copy the viewed payment, dispute, or ledger payload into the audit record. DENY-grant and deletion reasons remain mandatory under ADR-0003; #11 booking lifecycle overrides require a reason.

Audit records are append-only. The application exposes no update/delete operation for them. The final schema and technical enforcement mechanism remain subject to architecture/schema review; this proposal does not select a database trigger, separate credential, or other technology.

### Transactional consistency

- A state change and its required audit insert must commit in the **same database transaction**. The domain service supplies the event to the central recorder using that operation's transaction boundary. If audit persistence fails, the state change rolls back. A successful state change must never commit without its required audit record.
- Capture before/after values from the state actually read and written by the domain operation, within that transaction; do not reconstruct them afterward in the admin layer.
- For already-defined sensitive reads, record the audit event successfully before returning protected data. If recording fails, fail closed.
- Current #11 financial controls are simulations and have no live external side effects. Any future operation that cannot share a transaction with its external side effect requires a separate decision; this ADR does not authorize an outbox, retry scheme, or live integration.

### Failure handling

- If a required audit insert fails during a state-changing operation, roll back the domain transaction and fail the operation. Do not report success or perform a fallback mutation without an audit record.
- If a sensitive-read audit insert fails, fail closed and do not return the protected record.
- Emit operational/security diagnostics for audit failures without recursively attempting to write the same failure to the unavailable audit store. Diagnostics must not contain credentials, tokens, or viewed financial/dispute payloads.
- Ordinary reads and permission-evaluation failures retain their existing logging behavior; they are not added to the audit scope by this ADR.

### Scope and deferred policy

Audit scope is limited to authorization changes, administrative state changes, and specified sensitive reads already required by existing decisions. No additional event classes are introduced. Retention duration and tamper-evidence mechanisms are deferred to separate design work and are not decided here.

## Alternatives considered

- **Admin module owns all audit events:** rejected as the leading option because required events originate outside admin operations, and domain services must not rely on post-hoc reconstruction.
- **Each domain owns an independent audit store:** rejected because it fragments the append-only history, query surface, and enforcement policy.
- **Generic helpers in `shared/` own audit policy and persistence:** not recommended; this is a durable cross-domain capability, not merely reusable utility code, and `.ai/06-module-rules.md` forbids using `shared/` as a business-logic dump.

## Consequences

- Add `audit` to the architecture's module map and module ownership rules. Detailed interface and schema implementation remain future work and must conform to this decision.
- No implementation is authorized by this ADR. Retention and tamper-evidence remain deferred.
