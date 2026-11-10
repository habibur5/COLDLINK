# ColdLink — Proposed Data-Model Reconciliation

**Status:** Proposed conceptual/logical model for review; not an implementation contract.
**Scope:** Reconcile approved domain decisions for future schema work and ER documentation. No Prisma models, migrations, or diagrams are specified here.

## 1. Scope and source-of-truth hierarchy

This document reconciles approved ColdLink V1 concepts and identifies logical relationships needed to represent them. It does not authorize new behavior, settle open product decisions, or prescribe physical database structures.

Use sources in this order when reconciling conflicts:

1. Accepted ADRs and closed decision outcomes for the subject.
2. `CONTEXT.md` for canonical domain language and explicitly superseded concepts.
3. Current approved architecture and API documents for module ownership and interaction boundaries, subject to higher-priority decisions.
4. `.ai/10-DB-SCHEMA.md` only for compatible details that have been reviewed and resolved. It is a planning reference, explicitly not migration-ready.
5. Current code only to describe implementation status, not to overturn an approved design decision.

GitHub issue #1 is a decision map and contains both accepted decisions and historical/reconciled content. For its statements, follow the linked accepted ADRs and closed issue outcomes. Open issues—including #15—remain unresolved. Proposed relationships below are modeling recommendations, not silent decisions.

### Status labels

- **Confirmed requirement** — explicitly established by an accepted ADR, closed decision, or glossary.
- **Proposed model** — a reviewable way to represent confirmed concepts and relationships; not yet a physical schema decision.
- **Unresolved** — source material leaves the decision open or assigns it to a later decision/implementation task. Do not infer a final relationship or state model.

## 2. Confirmed domain entities and responsibilities

The names below describe domain records, not classes. Modules retain the existing domain-oriented modular-monolith architecture; this model does not introduce OOP patterns or new architectural services.

### Identity, access, and contacts

| Entity/concept | Responsibility and confirmed boundary |
|---|---|
| **User** | A person’s account; no fixed account type. A User may have multiple profiles and activities. V1 account use requires verified email. |
| **Session** | One authenticated context for a User. Multiple active Sessions are allowed; revocation ends authenticated access immediately. |
| **Authentication token record** | Stores token hashes and lifecycle metadata; refresh tokens are linked to a Session and rotation history is preserved. Raw tokens are not persisted. |
| **Contact history** | Preserves prior email/phone values and verification/change history. A historical contact does not prove present ownership or merge accounts. |
| **Profile** | Domain-specific information for an activity, such as farmer or provider. A profile grants no permission. A User may have several. |
| **Role** | An editable, named collection of permissions. Its name carries no authority. The seeded baseline role is not an account type. |
| **Permission** | A catalogued atomic resource/action key. The catalog is seeded/versioned; new keys are not automatically granted. |
| **Role permission assignment** | Associates a Permission with a Role. |
| **User role membership** | Associates a User with a Role. Registration assigns the approved baseline role. |
| **Direct user permission assignment** | Associates a User with a Permission and an ALLOW or DENY effect. Applicable DENY wins; otherwise an ALLOW grants access; otherwise access is denied. |

Permissions attach only to Roles and Users. There are no provider-scoped or global Permission assignments and no global wildcard. Party scope and `.any` are authorization semantics, not separate ownership entities.

### Provider onboarding, capability, and supply

| Entity/concept | Responsibility and confirmed boundary |
|---|---|
| **Service application** | A User’s initial request to offer one or more service types. Later capability additions are separate support-mediated requests linked to the original history. |
| **Capability request / provider verification decision** | Records the independent decision for each requested service capability. Approval of one capability does not decide another. Application outcome is derived from its requested decisions. |
| **Evidence record** | Represents submitted evidence for a capability or a specific resource, including applicable expiry/material-change information. Legal applicability must follow confirmed policy, not assumptions. |
| **Review/history record** | Preserves review attempts, information requests, resubmissions, decisions, reasons, and relevant actor/time history. Rejected evidence history is not overwritten by a new attempt. |
| **Crop** | Catalog product stored or transported; V1 is English-only. |
| **Storage facility** | Physical storage destination owned/operated by a provider. It has no service-area radius. |
| **Facility crop config** | Facility/crop pairing with capacity ceiling, price per unit per day, and ordinary availability toggle. Its existence establishes crop compatibility in V1. |
| **Vehicle** | Provider-owned transport resource. Vehicle type, suitability, capacity, availability, verification, and service area are evaluated per vehicle. |
| **Vehicle service area** | One declared circular area per vehicle in V1. It is not a provider-level service area. |
| **Resource verification** | Evidence decision for one facility or vehicle, independent of provider capability approval. |
| **Capacity allocation / vehicle availability block** | Records dated storage commitment or transport commitment/manual block. Capacity and availability remain separate from verification and permission. |

