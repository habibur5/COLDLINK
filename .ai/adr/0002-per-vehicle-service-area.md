# ADR-0002: Per-vehicle transport service areas; storage has no distance gate; the 50km universal filter is removed

**Status:** Accepted (MVP scope) — supersedes [ADR-0001](0001-bundle-based-matching-and-recommendations.md) decision point 6 only. ADR-0001 points 1–5 and 7–9 are unaffected and remain in force.
**Date context:** decided as a direct correction to ADR-0001, in the same design session, before any code existed.

## Context

ADR-0001 introduced a universal 50km hard eligibility filter, applied uniformly to both storage and transport. On review, this was wrong on two counts:

1. **It conflated a platform-wide assumption with each individual provider's actual operational capability.** A 70km vehicle whose owner has genuinely configured it to serve that range is a legitimate candidate; a 30km vehicle that can't actually reach the farmer is not — a flat platform number can't distinguish these, and gets both cases wrong in different situations.
2. **It treated storage and transport as the same kind of problem.** They aren't. A storage facility is a **fixed physical destination** — the farmer's crop either can reach it (a route exists) or it can't; there's no meaningful concept of the *facility* having an operating range the way a vehicle does. Transport is the side that actually has an operational range, and that range belongs to a specific vehicle, not to "the provider" as an undifferentiated whole — a provider running both a short-haul pickup and a long-haul refrigerated truck has two vehicles with two genuinely different capabilities, and eligibility has to be evaluated at that level to mean anything.

The core principle this ADR restores: eligibility is about **actual demonstrated service capability** — crop/product compatibility, capacity, availability, service area (where applicable), and route feasibility — not about a single distance number applied uniformly regardless of what's actually being matched.

## Decision

**1. Storage facilities have no service-area / distance eligibility gate at all.**
Storage eligibility is: crop/product compatibility (`facility_crop_configs` existence, per ADR-0001 point 5, unchanged), sufficient available capacity, availability for the requested date range, facility active status, and route feasibility (farmer → facility, see point 3 below). There is no radius check, hard or configurable, specific to storage. A facility 70km away is exactly as eligible as one 5km away, provided everything else holds and a usable route exists.

**2. Transport eligibility's service-area gate moves to the vehicle, not the provider.**
Each **vehicle** declares its own service area. A vehicle is eligible only if the farmer's pickup location falls within *that vehicle's* declared area — not the provider's. Two vehicles under the same provider can have different eligibility outcomes for an identical request. Provider identity itself confers no eligibility; it's the vehicle's own declared range that gates this.

This requires a schema change, not yet applied to `10` (implementation, deferred per this ADR's own scope — see Consequences): the existing `provider_service_areas` table (FK'd to `provider_profiles.user_id`) is replaced by a vehicle-scoped equivalent — call it `vehicle_service_areas` — FK'd to `vehicles.id`. MVP keeps the same simple circular-area shape already established (`center_latitude`, `center_longitude`, `radius_km`) — one declared area per vehicle. Non-circular/multiple-zone coverage per vehicle is a plausible future extension, not MVP.

**3. Route feasibility is a binary signal taken directly from the routing provider — nothing layered on top of it.**
```text
Routing provider (OSRM / Google Maps / whichever is configured, per 01 §Routing) returns a usable route → feasible
Routing provider cannot return a usable route → infeasible
```
No separate arbitrary distance threshold sits on top of this, for either side. Storage checks farmer → facility; transport checks pickup → destination. This was already the intent in ADR-0001 point 3 and is reaffirmed, now applied consistently now that the 50km rule that partially duplicated it is gone.

**4. No default platform-wide maximum distance ships in MVP.**
ADR-0001's `matching.max_service_radius_km = 50` default is removed entirely — not lowered, not made optional-but-defaulted, **removed**. An admin *may* later introduce an optional platform-wide maximum distance purely as an operational/performance safeguard (e.g., to bound search cost against a very large future dataset) — but if introduced, it is explicitly secondary to and layered on top of each vehicle's own service area and the route-feasibility checks, never a substitute for them, and ships with no default value assumed by this ADR. This is a different posture than ADR-0001's original framing, where 50km was an active, on-by-default business rule — here, any future platform cap is an off-by-default safety valve only.

**5. Consolidated eligibility model, replacing ADR-0001 point 6:**
```text
STORAGE FACILITY                       TRANSPORT VEHICLE
→ No service-area gate                 → Vehicle-level service area (hard gate)
→ Crop/product compatibility           → Vehicle type suitability
→ Available capacity                   → Vehicle capacity
→ Date/period availability             → Date/time availability
→ Facility active status               → (provider is the owner/operator; not itself a gate)
→ Route feasibility (farmer→facility)  → Route feasibility (pickup→destination)
→ Other storage-specific constraints   → Other transport-specific constraints
```
Only candidates passing every applicable check above are ranked. Distance remains a **ranking factor** among feasible candidates (nearer generally ranks better, all else equal) — this part of ADR-0001 point 4/6 is unchanged; only the *hard-gate* mechanism changes.

## Consequences

- **Schema change required in `10` (not yet applied):** `provider_service_areas` → a vehicle-scoped table (`vehicle_service_areas` or similar), FK to `vehicles.id` instead of `provider_profiles.user_id`. This is a structural rename/refactor, not an additive column — flagged here as implementation debt, same status as every other schema change ADR-0001 already anticipated but didn't apply.
- `matching`'s transport-eligibility filter changes from "is this provider's service area covering this location" to "is this specific vehicle's service area covering this location" — a real behavioral change, not just a schema rename. Bundle generation must evaluate vehicles individually even within one provider's fleet.
- Storage-side matching loses the distance-filter step entirely; it relies purely on route-feasibility (a boolean signal from the routing provider) rather than any radius check.
- **A legitimate new outcome: zero eligible transport vehicles for a request**, if none has a service area covering the pickup location — even if vehicles technically exist in the system nearby. This is correct behavior under this ADR, not a bug, and not something a fallback distance rule should paper over.
- `01`, `05`, `06`, `10`, `11` are still not updated to reflect this — same "not yet applied" status as ADR-0001. When the consolidated implementation pass happens, this ADR's point 2 (the `vehicle_service_areas` schema change) and ADR-0001's other still-open schema changes should land together.

## Alternatives considered

- **Keep the universal 50km cutoff, just make it configurable** — rejected; configurability doesn't fix the underlying problem that one platform-wide number can't represent genuinely different vehicle operating ranges or the fact that storage isn't a distance-gated concept at all.
- **Provider-level service area** (one declared area per provider, inherited by all their vehicles) — rejected; misrepresents fleets with vehicles of genuinely different operational range, which is exactly the scenario that prompted this correction.
- **A soft distance-based ranking penalty for transport, with no hard gate** — rejected; recommending a vehicle that cannot actually reach the farmer is a worse outcome than showing fewer (or zero) options, which is the same reasoning ADR-0001 already applied to feasibility-before-ranking generally.
- **Applying the same vehicle-level service-area model to storage facilities** (e.g., "facility service radius") — rejected; a storage facility is a fixed destination, not an operator with a range, so a radius concept doesn't map onto it the way it maps onto a vehicle. Route feasibility alone correctly captures storage-side reachability.
