# ColdLink — Reconciled Data-Model Decisions

**Status:** Reconciled conceptual/logical model for human review; not a physical schema or implementation contract.
**Scope:** Apply accepted ADRs, closed decisions, the approved current clarifications recorded in ADR-0014/0015, and existing project requirements. No Prisma models, migrations, source code, or diagrams are specified here.

## 1. Scope and source-of-truth hierarchy

This document and `.ai/10-DB-SCHEMA.md` describe a planned conceptual model. They do not claim that planned business features are implemented. The current Prisma schema contains only generator/datasource configuration; business modules, domain models, and migrations remain unimplemented per `.ai/09-feature-progress.md`.

Use sources in this order:

1. Accepted ADRs and explicitly closed decision outcomes, including later amendments.
2. Approved requirements and canonical vocabulary in `CONTEXT.md`.
3. Architecture and API documentation, where compatible with higher-priority decisions.
4. Compatible details from the legacy schema draft only after review; `.ai/10-DB-SCHEMA.md` is not an implementation contract.
5. Existing code as evidence of implementation status, not as authority to replace approved requirements.

ADR-0014 supersedes ADR-0001's split-fulfillment design for V1. ADR-0015 clarifies the scope of sandbox payment attempts without changing the no-real-money boundary. ADR-0002 remains authoritative for vehicle service areas and route feasibility. ADR-0005/0014 govern provider/resource verification and resource lifecycle.

### Labels

- **Confirmed** — an approved requirement or accepted decision.
- **Proposed model** — a simple logical representation of confirmed behavior; not a physical schema decision.
- **Unresolved** — no approved source settles the choice. It remains open even if one option is recommended.

## 2. Confirmed domain entities and responsibilities

### Identity and authorization

- **User** — account identity; no fixed account type.
- **Farmer profile / Provider profile** — optional domain profile associated with one User. A User may hold both. Profiles grant no authority.
- **Session / token record / contact history** — follow ADR-0011: multiple revocable Sessions; hashed refresh-token history; verified email requirement; preserved contact-change history.
- **Role** — editable named permission collection. Seeded roles include `user`, `admin`, `farmer`, `provider`, and `staff`; `user` is the ordinary registration baseline. Names grant no authority.
- **Permission catalog, role-permission assignment, user-role membership, direct user permission assignment** — explicit authorization records. Direct assignments have ALLOW or DENY effect; applicable DENY wins, otherwise ALLOW, otherwise deny.

Permissions attach only to Roles and Users. No structural account-type roles, provider-scoped permissions, global permission scope, or global wildcard.

### Providers, verification, and resources

- **Provider account/profile** — one User may request/hold storage capability, transport capability, or both and may own multiple facilities and vehicles.
- **Service application / capability request** — one initial application per User; each requested capability has an independent decision. Later support-mediated capability additions remain linked to the original history.
- **Evidence and review history** — evidence submissions, requests for information, review attempts, decisions, reasons, and history for capability or resource decisions. Evidence categories are admin-configurable. Issue #20 is closed as not planned; there is no regulator integration or assertion that particular documents are legally required.
- **Storage facility / Vehicle** — each resource belongs to exactly one Provider account. Shared ownership and transfers between Provider accounts are not supported in V1.
- **Resource verification** — verification belongs to one individual facility or vehicle, independently of provider capability approval. One verified resource can operate while others are incomplete or pending review.
- **Resource update proposal** — details requiring review for an already verified resource remain staged; its previously approved details remain effective while pending. Approval replaces them; rejection leaves them unchanged. The staged-update record shape is proposed, not physically selected.
- **Resource status** — `active`, `suspended`, or `deactivated`, separate from verification and ordinary availability. Administrators can activate, suspend, deactivate, and reactivate individual resources. Only complete, verified, active resources receive new requests. Suspension/deactivation does not automatically cancel accepted bookings, which may still be fulfilled. Reactivation restores active status and does not itself trigger re-verification; independently applicable evidence requirements remain.
- **Facility-crop configuration / storage capacity allocation** — crop compatibility, per-crop capacity/price/availability, and dated capacity use.
- **Vehicle service area / vehicle availability block** — one circular area per vehicle; dated vehicle commitment/manual block. No provider-level area.
- **Crop / Farm location** — V1 English-only crop catalog; each Farmer may own reusable Farm locations, each belonging to exactly one Farmer. A Farm location holds farm address/coordinates, not the general User Profile.