Marketplace visibility requires the applicable approved capability and independently verified, active resource, as well as permission, ownership/party, eligibility, and ordinary business-state checks. None substitutes for another.

### Demand, recommendation, and fulfillment

| Entity/concept | Responsibility and confirmed boundary |
|---|---|
| **Farm location** | Reusable location belonging to a farmer profile. Whether old default coordinates remain on the profile is unresolved in `10`. |
| **Service request** | Farmer’s need for one crop, one quantity, and storage, transport, or both. Multi-crop requests are out of V1 scope. |
| **Bundle recommendation** | Persisted, expiring complete fulfillment option for a request. Feasible bundles are ranked; matching is deterministic/heuristic, not exhaustive or AI/ML. |
| **Recommendation slot** | One storage or transportation portion of a Bundle, with its fulfilled quantity and referenced facility or vehicle. Multiple slots may be needed to cover the full request. |
| **Booking** | Farmer’s commitment to one selected bundle; agreed prices are snapshotted and not recalculated. |
| **Storage component** | A storage side of a booking, fulfilled by a facility/crop configuration for a portion of requested quantity. |
| **Transportation component** | A transport side of a booking, fulfilled by a vehicle for a portion of requested quantity. |
| **Milestone / status history** | Milestones are dated delivery points; statuses are lifecycle states. They are distinct concepts. Milestone and transition details must follow the accepted lifecycle decision when complete. |
| **Review** | A rating/review associated with one fulfilled component. Reviews are optional and do not affect V1 ranking. |

The recommendation records both the complete bundle and its constituent slots. A booking may have multiple storage and/or transportation components; a single parent booking is not limited to one child of each type.

### Payments, disputes, and academic finance

| Entity/concept | Responsibility and confirmed boundary |
|---|---|
| **Payment attempt** | Durable record of an attempt through a supported sandbox provider, with integer poisha amount and provider/reference/status/timing data. Verification is authoritative; redirects alone do not establish success. Payment attempt status does not change booking lifecycle. |
| **Dispute** | Challenge to one component that has reached its completion milestone. It holds only that component’s unpaid provider payable; it does not itself reverse completed status under the approved late-dispute rule. |
| **Dispute response/evidence/history** | Preserves provider response, optional evidence, review/decision and history. Providers may respond but cannot resolve disputes. |
| **Refund record** | Component-scoped academic workflow calculated from delivered value and booking snapshots. Submission and confirmation are distinct simulated actions; no production refund is sent. |
| **Commission configuration/snapshot** | Percentage rate by provider and service, including explicitly recorded negotiated exceptions; the applicable rate is snapshotted when booking price is agreed. |
| **Ledger entry** | Immutable academic financial event. Corrections are compensating entries, not edits. Entries model events and balances, not custody or real funds. |
| **Provider ledger / modeled balance** | Per-provider academic record of Pending and Available modeled amounts and adjustments. Pending is non-withdrawable; Available is not cash or a claim on held money. |
| **Settlement hold / modeled settlement** | Represents eligibility, hold, and approved modeled state transitions. No payout instruction or actual settlement occurs. |
| **Withdrawal request** | Provider request for a simulated workflow from modeled Available balance; authorized admin approval is required before the modeled outcome is marked settled. No external transfer occurs. |
| **Penalty / appeal** | Penalty is an assessed modeled receivable only after applicable review. Provider appeal has its own status/history; pending appeal pauses simulated collection. Waivers, reductions, and collections are compensating/auditable entries. |
| **Installment / extension request / overstay record** | Storage-booking-only academic workflows under ADR-0010. Collection is simulated; overstay and deemed return do not imply physical return or real debt collection. |

No licensed custodian, Trust Cum Settlement Account, real-money payable, live refund, or actual payout entity is part of this project’s approved model.

### Platform operations and communication

| Entity/concept | Responsibility and confirmed boundary |
|---|---|
| **Feature flag** | Controls feature availability, not authorization. An operation requires both the feature condition and permission. Flag keys are unique and immutable; archive is permanent, disables the flag, reserves its key, and retains overrides which are ignored. |
| **Feature-flag override** | Applies only to approved global/custom-role/provider/user scopes. Provider scope targets the User ID and affects provider-side availability only. Maintenance mode is global-only. This is distinct from Permission assignment. |
| **Platform setting** | Approved configurable policy value. Effective values are snapshotted at the process point specified by the owning policy. Do not add unapproved settings or policies. |
| **Audit event** | Centralized append-only record for approved authorization changes, administrative state changes, and specified sensitive reads. A required audit write shares the transaction with a state change; a sensitive-read audit occurs before returning data. |
| **Notification** | Persisted user message; persistence precedes optional live delivery. A request-scoped live channel for recommendations is distinct from the per-user notification channel. |
| **Job** | Deferred work such as expiry sweeps, retention, notification delivery, and approved academic simulations. It must not block the triggering request. |
| **Idempotency record** | Supports idempotent create/payment operations per approved API/ADR requirements. Exact endpoint-specific payload and relationship details follow the corresponding contract. |

