# ColdLink

ColdLink is a Bangladesh-focused marketplace where farmers find, compare and book cold storage and agricultural transport. This glossary fixes the project's vocabulary. It defines terms only — never implementation, file paths, or column names.

Read this before writing any spec, ADR, or ticket. Terms listed under **Superseded** have been removed and must not reappear.

## Language

### Identity and access

**User**:
A person's ColdLink account. A user has no fixed account type; what they may do is decided entirely by their permissions.
_Avoid_: account type, user role, user kind

**Profile**:
Domain-specific information about a user for one activity — a farmer profile, a provider profile. A user may hold several; holding a profile grants no permission.
_Avoid_: role, account type

**Service capability**:
A type of service a user is authorized and approved to offer (cold storage, transportation). Established by a service application and provider verification; independent of any role name.
_Avoid_: provider type, service role

**Service application**:
A user's submission requesting approval to offer one or more service types. Submitted once per user at onboarding; adding a service type later goes through Platform Support, not self-service.
_Avoid_: registration, provider signup

**Role**:
A named, admin-defined collection of permissions. The name carries no authority; only the permissions it contains do.
_Avoid_: system role, structural role, account type, user type

**Permission**:
An authorization rule (ALLOW or DENY) deciding whether a user may perform one operation. Any applicable DENY wins; with no applicable ALLOW, access is denied.
_Avoid_: feature flag, role

**Authorization resolution**:
The single centralized mechanism that evaluates a user's effective permissions across role membership and user-level assignments. No module decides access on its own.
_Avoid_: role check, per-module permission check

**Platform Admin**:
A user holding the permissions needed to administer the platform. It is not a built-in role or account type.
_Avoid_: superuser type, inherent admin role

**Feature flag**:
A platform-wide on/off switch for a feature, managed by the Platform Admin. Independent of permissions: using a feature requires the flag to be enabled *and* the user authorized.
_Avoid_: permission, entitlement

**Platform setting**:
A configurable policy value — a deadline, fee, rate or threshold — owned by the Platform Admin. Its effective value is captured when a process begins, so later changes do not alter running processes.
_Avoid_: constant, hardcoded config

### Trust and verification

**Provider verification**:
The admin review deciding whether a user's submitted service offerings may become publicly available. Until approved, they are invisible and excluded from matching.
_Avoid_: service application, onboarding

**Verified provider**:
A user whose service offerings have passed provider verification and may participate in the marketplace.
_Avoid_: approved provider (ambiguous with booking approval)

**Service suspension**:
Disabling one specific service or resource (for example a single vehicle) without affecting the user's other services.
_Avoid_: account suspension

**Account suspension**:
Disabling a user's access, across all their services, for a configurable period.
_Avoid_: service suspension, ban

**Dispute**:
A challenge to one completed service component, raised during that component's dispute window. It freezes future payout for that component only.
_Avoid_: complaint, claim

### Supply

**Crop**:
A catalog product that can be stored or transported. Crop names are translatable; the crop identifier is not.
_Avoid_: product, item

**Storage facility**:
A physical location where a provider stores crops. It is a destination, not an operator, and has no service-area radius.
_Avoid_: warehouse, generic "cold storage"

**Facility crop config**:
The per-facility, per-crop record carrying the capacity ceiling, price per unit per day, and an availability toggle.
_Avoid_: storage config, capacity record

**Vehicle**:
A transport resource owned by a provider. Each vehicle declares its own service area; eligibility is evaluated per vehicle, never per provider.
_Avoid_: truck (except as a vehicle type), transport

**Vehicle service area**:
The geographic area a specific vehicle is declared to serve. A vehicle is eligible for transport only if the pickup location falls inside its own area.
_Avoid_: provider service area (superseded)

### Demand and matching

**Service request**:
A farmer's statement of need: one crop, one quantity, and one service type — storage only, transportation only, or both.
_Avoid_: order, job

**Eligibility**:
The set of hard filters a candidate must pass before it may be ranked. A candidate failing any filter is never shown, however cheap.
_Avoid_: scoring, ranking

**Bundle**:
One complete fulfillment option for a service request: the storage and transport slots whose combined capacity covers the requested quantity in full.
_Avoid_: deal, match

**Slot**:
A single storage or transport component inside a bundle, covering a portion of the requested quantity and served by one facility or one vehicle.
_Avoid_: split, leg, part

**Recommendation**:
A bundle presented to the farmer, ranked among feasible bundles by cost, distance, capacity margin and rating. Persisted with an expiry.
_Avoid_: deal, quote, result

**Route feasibility**:
A binary signal from the routing provider — a usable route exists between two points, or it does not. Distance alone is never a hard gate.
_Avoid_: service radius, distance limit

### Booking lifecycle

**Booking**:
A farmer's commitment to one bundle: one crop and one quantity, made up of one or more components. Prices are snapshotted at booking time and never recalculated.
_Avoid_: order, reservation

**Component**:
One side of a booking that one provider fulfils and approves independently — a storage booking or a transportation booking.
_Avoid_: child, sub-booking

**Storage booking**:
The component covering storage. Present only when the booking includes storage.
_Avoid_: storage order

