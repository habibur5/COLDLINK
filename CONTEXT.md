# ColdLink

ColdLink is a Bangladesh-focused marketplace where farmers find, compare and book cold storage and agricultural transport. This glossary fixes the project's vocabulary. It defines terms only — never implementation, file paths, or column names. Delivery follows the Waterfall Model; assurance grades are defined in `.ai/12-development-strategy.md`.

Read this before writing any spec, ADR, or ticket. Terms listed under **Superseded** have been removed and must not reappear.

## Language

### Identity and access

**User**:
A person's ColdLink account. A user has no fixed account type; what they may do is decided entirely by their permissions.
_Avoid_: account type, user role, user kind

**Session**:
One authenticated context for a User. A User may have multiple active sessions; ending or revoking a session ends its authenticated access.
_Avoid_: login state, device account

**Verified email**:
An email address whose control the User has proven. Every V1 User must have a verified email before using account functionality.
_Avoid_: registered email (when verification is meant)

**Unverified phone contact**:
An optional phone number the User has supplied but not proven control of. It is not an authentication or recovery method in V1.
_Avoid_: phone-verified account, phone login

**Contact history**:
The preserved record of a User's previous email and phone contacts and their verification/change history. A historical contact does not itself establish current ownership.
_Avoid_: current contact, account merge key

**Profile**:
Domain-specific information about a user for one activity — a farmer profile, a provider profile. A user may hold several; holding a profile grants no permission.
_Avoid_: role, account type

**Service capability**:
A type of service a user is authorized and approved to offer (cold storage, transportation). Established by a service application and provider verification; independent of any role name.
_Avoid_: provider type, service role

**Service application**:
A user's initial submission requesting approval to offer one or more service types. Each requested capability is decided independently; a later capability addition is a separate, support-mediated request linked to the original history.
_Avoid_: registration, provider signup

**Role**:
A named, admin-editable collection of permissions. Initial setup seeds predefined roles such as `user`, `admin`, `farmer`, `provider`, and `staff`; these remain editable and manageable through authorized role-management operations. The name carries no authority; only explicitly assigned permissions do. `user` is the ordinary baseline role granted at registration.
_Avoid_: role name as authority, structural role, account type, user type

**Permission**:
An atomic, named capability to perform one operation on one resource, attached to a role or a user as an ALLOW or a DENY. Any applicable DENY wins; with no applicable ALLOW, access is denied.
_Avoid_: feature flag, role, capability

**Permission key**:
A permission's name: `<resource>.<action>`, lowercase kebab-case. Actions are `create`, `read`, `update`, `delete`, or a business verb (`approve`, `cancel`, `verify`, `suspend`, `reinstate`, `refund`, `waive`, `settle`, `resolve`, `assign`, `export`); `<resource>.*` is the resource wildcard. There is no global wildcard.
_Avoid_: permission string, role name

**Party**:
A user with a stake in a record - its owner or a counterparty. Many records have several parties: a booking has the farmer, the storage provider and the transport provider.
_Avoid_: owner, when a counterparty is meant

**Own scope / any scope**:
A permission's reach. Without `.any` it covers only records the caller is a party to; with `.any` it also covers records they are not. There is no implicit bypass - cross-party access must be granted explicitly and is auditable.
_Avoid_: admin bypass, superuser

**Effective permission set**:
The permissions a user actually holds for a request, resolved from role membership and user-level assignments. Any DENY wins; otherwise any ALLOW; otherwise denied.
_Avoid_: role permissions, role rights

**Permission catalog**:
The fixed, seeded, versioned list of every permission key. It grows only through migrations, and new keys are never granted automatically.
_Avoid_: permission list

**Baseline role**:
The seeded, admin-editable `user` role granted automatically at registration. It holds only its explicitly assigned ordinary permissions - no `.any`, administrative, provider-approval or settlement authority unless explicitly and validly changed through role management.
_Avoid_: role name as authority, account type

**Authorization resolution**:
The single centralized mechanism that evaluates a user's effective permissions across role membership and user-level assignments, server-side on every request. No module decides access on its own; access tokens carry user identity and a session reference only, never permission claims.
_Avoid_: role check, per-module permission check, token claims

**Platform Admin**:
A user holding the permissions needed to administer the platform. It is not a built-in role or account type; other users may perform specific administrative operations when explicitly granted the relevant permissions.
_Avoid_: superuser type, inherent admin role

**Feature flag**:
A switch controlling the availability of a major platform feature or operational workflow, managed by the Platform Admin. It does not gate ordinary CRUD actions or replace permissions: an operation requires the relevant feature to be enabled *and* the user authorized. Provider-scoped availability applies to a user's provider-side workflows but grants no service capability, approval, permission, verification or eligibility.
_Avoid_: permission, entitlement, CRUD gate