## 3. Proposed relationships and cardinalities

Cardinalities below are conceptual. **Confirmed** marks relationships required by decisions; **proposed** identifies a clean logical representation whose exact physical form remains open. Optionality can depend on lifecycle state and must not be interpreted as permitting an invalid business state.

| Relationship | Cardinality / rationale | Status |
|---|---|---|
| User — profiles | One User may have zero or more Farmer/Provider profiles; each profile belongs to one User. Profiles do not imply permissions. | Confirmed domain rule; profile subtype details are a model choice. |
| User — Sessions — refresh-token records | One User has many Sessions; one Session has token history; refresh-token record references its Session. Verification/reset tokens belong to a User and need not reference a Session. | Confirmed, ADR-0011. |
| User — contact history | One User has many historical contact records. Current contacts remain on User; historic contacts do not establish identity. | Confirmed, ADR-0011. |
| User — direct permission assignment — Permission | A User may have many direct assignments; each references one catalog Permission and stores ALLOW or DENY. | Confirmed, ADR-0003. |
| User — role membership — Role — role-permission assignment — Permission | Many-to-many through explicit assignment records. This separates membership from permission grants and supports editable permission collections. | Confirmed, ADR-0003; `10` is incomplete. |
| User — Service application | One initial application per User; later capability additions are separate support-mediated requests linked to original application history. | Confirmed, ADR-0005. Exact representation of later request history is a model choice. |
| Service application — capability requests | One application contains one or more independently decided capability requests. Each decision is for one capability. | Confirmed, ADR-0005. |
| Capability request — evidence/review history | Evidence and review attempts attach to the capability request and preserve prior submissions/decisions. | Confirmed need; evidence granularity and record split are proposed. |
| Provider capability — resources | A capability may relate to multiple resources; each resource requires its own verification and is not listed until both gates pass. | Confirmed rule; whether capability-resource relation is stored explicitly or derived from owner/capability is unresolved. |
| Provider profile — facilities/vehicles | A provider may own multiple facilities and vehicles; each belongs to its provider. | Confirmed domain structure. |
| Vehicle — service area | One vehicle has one circular declared service area in V1. A service area belongs to exactly one vehicle. | Confirmed, ADR-0002. |
| Facility — facility crop config — Crop | Facility and Crop have a many-to-many relationship through one config per facility/crop pair. | Confirmed, ADR-0001 and `10`; storage compatibility is config existence. |
| Facility crop config — storage allocations | One config has many dated allocations. Each allocation consumes that config’s capacity for a period and relates to its storage component. | Confirmed capacity model; transaction/locking rules in `01`/ADR-0007. |
| Vehicle — availability blocks | A vehicle has many dated blocks; a booking component may be associated with a block. Manual blocks need not identify a booking. | Confirmed in `10`; exact status/association follows lifecycle. |
| Farmer profile — farm locations | One farmer profile may have multiple reusable locations; each location belongs to one farmer profile. | Confirmed concept; profile field duplication unresolved in `10` S3. |
| Service request — Crop / farm location | Each request references one Crop and one Farmer location and records one requested quantity. | Confirmed, ADR-0001 and glossary. |
| Service request — bundle recommendations | One request may produce multiple persisted, expiring Bundle recommendations. | Confirmed, ADR-0001. |
| Bundle recommendation — recommendation slots | One bundle contains one or more slots; each slot describes a portion and one storage or transport resource. Combined slots must cover the requested quantity in full. | Confirmed domain rule; table/slot type design proposed. |
| Recommendation slot — facility or vehicle | A storage slot identifies a facility/crop config; a transport slot identifies a vehicle. One slot must not ambiguously identify both. | Confirmed slot meaning; use of separate subtype records vs nullable references is a modeling choice. |
| Booking — Service request / selected Bundle | A booking belongs to one request and commits to one selected complete Bundle. | Confirmed, ADR-0001/glossary. Exact persistence link to bundle is expected but schema representation is proposed. |
| Booking — storage/transport components | One booking may contain multiple storage components, multiple transport components, either type absent where not requested. Each component is fulfilled independently by one provider/resource and has its own status/milestones. | Confirmed, ADR-0001 and glossary; lifecycle constraints remain subject to #15. |
| Component — capacity/availability commitment | Each storage component consumes the appropriate facility-crop allocation; each transport component reserves the relevant vehicle availability. | Confirmed concept; exact timing and transitions partly dependent on #15. |
| Component — milestones / status history | Component has dated milestones distinct from status; status transitions have history. | Confirmed distinction; exact states/transitions unresolved under #15. |
| Component — dispute | A dispute concerns exactly one component; a component may have dispute history, with active-dispute uniqueness/state rules from the accepted dispute decision. | Confirmed issue #8 outcome; precise uniqueness/history representation is proposed. |
| Dispute — responses/evidence/decisions | One dispute may have provider responses and evidence, and reasoned resolution/history records. | Confirmed concepts from issue #8; precise cardinality/append-only details should follow that outcome and lifecycle. |
| Component — refund | Refund evaluation/outcome is component-scoped; multiple records/events may be needed to preserve simulated workflow history. | Confirmed scope; whether one refund aggregate with transition history or multiple refund cases is unresolved. |
| Provider/service — commission rate and exception | Configuration may specify a provider/service rate and explicit negotiated exception; booking snapshots the effective rate. | Confirmed ADR-0008; precedence/uniqueness and physical representation are implementation details not fixed here. |
| Ledger entry — affected provider / financial reference | Entries identify modeled financial event and relevant provider/component/payment references as applicable. Corrections are new entries. | Confirmed append-only semantics; exact reference shape and balance derivation are unresolved implementation details. |
| Provider ledger — entries / modeled balances | Provider-level modeled ledger aggregates entries into Pending/Available concepts; no custodial account is implied. | Confirmed ADR-0008; whether balances are derived or separately persisted is unresolved. |
| Settlement hold — component/provider amount | Hold is tied to a component’s modeled provider share, with effective duration captured when it begins. | Confirmed ADR-0008; physical record cardinality can follow #21. |
| Withdrawal request — provider / settlement outcome | Provider requests a simulated withdrawal; admin approval precedes its modeled settled outcome. | Confirmed ADR-0008 and #21; exact state/history model is not specified here. |
| Penalty — appeal / ledger entries | A penalty can have appeal history and associated compensating ledger entries; simulated collection is recorded without actual collection. | Confirmed ADR-0009/#22; one-to-many/event representation is a model choice. |
| Payment attempt — User / other business record | Authenticated initiation requires verifiable ownership and callbacks need correlation, but the target relation is not decided. | **Unresolved** under ADR-0006 and #19. See §6. |
| Feature flag — overrides | A flag may have global default and approved scoped overrides. Custom-role, provider (User ID), and user scopes apply to regular flags; maintenance mode is global-only. | Confirmed issue #10. Override rows must not be modeled as permissions. |
| Audit event — actor / target | Event has an actor where applicable and polymorphic target type/id; target is not necessarily a database FK. State-changing events include relevant before/after values. | Confirmed ADR-0013; exact storage shape is a model choice. |
| User — notifications | A User may receive many persisted notifications; related entity is optional and polymorphic. | Confirmed glossary/architecture; logical reference is not necessarily an FK. |