**Transportation booking**:
The component covering transport. Present only when the booking includes transport.
_Avoid_: transport order

**Milestone**:
A dated point in a component's delivery — intake, in-storage, returned — tracked separately from its status.
_Avoid_: status

**Intake**:
The point at which a facility accepts the farmer's goods. It starts storage; it does not complete it.
_Avoid_: acceptance, check-in

**Returned**:
The point at which the stored goods are actually handed back to the farmer. Storage capacity is released here.
_Avoid_: completed, released

**Completed**:
Reached only after a component's dispute window passes without an unresolved dispute. Distinct from returned.
_Avoid_: returned, done

**Dispute window**:
The configurable period after a component reaches its completion milestone during which a dispute may be raised. Its duration is captured per component when the window starts.
_Avoid_: cooling-off period, grace period

**Deemed return**:
Treating goods uncollected beyond the configured threshold as returned for settlement purposes, without them physically being handed back.
_Avoid_: auto-return, abandonment

**Settlement eligible**:
A component state indicating a provider's share may enter settlement processing, including on a deemed return. It does not mean the goods were physically returned.
_Avoid_: returned, completed

**Overstay fee**:
A per-day charge accruing when goods remain uncollected after the agreed storage period.
_Avoid_: late fee, penalty

**Installment**:
A scheduled part-payment for storage covering a future service period, with cadence set by the provider and overridable by the Platform Admin.
_Avoid_: payment plan, schedule

**Initial response window**:
The configurable time a provider has to approve or reject a request before it times out.
_Avoid_: approval timeout

**Replacement window**:
The configurable time ColdLink may spend finding and securing a replacement provider for a slot.
_Avoid_: retry window

**Overall bundle deadline**:
The configurable maximum time a pending bundle process may run before it is cancelled.
_Avoid_: bundle TTL

**Payment deadline**:
The configurable time an approved booking may remain unpaid before it is automatically cancelled.
_Avoid_: payment expiry

### Money

**Money**:
An amount stored as an integer number of poisha (BDT minor units). All arithmetic is integer; display converts to BDT.
_Avoid_: float amount, decimal balance

**Payment**:
The farmer's settlement of a booking total to ColdLink, taken after all components are approved. ColdLink holds the funds.
_Avoid_: transaction, charge

**Payment provider**:
An interchangeable external service that moves money, behind a single abstraction. Replaceable by configuration.
_Avoid_: gateway, vendor

**Refund**:
Money returned to a farmer, either through the payment provider or manually by an admin. Recorded as a new entry, never by editing an earlier one.
_Avoid_: reversal-as-edit, chargeback

**Ledger**:
ColdLink's authoritative, append-only record of financial transactions. External evidence is used only for reconciliation.
_Avoid_: transactions table

**Ledger entry**:
One immutable financial event — payment, earning, commission, installment, penalty, adjustment, refund, settlement. Corrections are new entries.
_Avoid_: edit, update

**Provider ledger**:
The per-provider record of earnings, balances, settlements and adjustments.
_Avoid_: wallet, account

**Pending balance**:
A provider's earned amount not yet eligible for settlement.
_Avoid_: immature balance

**Available balance**:
A provider's amount whose hold period has passed and which is eligible to settle.
_Avoid_: withdrawable balance

**Platform commission**:
ColdLink's share of a booking, recorded separately from each provider's payable.
_Avoid_: fee (ambiguous with payment-provider fee), cut

**Settlement**:
Payment of an eligible provider balance to that provider.
_Avoid_: payout, disbursement

**Settlement hold period**:
The configurable delay after a component's completion before its earnings become available.
_Avoid_: settlement delay

**Provider penalty**:
A charge applied to a provider for a violation, chiefly cancellation after acceptance. Configurable and appealable.
_Avoid_: fine

**Penalty waiver**:
An auditable admin decision to reduce or cancel a provider penalty.
_Avoid_: forgiveness

### Platform operations

**Job**:
Deferred background work — dunning, notices, sweeps, settlement runs — that must never block the request that triggered it.
_Avoid_: cron, task runner

**Audit log**:
The append-only record of privileged actions: actor, action, target, previous and new values, timestamp, reason.
_Avoid_: history, activity log

**Notification**:
A persisted message to a user; pushed over a live channel when one is open. Persistence precedes delivery.
_Avoid_: alert, message

**Live channel**:
A request-scoped Socket.IO room keyed to a service request, carrying results and updates while the farmer is watching. Distinct from the per-user notification channel.
_Avoid_: socket, websocket room

## Superseded

These are no longer concepts. Do not reintroduce them under any name.

**Structural role / system role / account type**:
Removed. A user has no fixed kind. The `users.role` enum, its `farmer | provider | admin` values, and any authorization based on holding a named role are gone. Identity is a **user**; authority is **permissions**; domain data is **profiles** and owned resources.

**Provider service area**:
Superseded by **vehicle service area**. A service area belongs to a vehicle, never to a provider.

**Feature-flag override precedence (user > provider > role > global, role-only-grants)**:
Superseded. **Feature flags** (availability) and **permissions** (authorization) are separate and both must pass. Permission resolution is: any DENY wins, else any ALLOW, else deny.
