# ADR-0005: Service applications, capability approval, and resource verification

**Status:** Accepted (MVP scope) — defines provider onboarding and the independent gates for service capabilities and marketplace resources. Complements [ADR-0001](0001-bundle-based-matching-and-recommendations.md), [ADR-0002](0002-per-vehicle-service-area.md), and [ADR-0003](0003-permission-based-authorization.md); none are superseded.
**Date context:** decided during the Wayfinder decision phase, before application code existed.

## Context

ColdLink users are not fixed account types. One user may farm and offer storage and transportation. A single generic “provider approved” bit would therefore conflate distinct capabilities, while capability approval alone would also fail to establish that every facility or vehicle is safe, lawful, and accurately represented.

The design must keep four concepts separate:

1. **Service application** — the user's request to offer one or more service capabilities.
2. **Provider verification** — the evidence decision for each requested capability.
3. **Resource verification** — the evidence decision for each individual facility or vehicle.
4. **Permission** — whether the user is authorized to perform an operation. Permission neither grants capability nor passes verification.

ColdLink is intended for a Bangladesh pilot, so evidence must include applicable legal documents without turning uncertain legal claims into universal gates. Public sources establish that a commercial cold store requires a licence under the Agricultural Marketing Act 2018, section 6, and that the Road Transport Act 2018 addresses vehicle registration, fitness and route permits. Exact DAM licence scope and some vehicle-category requirements still need written confirmation before implementation.

## Decision

**1. One initial application per user; capability decisions are independent.**

The initial Service application may request storage, transportation, or both. Each requested Service capability receives its own verification decision. One capability may be approved while another remains under review or is rejected. A later capability addition is a separate support-mediated request linked to the user's original application history; it never silently expands existing approved capabilities.

**2. Capability approval and resource approval are separate gates.**

Provider verification approves the user's ability to offer a particular service capability. It does not publish a facility or vehicle. Each individual facility and vehicle must separately pass Resource verification before it may be listed, matched, or booked. Thus publication requires both an active approved capability and an independently verified, active resource, as well as applicable permissions, ownership/party rules, eligibility, and business-state checks.

Self-service submission of a facility or vehicle is allowed only for a user with the relevant approved capability and service-management permission. A newly submitted resource is unavailable to the marketplace until its evidence review passes.

**3. Capability and resource review are independent and reasoned.**

Each capability/resource decision is one of `pending`, `in_review`, `needs_information`, `approved`, or `rejected`. The application remains open while any requested capability is undecided. Once all requested capabilities reach a terminal decision, its outcome is derived as fully approved, partially approved, or rejected. An approved capability may become active while another remains open.

Applicants may edit a draft. After submission, requested capabilities and material information are locked. When a reviewer requests information, the applicant may update the requested fields or evidence for the affected capability/resource. Rejection requires a reason and applies only to the affected capability/resource. Corrected evidence starts a new review attempt while preserving the prior decision and audit history. Applicants may withdraw an undecided application/capability; withdrawal does not revoke an already-approved capability.

Missing information has a configurable response deadline and reminder. When it expires, only the affected review closes; silence is not an automatic rejection. Later evidence may reopen review with its history retained.

**4. Review authority and timing.**

Any staff member with the relevant review permissions may decide. The target is **three business days** for each capability/resource review, starting when its required evidence is complete. The clock pauses while information is requested and resumes when the requested material arrives. Reminders/escalation apply when overdue; missing the target never auto-approves. Apply the same review process, authority model, and target to capability and resource verification.

**5. Evidence is service-specific; law and platform policy are distinguished.**

- **Provider:** require identity, applicable business identity, and authority to operate.
- **Storage capability/facility:** require a current DAM cold-storage licence that covers the facility, together with facility control/address evidence, facility details, and geotagged photos. ColdLink verifies the capability and each facility independently.
- **Transport vehicle:** require registration, current fitness, a route permit where legally applicable, control evidence, vehicle details, and photos. Applicability is checked by vehicle category and use.
- **Driver:** verify the assigned driver's current driving licence and correct vehicle class before assignment. If the provider is also the driver, verify them in that capacity.
- **Insurance:** do not impose a blanket insurance-document requirement unless it is legally required for that vehicle/service or required by the licensed partner. Optional evidence may be submitted; any wider platform requirement must be an explicit configurable policy.
- **Review method:** begin with remote document review and geotagged facility/vehicle photos. Physical inspection is reserved for risk flags or exceptions.