## 4. Required constraints and invariants

These invariants are confirmed requirements, not suggestions to encode every rule as a database constraint. Which belong in database constraints versus owning-module services remains subject to `.ai/04` and implementation review.

### Identity, authorization, verification

- No structural account-type field or authority derived from a role name.
- Permission catalog is curated/versioned; no global wildcard. Permissions attach only to roles and users. DENY wins; default is deny. Cross-party access requires explicit `.any` permission.
- Email is required and verified before normal account functionality. Optional phone remains unverified and is not an authentication/recovery method in V1. Preserve contact history; do not merge accounts by historical contact match.
- Permission, capability approval, resource verification, ordinary availability, and suspension are separate concerns. Marketplace eligibility requires all applicable gates.
- A provider capability decision never verifies every facility/vehicle. Each facility/vehicle has its own resource verification history.

### Supply and matching

- `vehicle_service_areas` are vehicle-owned; V1 has one circular declared area per vehicle. Storage has no service-area/radius filter.
- A `facility_crop_config` establishes facility/crop compatibility. Storage eligibility includes crop compatibility, facility status, availability/capacity, and route feasibility.
- Transport eligibility is per vehicle and includes suitability, capacity, availability, that vehicle’s service area covering pickup, and route feasibility from pickup to destination.
- Route feasibility is a binary provider result; distance is a ranking factor, not a substitute eligibility threshold. No default universal maximum distance is approved by ADR-0002.
- Bundles cover the requested quantity in full and can have an unbounded number of slots; matching is heuristic and feasibility precedes ranking.
- Booking is one crop and one quantity, with one or more fulfillment components and immutable agreed-price snapshots. Capacity safety uses transactional locking per `facility_crop_configs` as described in `01` and ADR-0007.

### Lifecycle and finance