### Demand, recommendation, and fulfillment

- **Service request** — one crop, one quantity, and exactly one of three supported service types: storage-only, transport-only, or storage plus transport. Quantities use units appropriate to the product or service (for example, kg or ton); there is no universal unit. Each quantity/capacity comparison must use compatible units; physical unit-definition representation is unresolved.
- **Recommendation** — persisted, expiring, ranked complete alternative. Each Recommendation independently meets the whole requested quantity:
  - Storage-only: exactly one cold-storage facility capable of storing the full requested quantity for the full requested storage period; no vehicle.
  - Transport-only: exactly one vehicle capable of handling the full requested quantity; no facility.
  - Storage plus transport: exactly one facility and exactly one vehicle, each capable of the full requested quantity; the facility covers the full requested storage period.
  - When both resources are used, they may have different Provider owners.
  - Multiple Recommendations are alternative complete solutions and are never combined. No quantity slots, split fulfillment, multiple facilities, or multiple vehicles per Recommendation.
- **Booking** — commitment to one selected complete Recommendation, for one crop and quantity, with agreed prices snapshotted. Storage dates, where applicable, follow the approved inclusive calendar-day rule.
- **Booking fulfillment** — follows the selected Recommendation's service type: storage-only has exactly one facility and no vehicle; transport-only has exactly one vehicle and no facility; combined service has exactly one of each. Every selected resource covers the full requested quantity; the facility and vehicle may have different Providers. Storage capacity eligibility/allocation uses the same requested storage period and inclusive calendar-day interpretation from recommendation through booking. In accepted dispute/finance rules, a service component means either fulfillment aspect; this does not require a separate generic component entity. Do not model repeated fulfillment slots or multiple child components of the same service type.
- **Basic booking/fulfillment status** — retain only the basic status vocabulary already in architecture/API docs. The complete lifecycle and expanded deadlines in issue #15 are deferred beyond V1. ADR-0009's provider-failure replacement and pricing/refund policy remains approved; detailed replacement-attempt structure is not modeled here.
- **Review** — optional rating of a fulfilled component; no review-based ranking in V1.

Matching is deterministic. Eligibility precedes ranking. Storage has no service-area gate. Transport checks the individual vehicle's circular service area. Route feasibility is a separate binary signal; distance is a ranking factor, not a universal hard gate.

### Payments, disputes, and academic finance

- **Payment attempt** — one-time sandbox attempt using bKash Tokenized Checkout or SSLCommerz Hosted Checkout. Initiation is authenticated and ownership is validated; the attempt stores the approved merchant/provider references, amount, currency, status, and timestamps. Provider callbacks are correlated to the durable attempt and verified authoritatively against its references and payment facts. The exact persisted relationship to the initiating User and to the payment obligation remains unresolved; no direct Booking relationship is approved. An attempt/callback does not itself change booking or finance state.
- **Dispute / response / evidence / decision history** — one completed component per dispute, with provider response/evidence and reasoned decision/history. It holds only that component’s unpaid modeled provider amount. A late Support-filed dispute does not undo Completed.
- **Refund** — component-scoped internal simulated workflow. No production refund endpoint is called.
- **Commission configuration/snapshot; Ledger entry; Provider ledger/modeled balances; settlement hold; modeled settlement; withdrawal request; penalty and appeal; installment/extension/overstay records** — persisted academic workflows under ADR-0008/0009/0010. Ledger entries are immutable; corrections use compensating entries. Pending and Available are modeled balance concepts; whether their current totals are derived from ledger entries or persisted separately is not decided.