Legally required documents are mandatory. Platform evidence (such as resource-control evidence and geotagged photos) is identified as ColdLink policy, not misrepresented as a universal statutory requirement. Verify the exact legal applicability before implementation.

**6. Expiry and material changes trigger re-verification.**

Required documents carry expiry dates. Expiry or a material change places the affected resource into re-verification and immediately removes it from new listing/matching until approved; notify the provider. Material changes include changes to resource identity, legal authority, ownership/control, licensed address, or the physical capacity/capability represented by evidence (for example, facility operator/address/licensed capacity or vehicle registration/ownership/class/rated capacity). Routine price, availability, crop-configuration, and service-area edits do not trigger re-verification.

**7. Ordinary availability differs from suspension.**

Providers may change ordinary availability themselves; this does not change verification status. Only authorized staff may suspend or reinstate a service resource or account, with a reason and audit record. A service-level suspension affects that resource without automatically suspending the user's other services. Account suspension blocks new activity across all services. Suspension expiry triggers review, never automatic reinstatement; an authorized staff decision after the conditions are met is required for reinstatement, with reason recorded.

Suspension blocks new marketplace activity, not silently cancels existing bookings. Affected bookings enter an operational review/reassignment path under the booking lifecycle rules. Exact continuation, reassignment, and cancellation transitions belong to the lifecycle state-machine decision, not this onboarding decision.

## Consequences

- **Visibility is conjunctive:** a user needs an approved capability, and each listed/matched/bookable facility or vehicle needs its own current verification, availability, and eligibility. Permissions remain an independent authorization gate.
- **Multiple independent histories are required:** preserve the application, per-capability decisions, per-resource evidence/review attempts, requested-information cycles, suspensions, reinstatements, and audit history. A later service request links to, but does not rewrite, the initial application.
- **Expiry and material changes affect only the relevant resource.** They do not silently revoke another capability or another facility/vehicle under the same user.
- **The review target is not the regulator's licensing SLA.** DAM licensing is external; a DAM district charter example lists 30 working days, while ColdLink's own review target is three business days after complete evidence.
- **The production-core evidence implementation gate remains subject to manual legal confirmation (issue #20; no regulator-system integration):** DAM must confirm licence-to-facility/name scope, forms, validity/renewal and expiry rules; BRTA must confirm route-permit classification and current tax/fitness/registration evidence for the actual goods-vehicle categories; current insurance obligations must be verified before treated as law. Public findings are not legal advice.
- Implementation implications for `01`, `05`, `06`, `10`, and the lifecycle design include distinct application/capability/resource-verification concepts, per-resource visibility gates, reviewer permissions, evidence expiry, audit records, and booking triage on suspension/re-verification. These documents are not yet updated.

## Alternatives considered

- **One approve/reject result for the whole user/application** — rejected; storage may be ready while transportation is not, and one result would either over-grant or unnecessarily block a capability.
- **Treat capability approval as approval of every facility/vehicle** — rejected; a user may add multiple assets, and the evidence/legal status belongs to each concrete resource.
- **Use permissions as provider approval** — rejected; permission authorizes an operation but cannot establish legal compliance or marketplace trust.
- **Make every user edit re-verification-worthy** — rejected; ordinary price, availability, crop-configuration, and service-area edits follow their own rules and should not interrupt verified supply.
- **Auto-approve when a review or information deadline expires** — rejected; timeout is not evidence of compliance.
- **Silently cancel active bookings when an asset/account is suspended or re-verification begins** — rejected; affected bookings require explicit lifecycle review and a reasoned operational outcome.
- **Require blanket insurance or speculative permits** — rejected; only documents established as applicable by law or partner requirements are hard gates; broader risk controls must be explicit policy.