- Component status and dated milestone are distinct. Storage `Returned` is physical return; `Completed` is a separate lifecycle concept. Deemed return is not physical return.
- Dispute scope is one component. It holds only that component’s unpaid provider payable. A late Support-filed dispute does not undo a component’s already reached Completed state.
- Payment attempts are sandbox-only; authoritative provider verification is required. A verified attempt does not transition booking state.
- All financial values use integer poisha where specified. Financial records are academic/simulated; ColdLink does not custody, transfer, or settle real money.
- Ledger entries are append-only. Corrections, waivers, refunds, penalties, and settlement adjustments are represented by new auditable events/entries, not edits to prior financial history.
- Storage installment, overstay, and extension behavior applies only to storage bookings under ADR-0010. No live recurring debit or production collection is modeled.

### Platform and audit

- A feature flag controls availability; permission controls authorization. Both must pass. Provider-scoped flags target a User and do not grant capability, approval, verification, or permission.
- Archived flag keys remain reserved; overrides are retained but ignored. Maintenance mode is global-only.
- Audit records are append-only. Required audit writes for state changes share the state-change transaction; specified sensitive reads are audited before data return and fail closed if audit recording fails.
- V1 is English-only. Do not add translation entities or treat translated labels as identifiers/authorization values.

## 5. Confirmed decisions versus modeling proposals

### Confirmed

The conceptual entities and rules in §2, the confirmed relationships in §3, and invariants in §4 are grounded in accepted sources listed in §8. In particular, the role, area, bundle/slot, multi-component booking, centralized audit, English-only, and sandbox/simulated-finance boundaries are not open alternatives.

### Proposed modeling choices for review

1. Use explicit assignment records for User–Role membership, Role–Permission grants, and direct User–Permission ALLOW/DENY assignments. This maps the approved authorization sources without confusing membership and authority.
2. Represent each provider application’s requested capabilities as independently reviewable records; attach evidence and review attempts/history to the subject decision. This preserves the separate application, capability, and resource verification concepts without prescribing evidence file storage.
3. Represent recommendation Bundle and Slot as separate logical records. A Slot is typed storage or transport and points to exactly one eligible resource/configuration. Physical subtype tables versus a type discriminator are not selected here.
4. Represent Booking as a commitment to a selected Bundle, with multiple storage and transport components. Keep each component’s lifecycle and provider/resource association independent. Do not fix the final transition graph before #15.
5. Represent shared audit events in one logical append-only collection with actor and polymorphic target references, rather than separate admin/domain audit stores. Transactional guarantees are from ADR-0013; database enforcement mechanism remains undecided.
6. Represent feature-flag overrides separately from permission assignments and retain archived flag/override history. Do not create an authorization relationship from feature flag to permission.
7. Model ledger entries as immutable financial events and keep the question of derived versus separately persisted balances open. Do not name modeled balances “wallet,” “cash,” or “payable” in a way that implies custody.

These choices are suitable for review and future ER-level modeling, but should not be translated directly into Prisma until open matters in §6 are resolved or deliberately scoped out.

## 6. Unresolved decisions and impact on the future ER diagram