**Platform setting**:
A configurable policy value — a deadline, fee, rate or threshold — owned by the Platform Admin. Its effective value is captured when a process begins, so later changes do not alter running processes.
_Avoid_: constant, hardcoded config

### Trust and verification

**Provider verification**:
The evidence review deciding whether a user may offer each requested service capability. Approval activates only that capability; it does not by itself make any facility or vehicle publicly available.
_Avoid_: service application, onboarding

**Resource verification**:
The evidence review for one specific facility or vehicle. A resource is not listed, matched, or booked until it passes verification, independently of the user's approved service capability.
_Avoid_: provider verification, capability approval

**Verified provider**:
A user whose service capability has passed Provider verification. The user may offer that capability, but each facility or vehicle still needs its own Resource verification before marketplace participation.
_Avoid_: approved provider (ambiguous with booking approval)

**Service suspension**:
An authorized staff action disabling one specific service or resource (for example a single vehicle) without affecting the user's other services. It is distinct from a provider changing ordinary availability.
_Avoid_: account suspension

**Account suspension**:
Disabling a user's access, across all their services, for a configurable period.
_Avoid_: service suspension, ban

**Dispute**:
A challenge to one service component that has reached its completion milestone. The farmer may raise it during the component's dispute window; authorized Support may raise it on the farmer's behalf at any time. It holds only that component's unpaid provider payable. A late dispute does not undo an already reached Completed state.
_Avoid_: complaint, claim

### Supply

**Crop**:
A catalog product that can be stored or transported. Crop names are translatable; the crop identifier is not.
_Avoid_: product, item

**Farm location**:
A location record belonging to a Farmer profile, containing its address and geographical coordinates. Farm-specific location data is stored on the Farm location, not duplicated in the User Profile.
_Avoid_: profile coordinates, user address (when a farm location is meant)

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
Reached after a component's dispute window passes without an unresolved dispute filed during that window. Distinct from Returned; a Support-filed late dispute does not undo this state.
_Avoid_: returned, done

**Administrative lifecycle override**:
A permissioned staff action that makes a defined booking or component state transition. It follows the applicable state machine and business rules; it does not permit arbitrary status editing.
_Avoid_: admin bypass, arbitrary status change

**Dispute window**:
The configurable period after a component reaches its completion milestone during which the farmer may raise a dispute. It defaults to seven calendar days and is captured per component when the window starts. An unresolved dispute filed in the window delays Completed until it is resolved.
_Avoid_: cooling-off period, grace period

**Deemed return**:
Treating goods uncollected beyond the configured threshold as returned for settlement purposes, without them physically being handed back.
_Avoid_: auto-return, abandonment

**Settlement eligible**:
A component state indicating a provider's share may enter settlement processing, including on a deemed return. It does not mean the goods were physically returned.
_Avoid_: returned, completed

**Overstay fee**:
A per-day academic charge accruing when goods remain uncollected after the agreed storage period. Its rate is snapshotted when overstay starts; it stops at actual return or deemed return.
_Avoid_: late fee, penalty

**Installment**:
A scheduled academic part-payment for storage covering a future service period, with cadence set by the provider and overridable by the Platform Admin. A down payment is a distinct initial schedule item, not a regular installment.
_Avoid_: payment plan, schedule

**Initial response window**:
The configurable time a provider has to approve or reject a request before it times out.
_Avoid_: approval timeout

**Extension request**:
A farmer's request to move a storage booking's agreed end date later. It requires capacity revalidation and provider approval; it is distinct from overstay.
_Avoid_: automatic extension

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
An academic model of a farmer's booking payment. Provider transactions in project scope are sandbox-only or simulated; no real funds are moved or held.
_Avoid_: transaction, charge

**Payment attempt**:
A recorded attempt to pay a booking through a payment provider. Its status describes only that attempt; it does not itself settle funds or change a booking's lifecycle state.
_Avoid_: payment session, settlement

**Payment sandbox**:
A payment provider's isolated test environment. Sandbox activity does not move real money, establish production approval, or prove that the same flow is available for live transactions.
_Avoid_: production mode, live payment

**Production payment processing**:
A provider-approved live environment in which transactions can move real money. It is distinct from sandbox testing and is not enabled by sandbox integration work.
_Avoid_: sandbox, test transaction

**Payment provider**:
An external sandbox service used to demonstrate checkout protocols. Supported adapters are bKash Tokenized Checkout Sandbox and SSLCommerz Hosted Checkout Sandbox; neither enables live payment processing.
_Avoid_: gateway, vendor