Under ADR-0015, applicable booking/down-payment obligations, subsequent storage installments, simulated penalty collections, and other applicable customer payment obligations use one-time sandbox attempts. No recurring provider agreement, live debit, actual collection, custody, refund, withdrawal, or settlement transfer is permitted. Refunds, provider withdrawals, and settlements remain internal simulations. The owning domain workflow records modeled outcomes after verified attempt results; Payment does not mutate domain state.

### Platform and communication

- **Feature flag / override** — availability only, distinct from permission. Regular flags support global/custom-role/provider/user scopes and approved precedence; provider scope targets the User ID. Maintenance mode is global-only. Archival permanently disables/reserves the key and retains ignored overrides.
- **Platform setting** — only approved policy values; snapshot at the point specified by the policy.
- **Central audit event** — single append-only recording/retrieval boundary for required authorization changes, administrative state changes, and specified sensitive reads. Required state-change audit is in the same transaction; sensitive-read audit precedes returning protected data.
- **Notification / request live channel / Job / Idempotency record** — keep persisted notifications, separate live request room, deferred work, and approved idempotency behavior.

## 3. Confirmed relationships and cardinalities

| Relationship | Cardinality / constraint | Status |
|---|---|---|
| User–Farmer profile; User–Provider profile | Each profile belongs to one User; one User may have both or neither. | Confirmed; subtype table layout proposed. |
| Provider–Storage facilities | One Provider owns zero or more; each Facility has exactly one Provider owner. | Confirmed, ADR-0014. |
| Provider–Vehicles | One Provider owns zero or more; each Vehicle has exactly one Provider owner. | Confirmed, ADR-0014. |
| Provider–capability requests | One account may request/hold both capabilities; decisions are independent. | Confirmed, ADR-0005/0014. |
| Facility/Vehicle–Resource verification | Each individual resource has its own verification decision/history. | Confirmed, ADR-0005/0014. |
| Resource–pending update | A reviewed proposal does not replace the active approved details until approved. | Confirmed behavior; representation proposed. |
| Vehicle–service area | One circular area per vehicle in V1. | Confirmed, ADR-0002. |
| Facility–Crop | Many-to-many via one facility-crop configuration per pair. | Confirmed, ADR-0001 and compatible schema detail. |
| User–Roles–Permissions | Many-to-many through user-role and role-permission assignments; direct user ALLOW/DENY assignments also exist. | Confirmed, ADR-0003. |
| Application–capability decisions | Initial application includes one or both independent requested capabilities; later additions link to original history. | Confirmed, ADR-0005. Physical nesting proposed. |
| Farmer–Farm location | One Farmer may own zero or more reusable Farm locations; each location belongs to exactly one Farmer and stores farm address/coordinates. | Confirmed; farm-specific location data is not duplicated in the general User Profile. |
| Request–Farm location/Crop | Each request references one Crop and one Farm location owned by that Farmer. | Confirmed. |
| Service request–service type | Exactly one of storage-only, transport-only, or storage plus transport. | Confirmed by user decision. |
| Request–Recommendations | One request may have multiple complete alternative recommendations. | Confirmed, ADR-0014. |
| Recommendation–facility / vehicle | Storage-only: exactly one facility and no vehicle. Transport-only: exactly one vehicle and no facility. Combined: exactly one of each. Every selected resource covers the full requested quantity. Physical table name: `recommendations`. | Confirmed by user decision, ADR-0014, and naming decision. |
| Booking–Recommendation | One Booking commits to one selected Recommendation. | Confirmed. Reverse cardinality not fixed beyond booking selection. |
| Booking–storage fulfillment | Exactly one for storage-only or combined service; none for transport-only. Uses one facility for the full requested quantity. | Confirmed by user decision and ADR-0014. |
| Booking–transport fulfillment | Exactly one for transport-only or combined service; none for storage-only. Uses one vehicle for the full requested quantity. | Confirmed by user decision and ADR-0014. |
| Storage fulfillment–facility-crop config / allocation | One selected config and a dated capacity allocation covering the same inclusive storage period used by the Recommendation and Booking. | Confirmed inclusive-day rule; physical FK/index shape proposed. |
| Transport fulfillment–Vehicle / availability block | One selected Vehicle and its applicable time block. | Confirmed; physical FK/index shape proposed. |
| Component–Dispute | Each dispute concerns exactly one component. | Confirmed issue #8 decision. |
| Provider/service–commission configuration | Centrally managed percentage rate per provider and service, with explicitly recorded negotiated exceptions; applicable rate is snapshotted when booking price is agreed. | Confirmed, ADR-0008/#4. Uniqueness and exception precedence are unresolved. |
| Provider ledger–entries / modeled balances | Ledger entries are immutable and append-only; Pending and Available totals may be derived from entries or persisted separately. | Immutable entries confirmed; balance representation unresolved. Simpler derivation is proposed, not approved. |
| Feature flag–overrides | Approved scopes only; archive retains but ignores override rows. | Confirmed issue #10. |
| Audit event–actor/target | Central event with actor where applicable and target type/id; target may be polymorphic. | Confirmed ADR-0013; physical shape proposed. |
| PaymentAttempt–initiating User | Payment initiation is authenticated and ownership must be validated; whether the durable attempt stores a direct User FK or another ownership reference is not specified. | Behavior confirmed; persistent relationship unresolved by ADR-0006/#19. |
| Provider callback–PaymentAttempt | Correlate callback/return/IPN to the durable attempt using its stored provider/merchant references, then verify authoritatively. | Confirmed behavior, ADR-0006 and #19; exact schema/index details remain implementation choices. |
| PaymentAttempt–payment obligation / Booking | No direct Booking FK, polymorphic target, or other obligation association is approved. The owning domain workflow consumes the verified attempt result without Payment directly mutating booking/finance state. | Unresolved by ADR-0006/#19 and ADR-0015. |

