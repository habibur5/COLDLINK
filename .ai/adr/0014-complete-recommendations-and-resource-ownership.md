# ADR-0014: Complete recommendations and resource ownership

**Status:** Accepted for V1; supersedes the split-fulfillment portions of ADR-0001.
**Date:** 2026-11-10

## Context

ADR-0001 modeled recommendations that could combine capacity from multiple facilities and vehicles. The approved V1 requirement is simpler: each recommendation is a complete alternative that independently meets the entire request. Resource ownership, resource-specific verification, and simple resource availability must also be represented without treating a provider account as a verified resource.

## Decisions

### Complete recommendations

1. A service request has one crop, one quantity, and a requested service type: storage, transportation, or both.
2. Each Recommendation independently fulfills the entire requested quantity. When storage is requested, it identifies exactly one Storage facility whose available capacity for the requested crop and period covers the full quantity. When transportation is requested, it identifies exactly one Vehicle whose capacity covers the full quantity.
3. A combined storage-and-transport Recommendation therefore identifies one facility and one vehicle. A storage-only Recommendation identifies one facility; a transportation-only Recommendation identifies one vehicle. The resources may belong to different Provider accounts.
4. No Recommendation divides quantity across facilities or vehicles. Multiple Recommendations for one request are complete alternatives, not parts to combine. A resource whose capacity is below the requested quantity is ineligible for that request, but may be eligible for a smaller request.
5. Retain deterministic eligibility, route feasibility, cost calculation, ranking, and the approved recommendation delivery behavior, subject to the new whole-quantity rule. Remove bin-packing, split-depth, unbounded-provider-count, and slot-allocation design assumptions.

### Provider accounts and resources

6. One User may hold a Provider profile and offer both storage and transportation capabilities. One Provider account may own multiple Storage facilities and multiple Vehicles.
7. Each facility and each vehicle belongs to exactly one Provider account. Shared resource ownership and resource transfers between Provider accounts are not supported in V1.
8. Provider service applications request capabilities and capability decisions remain separate from Resource verification. Verification is specific to each facility or vehicle; approval of a capability or verification of one resource does not verify another resource.
9. A Provider may register and complete resource details later. A resource cannot receive new requests until its required details are complete, its applicable capability is approved, and that individual resource is verified.
10. For an already verified resource, a change requiring review is staged separately from its currently approved details. The current approved details remain effective while the proposed update is reviewed. Approval replaces the approved details; rejection leaves the prior approved details unchanged. Existing ADR-0005 requirements for review of expired evidence or material changes continue to apply, but do not erase the last approved details merely because an update is pending.

### Resource availability lifecycle

11. Resource operational status is `active`, `suspended`, or `deactivated`, separate from verification status and ordinary availability. Administrators may activate/reactivate, suspend, or deactivate an individual resource.
12. Only a verified resource with complete required details and active status can receive new requests. Suspended and deactivated resources cannot receive new requests.
13. Suspension or deactivation does not automatically cancel bookings accepted before the action; those bookings may continue to fulfillment. Reactivation restores active status and does not itself trigger a new verification workflow. An existing, independently applicable verification requirement (such as expired evidence) still applies.
14. Provider-account suspension remains a separate account-level control under ADR-0005; it does not turn resource verification into account-wide verification.

### Booking scope for V1

15. A booking commits to one complete Recommendation. It has at most one Storage booking and at most one Transportation booking, according to the requested service type. Each present component is associated with its one selected resource and Provider.
16. The full booking/component state-machine expansion in issue #15 is deferred beyond the current V1 data-model scope. Use only the basic booking and fulfillment statuses already listed in the approved API/architecture material. ADR-0009's provider-failure replacement and pricing/refund policy remains approved, but its detailed replacement-attempt state model is deferred. Do not introduce split fulfillment or additional lifecycle states into V1 data design without a later approved decision.

## Consequences

- ADR-0001 remains historical context for the earlier split-fulfillment decision. Its split-capacity, Bundle/Slot, bin-packing, and multi-provider-per-request claims are superseded by this ADR. ADR-0002 remains authoritative for vehicle-owned circular service areas and storage’s lack of a service-area gate.
- A Recommendation is persisted as one complete alternative, with one optional facility reference and one optional vehicle reference, constrained by service type; it has no child fulfillment slots.
- Booking-to-storage and booking-to-transport component relationships are each zero-or-one, not one-to-many. A combined booking can have two providers, one for each service component, but never several providers for the same requested service type.
- Provider resource ownership is a single-provider relationship; verification and operational status remain resource-specific.
- Issue #15 remains open for future lifecycle specification; its broader state machine is not a V1 modeling prerequisite.
- These decisions change documentation only. They do not imply that matching, provider workflows, or booking modules are implemented.
