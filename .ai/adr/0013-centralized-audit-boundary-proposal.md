# ADR-0013: Centralized audit-recording boundary proposal

**Status:** Proposed for review; not accepted. **Date:** 2026-11-10. Related scope: [issue #11](https://github.com/habibur5/COLDLINK/issues/11), ADR-0003, and ADR-0012.

## Context

The approved #11 scope requires an append-only audit record for every state-changing administrative action and for sensitive reads of payment, dispute, and ledger records. ADR-0003 separately requires audit records for authorization changes. These events originate in multiple domain areas. The current architecture assigns business rules and persistence to domain-owning modules, but does not assign a single owner for shared audit recording. The backend remains a scaffold; there is no existing implementation that settles this boundary.

The user has approved a centralized audit-recording boundary in principle, while explicitly leaving its module structure, ownership, and implementation unapproved.

## Proposal for review

### Ownership boundary

1. Keep each domain-owning service responsible for authorization context, business rules, state transitions, and the facts of its own changes. The audit mechanism records events; it does not decide whether an operation is valid or authorized.
2. Use one centralized append-only audit-recording boundary for required events across domains. Domain services submit records through that boundary instead of maintaining separate audit stores or relying on the admin module to reconstruct events after the fact.
3. **Do not assign the boundary to a module in this proposal.** A dedicated `audit` module is a candidate because audit recording and querying form a coherent, persistent capability; approval of the boundary does not approve creation of that module. The existing `admin` module is too narrow to own events from authorization, feature flags, and domain services. The `shared/` directory is not a suitable owner for audit policy or persistence under `.ai/06-module-rules.md`.
4. The audit boundary owns append-only persistence and audit-record queries. The caller/domain service supplies the validated event facts. Audit authorization and event requirements remain those of ADR-0003, ADR-0012, and issue #10; this proposal does not broaden which ordinary reads or domain changes must be audited.

### Event content and immutability

Required events contain the actor, action, target type and identifier, UTC timestamp, and reason when required. State-changing administrative events also contain the relevant before/after state. Sensitive-read events identify the actor, action, and target, but do not copy the viewed payment, dispute, or ledger payload into the audit record. DENY-grant and deletion reasons remain mandatory under ADR-0003; #11 booking lifecycle overrides require a reason.

Audit records are append-only. The application exposes no update/delete operation for them. The final schema and technical enforcement mechanism remain subject to architecture/schema review; this proposal does not select a database trigger, separate credential, or other technology.

### Transactional consistency proposal

- For a state-changing action whose state and audit record share the MariaDB database, the domain change and its required audit insert should commit in the **same database transaction**. The domain service supplies the event to the central recorder using the transaction boundary already used for that operation. This prevents a successful state change without its required record and prevents an audit entry for a rolled-back change.
- Capture before/after values from the state actually read and written by the domain operation, within that transaction; do not reconstruct them afterward in the admin layer.
- For sensitive reads, retrieve the authorized record and insert its audit event in a transaction; return the protected data only after the audit insert has committed.
- Current #11 financial controls are simulations and have no live external side effects. Any future operation that cannot share the database transaction with its external side effect requires a separate design decision; this proposal does not authorize an outbox, retry scheme, or live integration.

### Failure-handling proposal

- If a required audit insert fails during a state-changing operation, roll back the domain transaction and return a generic server failure. Do not report success or perform a fallback mutation without an audit record.
- If a sensitive-read audit insert fails, fail closed and do not return the protected record.
- Emit operational/security diagnostics for audit failures without recursively attempting to write the same failure to the unavailable audit store. Diagnostics must not contain credentials, tokens, or viewed financial/dispute payloads.
- Ordinary reads and permission-evaluation failures retain their existing logging behavior; this proposal does not turn them into audit events.

## Alternatives considered

- **Admin module owns all audit events:** rejected as the leading option because required events originate outside admin operations, and domain services must not rely on post-hoc reconstruction.
- **Each domain owns an independent audit store:** rejected because it fragments the append-only history, query surface, and enforcement policy.
- **Generic helpers in `shared/` own audit policy and persistence:** not recommended; this is a durable cross-domain capability, not merely reusable utility code, and `.ai/06-module-rules.md` forbids using `shared/` as a business-logic dump.

## Decisions still required

Review and approve or revise the proposed transaction and failure semantics. Separately approve the module owner and module structure before adding a module, changing the architecture module list, or implementing audit recording. Until then, audit ownership and implementation remain unresolved and blocked.