## 4. Required invariants

- Permission authorization is independent of profile, capability, verification, resource status, and feature availability.
- No fixed account type, authority from role names, provider-scoped permissions, or shared/transferable resource ownership.
- One resource has exactly one Provider owner; an account can own multiple facilities/vehicles and offer both capabilities.
- Incomplete, unverified, suspended, or deactivated resources receive no new requests. Accepted bookings are not automatically cancelled by resource suspension/deactivation.
- During a reviewed resource update, prior approved details remain effective until approval; rejection preserves those details.
- A storage-only Recommendation uses exactly one full-quantity facility and no vehicle; a transport-only Recommendation uses exactly one full-quantity vehicle and no facility; a combined Recommendation uses exactly one of each, each covering the full quantity. Recommendations are never combined.
- A Booking commits to one complete Recommendation and has fulfillment cardinality determined by its service type: one facility, one vehicle, or one of each. No fulfillment is split across multiple resources. Capacity remains transactionally protected under existing storage rules.
- V1 lifecycle design stays basic; issue #15's expanded replacement/deadline state machine is deferred. ADR-0009's approved replacement policy remains in force for applicable academic refund calculations.
- Sandbox attempts require authoritative verification and do not themselves mutate booking or academic finance state.
- Financial records use integer poisha where applicable, are academic/non-custodial, and remain append-only.
- V1 is English-only. Feature flags remain separate from permissions. Audit recording is centralized and append-only.

## 5. Proposed modeling choices

These are logical recommendations for future physical schema review, not table/column definitions. The `recommendations` physical table name is already settled:

1. One Recommendation record with resource references matching its service type: facility only, vehicle only, or one of each. Each referenced resource must cover the full quantity. No Bundle, Slot, or repeated fulfillment entities.
2. Represent the Booking as commitment to that Recommendation and its corresponding full-quantity fulfillment; do not add one-to-many booking components.
3. Keep currently approved resource details as effective details; store a pending proposed update separately until review resolution. Reuse existing evidence/review history rather than adding a generic workflow framework.
4. Keep resource verification status separate from operational `active`/`suspended`/`deactivated` status.
5. Use one shared audit event collection with polymorphic target metadata; no module-specific audit stores.
6. Keep ledger entries immutable and append-only. **Proposal for V1:** derive Pending and Available totals from ledger entries rather than persist duplicate aggregate totals. This is the simpler approach for the academic project; it is not an approved decision. Alternatively, persist balance totals separately and maintain consistency with the immutable ledger, which adds synchronization and reconciliation responsibility.
7. Keep authenticated initiation, ownership validation, durable-attempt callback correlation, and authoritative verification as confirmed behavior. Do not invent the persistent initiating-User relationship or a Booking/obligation association; their exact schema relationships remain unresolved.