| Open question | Source/status | ER impact / choices not silently selected |
|---|---|---|
| **Complete booking/component state machine, replacements, deadlines, and actor/job transitions** | GitHub issue #15 remains open. Booking policy inputs exist across ADR-0005 and ADR-0008–0010; #15 is to consolidate lifecycle. | Do not finalize all status enums, transition history entities, replacement-attempt/offered-provider cardinalities, or exact booking-to-component lifecycle links. Issue #5 confirms a replacement offer and farmer acceptance of repriced remaining scope, but #15 must define how it integrates with the whole booking flow. |
| **Payment-attempt owner/target relationship** | ADR-0006 and #19 explicitly leave the ownership relationship to be determined within constraints. | Candidate representations include an attempt linked directly to a User plus a separately correlated business reference, or linked to a specific payment obligation/business record where the approved flow requires it. Do not choose an FK, polymorphic target, or booking-only relation yet. Any choice must support authenticated ownership and callback correlation while keeping attempts independent of booking transitions. |
| **Recommendation and slot physical shape** | Bundle/slot semantics are confirmed by ADR-0001, but precise schema not written. | Separate slot subtype records versus one typed slot record; precise snapshot columns and how route/cost data is allocated per slot remain modeling/implementation choices. Cardinality must still permit multiple slots and complete quantity coverage. |
| **Provider capability/resource association** | ADR-0005 requires approved capability and independently verified resource; #1 says this relationship remains to be reconciled. | Determine whether each facility/vehicle has an explicit capability association or whether eligibility derives it from the owning provider’s active approved capability and resource type. Do not assume a many-to-many relation absent evidence. |
| **Service application/support-mediated additions** | One initial application per User and later linked support-mediated requests are confirmed (ADR-0005). | Decide whether later additions are child requests within an application aggregate or separately addressable application records linked by an origin/history reference. Preserve the distinction and history either way. |
| **Evidence and verification history granularity** | Independent decisions, evidence expiry, resubmission, information requests, and history are confirmed (ADR-0005). Issue #20 is closed as not planned; manual admin review requires no DAM/BRTA confirmation or regulator integration. | Decide normalized evidence-document, submission/version, review-attempt, and audit relationships during schema review. Evidence categories are admin-configurable; do not assert document types as legal requirements. |
| **Dispute history and uniqueness** | Issue #8 decision-map outcome defines one-component disputes, one active dispute, response/evidence, resolution, and reopen conditions. #15 remains open for lifecycle integration. | Model dispute scope as one component, but confirm whether reopen creates a new case/history entry and how prior decisions are represented before fixing uniqueness and cardinalities. |
| **Refund case vs refund event structure** | ADR-0009/#22 defines component-scoped simulated refund states, submission distinct from confirmation, and immutable financial corrections. | Choose a refund aggregate with transition history versus separate refund-attempt/event records; ensure multiple component adjustments and audit/ledger links can be preserved. No live-provider relation. |
| **Commission and financial configuration cardinality** | ADR-0008/#21 confirms provider/service rates, explicit negotiated exceptions, snapshots, and integer arithmetic. | Decide rate uniqueness/exception representation and whether balance snapshots are persisted or calculated from append-only entries. No commercial rate/default may be invented. |
| **Penalty repeated-cancellation policy storage** | ADR-0009/#22 approves configurable count/window by provider and service capability, manual review, rate/cap snapshots, appeals, and simulated collections. | Configuration/history and candidate-flag representation remain to be designed within approved policy. A threshold event is not itself a violation or penalty. |
| **Settings catalog and snapshots** | ADR-0001, ADR-0008–0010 define some values and snapshot moments; the decision map lists a concrete settings catalog/default reconciliation as outstanding. | Do not add settings beyond established policies. Confirm each effective value’s owner, default, capture point, and any schema snapshot before depicting a settings relationship as settled. |
| **Feature-flag archival field and overrides** | Issue #10 settles global/custom-role/provider/user behavior, precedence, maintenance mode, permanent archive, retained-but-ignored overrides. | Logical archive state is required, but physical representation (status/timestamp) is not selected. Ensure provider scope identifies the User, not a provider permission scope; maintenance has no scoped overrides. |
| **Shared records and audit physical shape** | ADR-0013 confirms centralized ownership, append-only behavior, transactional consistency, event fields; final schema/enforcement mechanism remains open. | Choose concrete event table fields, target reference strategy, before/after representation, and integrity enforcement during schema review. Do not infer a DB trigger, separate database, or tamper-evidence mechanism. |
| **Recommendation table naming** | `10` S1 explicitly undecided: `recommendations` vs `service_recommendations`; ADR-0001 uses `service_recommendations` in its consequence text. | Canonical domain term is **Recommendation**; the physical table name remains open. Resolve in documentation/schema reconciliation, not by assuming table name from prose. |
| **Quantities, date counting, and farm-location duplication** | `10` S2/S3 explicitly undecided. ADR-0009 specifies inclusive storage service days from Intake through Returned for refund valuation; it does not settle every storage-duration convention. | Confirm quantity units, general date-duration convention, and whether profile default coordinates are dropped in favor of Farm locations. Do not extend refund’s inclusive-day rule to unrelated calculations without approval. |
| **Legal evidence requirements** | Issue #20 is closed as not planned. Manual admin review does not obtain DAM/BRTA confirmation or assert document types as legal requirements; no regulator integration. | Keep evidence categories admin-configurable at the approved level; do not encode legal-specific mandatory constraints. |
| **Baseline role phrasing** | ADR-0003 and glossary establish a seeded, editable baseline role; older statements say “no built-in role.” | No domain relationship is open; wording needs reconciliation: no structural/account-type roles or authority-by-name, but an ordinary seeded baseline permission bundle is approved. |

The first two questions—#15 lifecycle and payment-attempt ownership—materially affect the future ER diagram and should be resolved or explicitly shown as unresolved before a final diagram is approved.

## 7. Document-by-document reconciliation list

This is a proposed change list only. No other document is changed by this task.