**Licensed payment partner**:
Removed from the implemented product model. No real-world custody or settlement partner is selected or used.

**Trust Cum Settlement Account (TCSA)**:
Historical regulatory concept only; ColdLink does not open, operate, or integrate with a TCSA.

**Refund**:
An academic workflow recording a refund decision and simulated outcome. No production refund is submitted to a payment provider and no real money is returned.
_Avoid_: reversal-as-edit, chargeback

**Ledger**:
An academic-grade, persisted, append-only model of financial events. It is not a custodial account and is not reconciled with real partner settlement records.
_Avoid_: transactions table

**Ledger entry**:
One immutable financial event — payment, earning, commission, installment, penalty, adjustment, refund, settlement. Corrections are new entries.
_Avoid_: edit, update

**Provider ledger**:
The academic-grade per-provider record of modeled earnings, balances, settlement states, and adjustments; it does not represent held funds.
_Avoid_: wallet, account

**Reconciliation**:
An academic comparison of simulated payment, refund, and settlement records; it does not imply connection to a real partner or movement of funds.
_Avoid_: sync, import

**Pending balance**:
An academic modeled provider amount attributable to simulated or sandbox-collected installment shares, not approved for modeled availability. It is non-withdrawable; it is not a real payable or held money.
_Avoid_: immature balance

**Available balance**:
An academic ledger balance that has passed modeled eligibility and admin approval. It may be used in a simulated withdrawal workflow only; it is not cash or a claim on held funds.
_Avoid_: withdrawable balance

**Platform commission**:
An academic modeled percentage share of a provider's agreed service price, configurable per provider and service. Specific negotiated exceptions are explicitly recorded. Taxes, gateway fees and other pass-through charges are excluded. The applicable rate is snapshotted when the booking price is agreed; modeled commission is recorded at settlement eligibility and is not a claim on real funds.
_Avoid_: fee (ambiguous with payment-provider fee), cut

**Settlement**:
An academic state transition representing a modeled provider settlement. No payment instruction is sent and no actual payout occurs.
_Avoid_: payout, disbursement

**Settlement hold period**:
The admin-configurable delay after a component is completed and verified before its collected provider share may be approved for availability. The default duration remains pending the refund and provider-penalty policy in #5. An applicable refund or dispute can hold the affected amount.
_Avoid_: settlement delay

**Provider penalty**:
A charge applied to a provider for a violation, chiefly cancellation after acceptance. Configurable and appealable.
_Avoid_: fine

**Penalty waiver**:
An auditable admin decision to reduce or cancel a provider penalty.
_Avoid_: forgiveness

### Platform operations

**Job**:
Deferred background work — notices, expiry sweeps, and academic installment/settlement simulations — that must never block the request that triggered it.
_Avoid_: cron, task runner

**Audit log**:
The append-only record of privileged state changes and sensitive reads: actor, action, target, previous and new values when applicable, timestamp, and any required reason. Audit records are not changed or removed.
_Avoid_: history, activity log

**Notification**:
A persisted message to a user; pushed over a live channel when one is open. Persistence precedes delivery.
_Avoid_: alert, message

**Live channel**:
A request-scoped Socket.IO room keyed to a service request, carrying results and updates while the farmer is watching. Distinct from the per-user notification channel.
_Avoid_: socket, websocket room

## Superseded

These are no longer concepts. Do not reintroduce them under any name.

**Structural role / fixed account type / legacy `users.role` enum**:
Removed. A user has no fixed kind, and the legacy `users.role` enum is not the authorization model. Predefined editable roles (`user`, `admin`, `farmer`, `provider`, `staff`) are permission collections, not account types; holding a role never grants authority because of its name. Identity is a **user**; authority is **permissions**; domain data is **profiles** and owned resources.

**Provider service area**:
Superseded by **vehicle service area**. A service area belongs to a vehicle, never to a provider.

**ColdLink as fund custodian**:
Removed. ColdLink never holds or moves customer or provider money; financial workflows are limited to sandbox checkout and academic simulation.

**Global wildcard permission, and provider- or platform-level permission scopes**:
Removed. There is no global `*`; the **Platform Admin** holds every curated key explicitly. Permissions attach only to **roles** and to users - never to providers and never as a global scope.

**Implicit administrative ownership bypass**:
Removed. Cross-party access is always an explicit `.any` **permission**, enforced in the service layer.

**Feature-flag override precedence (user > provider > role > global, role-only-grants)**:
Superseded. **Feature flags** (availability) and **permissions** (authorization) are separate and both must pass. Permission resolution is: any DENY wins, else any ALLOW, else deny.