## 6. Resolved and unresolved matters

### Resolved by approved requirements

- **Request types and recommendation cardinality:** storage-only uses exactly one full-quantity facility; transport-only uses exactly one full-quantity vehicle; combined uses exactly one of each, each covering the full quantity. Alternatives are never combined.
- **Provider ownership:** one owner per resource, multiple resources per provider, no sharing or transfers; one account may offer both capabilities.
- **Resource update and status:** staged reviewed updates preserve approved details; active/suspended/deactivated status is separate; existing bookings continue; reactivation alone adds no verification.
- **Quantity and location:** use compatible product/service units with no universal unit; farm addresses/coordinates belong to Farm location, not User Profile.
- **Storage duration:** inclusive calendar-day counting for storage calculations only.
- **Legal evidence:** issue #20 closed as not planned; manual admin review with configurable categories and no legal assertions/regulator integration.
- **Baseline roles:** editable seeded permission collections, with `user` as registration baseline; no role-name authority.
- **Feature flags:** archive semantics and approved scope/precedence are defined in issue #10; physical archive field remains a schema choice.
- **Recommendation table name:** physical table name is `recommendations`; canonical domain term is Recommendation.
- **Issue #15:** expanded state-machine scope is deferred beyond V1; basic statuses remain.

### Still unresolved

| Question | Impact and minimal recommendation |
|---|---|
| PaymentAttempt ownership and obligation association | Authenticated initiation, ownership validation, durable callback correlation by stored references, and authoritative provider verification are approved. The exact persisted User ownership relation and any relation to a Booking/payment obligation are not approved. Do not add a direct Booking FK or polymorphic target without approval. |
| Resource update/evidence history shape | Staged update behavior is confirmed; separate update record versus versioned pending payload remains a physical modeling choice. Keep it simple and preserve history. |
| Physical unit representation | No universal unit; exact enum/catalog/documented convention is not specified. |
| Provider balance representation | ADR-0008 defines Pending/Available modeled balances and ledger-based balance transitions; #21 requires persisted ledger entries, balance transitions, and required balance/withdrawal state. Neither source selects whether current totals are derived from immutable ledger entries or persisted separately. **Proposal:** derive totals from ledger entries for simpler V1 consistency; this requires approval. The alternative is separately persisted totals maintained consistently with ledger entries. |
| Commission configuration | Immutable ledger is approved; physical uniqueness and exception-precedence model remain open. |
| Settings catalog | Use only values already approved by ADRs; unresolved names/defaults must not be added by inference. |
| Feature flag archive field / audit physical shape | Semantics are approved; timestamp/status and audit FK/integrity implementation are not. |
| Issue #15 details | Full replacement and deadline state machine remains deferred; ADR-0009's approved provider-failure replacement valuation remains in force. Do not make the expanded state machine a V1 schema blocker. |

## 7. Document-by-document reconciliation

The following documents were updated in this task; see the git diff for exact edits:

- `.ai/10-DB-SCHEMA.md` — replaced legacy table draft with the reconciled conceptual model, adopted the settled `recommendations` table name, and retained explicit unresolved items.
- `CONTEXT.md` — replaced Bundle/Slot language, defined complete Recommendation and resource ownership/status/update/payment terms, and marked deferred lifecycle vocabulary.
- `.ai/00-PROJECT_OVERVIEW.md`, `.ai/01-architecture.md`, `.ai/05-api-standards.md` — aligned matching cardinality, booking limits, provider/resource rules, basic statuses, and payment scope.
- `.ai/04-database-prisma.md` — clarified conceptual model is not a Prisma contract.
- `.ai/06-module-rules.md`, `.ai/11-project-schedule.md`, `.ai/12-development-strategy.md`, `.ai/09-feature-progress.md` — aligned module/grade/deferred-scope descriptions without claiming implementation.
- `.ai/payment-sandbox-scope.md`, ADR-0006, ADR-0009, ADR-0010, `.ai/admin-console-permission-proposal.md`, ADR-0012 — clarified applicable sandbox collection attempts while preserving simulated/no-real-money boundaries.
- ADR-0001 — retained as historical record, prominently superseded for V1 split fulfillment by ADR-0014.
- ADR-0002 and ADR-0005 — aligned route/service-area and provider/resource verification/update/status decisions with ADR-0014.
- New ADR-0014 — complete recommendations, provider/resource ownership, resource update/status boundaries, and basic V1 lifecycle scope.
- New ADR-0015 — sandbox attempt applicability for V1 obligations, no direct domain side effects, and unresolved attempt association.

GitHub issue bodies #15, #19, and #23 were inspected but not edited. They remain historical/tracker records; their implementation scope should be reconciled separately before they are used as current acceptance criteria where their wording conflicts with ADR-0014/0015.

## 8. Traceability matrix

| Decision | Source |
|---|---|
| All three complete non-split request types: storage-only uses exactly one full-quantity facility; transport-only uses exactly one full-quantity vehicle; combined uses exactly one of each, each covering the full quantity | Current user decision; ADR-0014; ADR-0001 marked historical/superseded |
| One provider owner per resource; multiple facilities/vehicles; no sharing/transfer; both capabilities allowed | ADR-0014; ADR-0005 |
| Capability application and resource-specific verification/evidence history | ADR-0005; issue #7; ADR-0014 |
| Resource staged updates and active/suspended/deactivated behavior | ADR-0014; approved current requirement |
| Vehicle-owned circular area; no storage radius; route feasibility separate | ADR-0002; glossary |
| Roles, membership, role grants, direct ALLOW/DENY; no role-name authority | ADR-0003; issue #9; glossary |
| Sandbox attempts required for applicable booking/down-payment, installment, penalty, and other customer obligations; no real funds | ADR-0015; ADR-0006; ADR-0008–0010; issue #19 sandbox adapter decision |
| Authenticated initiation, ownership validation, durable-attempt callback correlation, and authoritative verification; Payment does not mutate domain state | ADR-0006; ADR-0015; issue #19 |
| Exact persisted initiating-User relation and payment-obligation/Booking association remain unresolved; no direct Booking FK or polymorphic target approved | ADR-0006 consequences; ADR-0015 decision 6; issue #19 |
| Immutable academic ledger and modeled Pending/Available transitions; no approved choice between derived and separately persisted balance totals | ADR-0008; ADR-0009; GitHub issue #21 implementation criteria |
| Component-scoped disputes and isolated modeled hold | Closed issue #8; glossary; ADR-0012 |
| Central append-only audit | ADR-0013; ADR-0012 |
| Feature flags separate from permissions; scopes, precedence, archival | Closed issue #10; glossary |
| Basic V1 statuses; full lifecycle deferred | ADR-0014; issue #15 (open/deferred) |
| Inclusive storage-day calculation; unit-appropriate quantities; Farm location owns farm address/coordinates | ADR-0001 and ADR-0009; `.ai/10-DB-SCHEMA.md` resolved decisions; glossary |
| English-only V1; no translation tables | ADR-0010; glossary |
| No asserted legal document checklist or regulator integration | ADR-0005 amendment; issue #20 closed as not planned |

## 9. Verification boundary

This reconciliation changes documentation only. It does not implement matching, resource registration, verification, payment processing, booking lifecycle, finance workflows, Prisma models, or migrations. Final physical schema/ER design must preserve the confirmed cardinalities above and leave unresolved matters visibly unresolved until approved.