| Document | Conflict or gap | Recommended update |
|---|---|---|
| `CONTEXT.md` | Current canonical glossary is broadly aligned, but should be cross-checked for terms around Bundle, Slot, component, verification, audit, and feature flags as the model is approved. | Keep as vocabulary authority; add only settled terms/clarifications. Preserve the existing superseded-term list. |
| `.ai/10-DB-SCHEMA.md` | Explicitly legacy/incomplete; contains `users.role`, structural role examples, provider service areas, one facility/vehicle per recommendation, one child component of each type, and incomplete authorization/finance/onboarding/audit records. | Replace/reconcile the planning model against approved decisions. Resolve S1–S3 and the relationships in §6. Label any still-open schema elements. Do not use as implementation contract until reviewed. |
| `.ai/01-architecture.md` | Module list and interaction narrative do not fully show the accepted bundle/slot, multi-component, application/verification, disputes/academic finance, audit boundary, and feature-flag decisions in one reconciled model. | Align module ownership and examples with accepted ADRs and this model; preserve payment independence and audit ownership. Correct any legacy radius, single-resource, role, or finance language. |
| `.ai/05-api-standards.md` | Several route/contract surfaces remain explicitly open; older examples are historical and some financial/authorization terms need harmonization. | Align API vocabulary and endpoint descriptions after #15 and schema reconciliation; do not invent routes or expose a presumed physical model. |
| `.ai/06-module-rules.md` | Must consistently state ownership of application/verification, component finance, permissions, flags, and centralized audit; admin is a delegating entry point. | Update module ownership/boundaries to match ADR-0012/0013 and the reconciled domain model. |
| `.ai/02-folder-structure.md` | Shared-record ownership is partly listed as undecided; roles/permission and audit ownership need to match approved architecture. | Clarify module ownership after logical relationships are approved; do not create speculative empty modules. |
| `.ai/04-database-prisma.md` | Correctly points to `10` as contract, but that document is not ready to be a contract. | Change contract reference only after the reconciled data model is approved; retain ORM/MariaDB rules and avoid equating conceptual records with Prisma models prematurely. |
| `.ai/09-feature-progress.md` | Design decisions and implementation status can be mistaken for one another; feature modules remain unimplemented. | Keep code-inspected status authoritative; note approved designs do not mean schema/modules are implemented. |
| `.ai/admin-console-permission-proposal.md` | Approved permission mapping is not yet seeded and remains catalog follow-up. | Keep it as permission traceability; ensure direct assignments and role-permission grants are represented in the data model without implying implementation. |
| `.ai/adr/0001` and `.ai/adr/0002` | ADRs explicitly say schema reconciliation was not applied; ADR-0001’s original radius point is superseded. | Preserve the decision history; add reconciliation references only when approved. Do not rewrite superseded decision history as current rule. |
| `.ai/adr/0003` | ADR correctly lists missing permission tables and notes older docs are not updated. | After model approval, reconcile dependent docs; do not change the accepted authorization decision. |
| `.ai/adr/0005` | Accepted workflow requires distinct application/capability/resource records and histories, not yet reflected in `10`. Issue #20 is closed as not planned. | Use this model as a reference; provider verification is manual admin review without DAM/BRTA confirmation or regulator integration. |
| `.ai/adr/0006` and `.ai/payment-sandbox-scope.md` | Payment-attempt ownership/precise relationship remains open by design. | Keep the constraint and record the eventual decision separately; do not imply booking lifecycle ownership by Payment. |
| `.ai/adr/0008`, `.ai/adr/0009`, `.ai/adr/0010` | Approved simulated financial workflows are only partially represented in `10`; implementation tracked in #21–23. | Reconcile entity/history relationships while preserving simulation-only boundaries and each policy’s scope. |
| `.ai/adr/0012` and `.ai/adr/0013` | Accepted admin/audit decisions require bounded operations and centralized audit; schema still has provisional `admin_action_logs`. | Align `10` and architecture with shared audit ownership and transactional behavior; no audit implementation mechanism is selected. |
| GitHub issue #1 decision map | Contains historical conflicting money movement/provider choice and role wording alongside current decisions. | Keep closed decision outcomes/ADRs as authority; when future issue updates occur, clearly mark superseded statements and link the controlling decision. |
| GitHub issue #15 | Open; lifecycle needed to complete booking/component schema. | Resolve before freezing component states, replacement relationships, and lifecycle-history details. |
| GitHub issue #19 | Open sandbox integration; attempt ownership still unresolved within accepted bounds. | Decide and record the minimum ownership/correlation relationship during #19 design/implementation, with no booking-state side effect. |
| GitHub issues #20–23 | #20 is closed as not planned; #21–23 track academic finance implementation. | Use issues as boundary/acceptance traceability; do not treat open implementation tasks as implemented schema. |

## 8. Traceability matrix

| Modeling decision / constraint | Source of authority |
|---|---|
| User has no fixed account type; profiles do not grant authority | `CONTEXT.md` §§Identity and access; ADR-0003; issue #9 decision outcome |
| Roles are editable permission collections; permission catalog, role grants, memberships, direct ALLOW/DENY assignments; no provider-scoped permissions; deny-wins/default-deny | ADR-0003; issue #9; `.ai/admin-console-permission-proposal.md` |
| Verified email, multiple sessions, refresh-token rotation, unverified optional phone, contact history | ADR-0011; issue #13; `CONTEXT.md` |
| Separate service application, independent capability decisions, resource verification, evidence/history | ADR-0005; closed issue #7; issue #20 closed as not planned; manual admin review only |
| Facility-crop config establishes crop compatibility; per-crop capacity/price | ADR-0001; `.ai/00-PROJECT_OVERVIEW.md`; `.ai/10-DB-SCHEMA.md` where consistent |
| Vehicle owns its circular service area; no provider-level area and no storage radius | ADR-0002; `CONTEXT.md` §§Supply and Superseded |
| Service request is one crop/quantity; multiple fulfillment slots; heuristic feasible bundles; bundle and slot persistence | ADR-0001; glossary §§Demand and matching; `.ai/00-PROJECT_OVERVIEW.md` |
| One booking can have multiple storage/transport components; price snapshots | ADR-0001; glossary §§Booking lifecycle; open issue #15 for complete transitions |
| Booking state machine and replacement/deadline transitions remain open | GitHub issue #15 (OPEN); do not infer final cardinalities/states from draft `01` or `10` |
| Payment attempts sandbox-only, integer poisha, authoritative verification, no booking transition | ADR-0006; closed design #19 scope/`.ai/payment-sandbox-scope.md`; glossary §§Money |
| Payment-attempt ownership/correlation relation remains unresolved | ADR-0006 consequences; issue #19; decision map #1 outstanding items |
| Component-scoped dispute, responses/evidence, hold isolation, late-dispute behavior | Closed issue #8 decision outcome; glossary §Dispute; ADR-0012 for admin operations |
| Academic commission, immutable ledger events, Pending/Available modeled balances, simulated withdrawal/settlement | ADR-0008; issue #4 closed policy and #21 implementation scope; glossary §§Money |
| Simulated component refunds, provider penalties, appeals and compensating entries | ADR-0009; issue #5 closed policy and #22 implementation scope |
| Storage-only installments, overstay, deemed return, extensions and snapshots | ADR-0010; issue #6 closed policy and #23 implementation scope |
| No real custody, settlement, payout, live refund, or production payment processing | `CONTEXT.md` §§Money/Superseded; ADR-0006/0008/0009/0010; `.ai/00-PROJECT_OVERVIEW.md` |
| Feature flags are separate from permissions; approved scopes, precedence, archival and global-only maintenance | Closed issue #10; glossary §Feature flag; architecture `01` §Authorization and feature flags |
| Centralized append-only audit boundary; transactional writes and fail-closed sensitive reads | ADR-0013; ADR-0012; issue #11 closed outcome; glossary §Audit log |
| Persisted notifications, separate live request channel, deferred jobs | ADR-0001; architecture `01` §§Module interaction/Background jobs; glossary §§Platform operations |
| V1 English-only; translations deferred | ADR-0010 (`english-only-v1`); `.ai/00-PROJECT_OVERVIEW.md`; `CONTEXT.md` |
| Schema is planning-only and conflicts must be reconciled before implementation | `.ai/10-DB-SCHEMA.md` warning and introduction; `.ai/09-feature-progress.md`; actual `backend/prisma/schema.prisma` scaffold |

## 9. Review summary

### Reconciled in this proposal

- Removed legacy structural-role interpretation while retaining editable permission collections and the approved baseline role.
- Replaced provider-level service area with vehicle-owned circular service area.
- Reframed recommendation persistence as Bundle plus multiple fulfillment Slots and booking fulfillment as multiple independently fulfilled components.
- Added the approved logical concepts for onboarding/verification, disputes, simulated finance, payment attempts, feature-flag archival, and shared audit recording.
- Preserved English-only V1, separated authorization from verification/eligibility, and kept payment/finance simulation-only.

### Still unresolved

- Issue #15’s complete lifecycle and replacement/timeout relationships.
- Payment-attempt ownership/correlation relationship.
- Bundle-slot/component physical shape; capability-resource association; evidence/review record granularity; finance history/balance representation; settings catalog; archive/audit physical representation; schema decisions S1–S3 in `10`.
- Issue #20 is closed as not planned; provider verification is manual admin review with no DAM/BRTA confirmation or regulator integration.

### Approval requested

Review the **proposed modeling choices** in §5 and the unresolved alternatives in §6, especially whether the conceptual structure is suitable as the basis for revising `.ai/10-DB-SCHEMA.md`. No open decision is assumed accepted by this document. No other project document, schema, migration, application code, or diagram is changed here.
