# ADR-0001: Bundle-based, split-fulfillment matching with synchronous-first delivery

**Status:** Accepted (MVP scope) — **decision point 6 (service radius) superseded by [ADR-0002](0002-per-vehicle-service-area.md).** Everything else in this ADR (points 1–5, 7–9) stands unchanged.
**Date context:** decided across a single extended design session before any code existed
**Doc convention established here:** ADRs live in `.ai/adr/`, one file per decision, numbered sequentially (`0001`, `0002`, ...). Each ADR is self-contained — it should make sense to someone who has read `01`/`10` but wasn't in the room for the discussion. Earlier decisions predate this convention and are candidates for backfill ADRs; the ORM choice is now recorded in ADR-0007.

## Context

`recommendations` was originally designed to compute one ranked list and effectively hand the farmer "the best deal." Working through the real shape of the problem — a farmer needing 1000kg of potato stored and transported — surfaced that this doesn't match how the business is actually supposed to work, or how the underlying supply is actually structured:

- No single facility or vehicle may have enough capacity for the full requested quantity, so **one product's fulfillment can legitimately require multiple storage providers and/or multiple vehicles**, each covering a portion of the quantity.
- The business wants ColdLink to behave like a marketplace — farmers compare multiple complete fulfillment options and choose, the way an e-commerce site shows multiple sellers for one product — not have the system silently pick a "best" one for them.
- Providers/vehicles that are technically in the database as "active" are not necessarily *actually usable* for a given request — capacity, crop support, date availability, and route/distance feasibility all have to hold before something is even a candidate, let alone ranked.

This ADR records the resulting architecture. It supersedes the original single-deal design in `01`'s Recommendation pipeline section (not yet rewritten in the main docs — see "Not yet applied" below).

## Decision

**1. Booking scope (MVP): one product per booking, but that product can span multiple fulfillment slots.**
A booking is for exactly one crop/product and one quantity. Multi-product bookings (e.g., potato + mango in one booking) are explicitly out of MVP scope, deferred to a future version. Within that single product, fulfillment is **not** constrained to one storage provider and one vehicle — it's composed of however many storage "slots" and transport "slots" are needed to cover the requested quantity.

**2. All four bundle shapes are supported, with no fixed provider-count cap.**
A fulfillment bundle may be: single storage + single transport, single storage + multiple transport, multiple storage + single transport, or multiple storage + multiple transport. The number of providers/vehicles in a bundle is **derived from actual capacity, availability, and route feasibility** — never an artificial business rule like "max 2 storages." A 5000kg request might genuinely need 5 storage providers and 6 vehicles; the system must not prevent that.

**3. Search is heuristic, not exhaustive/optimal.**
Finding the provably optimal set of bundles is a bin-packing problem (NP-hard in general) once provider count is unbounded. MVP does not attempt this. Instead, the matching engine runs multiple independent generation strategies (e.g., fewest-providers-first, cheapest-first, nearest-first) to produce a candidate set, then ranks what was found. The results are **good and feasible, not mathematically guaranteed to be the best possible 5 combinations that could exist.** This is an accepted, deliberate trade-off, not an oversight — worth stating plainly in code comments wherever the search lives, so it isn't mistaken for a bug later.

**4. Feasibility filtering always happens before ranking, and ranking never rescues an infeasible candidate.**
A candidate provider/vehicle must pass **all** applicable hard filters before it's considered at all:
- *Storage:* sufficient available capacity for the portion it would cover, crop supported (see point 5), facility active, available for the requested date range, within the service radius (see point 6), route to it is feasible.
- *Transport:* sufficient vehicle capacity, suitable vehicle type for the product, available for the required date/time, can actually reach the pickup point and the relevant storage destination, within the service radius, route is feasible.
Only candidates that clear every filter are ranked. Ranking criteria (among feasible candidates only): total cost, distance, route feasibility quality, available capacity margin, provider trust/rating signal. The exact cross-shape normalization — how a single-facility bundle's rating compares to a two-facility bundle's — is **not fully specified by this ADR**; it's an implementation-time detail bounded by "feasibility first, then rank," not a blocking open question.

**5. Crop/storage compatibility stays implicit in MVP.**
A facility is considered compatible with a crop if a `facility_crop_configs` row exists for that pairing — no explicit temperature/humidity/condition columns are added in MVP. This trusts the provider's own configuration rather than the system independently verifying storage conditions. Deferred, not forgotten — explicit condition attributes are a plausible future addition once the domain requires it.

**6. ~~Service radius is a hard eligibility filter, separate from distance-as-ranking-factor.~~ — SUPERSEDED, see [ADR-0002](0002-per-vehicle-service-area.md).**
Anything beyond the configured radius is excluded outright, regardless of how good it would otherwise look — it never just "ranks low." Default: **50km**, configurable via `platform_settings` (`matching.max_service_radius_km`). Distance is then *also* used as a ranking factor among whatever passes the filter. The radius should be evaluated against actual route/travel distance where the routing provider (`01` §Routing) can supply it, not straight-line geographic distance — straight-line is an acceptable fallback only when route distance genuinely can't be computed for a candidate.

**7. Internally generate more than is shown; surface ~5 options.**
The engine may generate a broader internal candidate set, then narrow to a target of **5** presented options (configurable, not hardcoded — exact setting name TBD at implementation time alongside the other `matching.*` settings).

**8. Delivery is synchronous-first; background completion + notification is a fallback, not the primary flow.**
```text
Farmer submits search (once)
  → server attempts to compute and return results in the same HTTP response
  → if this completes within matching.sync_wait_timeout_ms (default 10000ms, configurable) → done, farmer sees results immediately
  → if it exceeds that threshold → detach to background completion
       → when background completion finishes:
            → always persist a notification record (unconditionally — no server-side "is the farmer still watching" detection)
            → if a live channel is still open for that search (farmer stayed on the results screen) → push results live over that channel
            → frontend suppresses the notification alert if results were already rendered live, to avoid a duplicate/redundant alert
            → if the farmer already left, the persisted notification is how they find their way back to the now-ready results
```
The farmer never re-submits the same search because they navigated away — this was an explicit requirement, not an incidental property.

**9. All numeric limits governing this flow live in `platform_settings`, not hardcoded.**
Confirmed defaults so far: `matching.max_service_radius_km = 50`, `matching.sync_wait_timeout_ms = 10000`. Additional breadth-safeguard settings (internal candidate-generation cap, max split depth attempted per generation strategy) are anticipated by this ADR but their concrete default values are **not yet decided** — implementation should add them to `platform_settings` following the same pattern, with defaults chosen for reasonable performance rather than left unbounded.

## Consequences

- `service_recommendations` (as currently shaped in `10`) needs to become two-level: one row per **bundle** (total cost, rank, expiry, status) with child rows per **candidate slot** inside it (which facility or vehicle, what portion of the quantity, that component's individual cost/distance). Not yet written to `10`.
- `matching`/`recommendations` becomes the most algorithmically complex module in the system — more so than `routes` or `costs`. Worth budgeting real design/testing time here specifically, and worth the ADR-level "heuristic, not optimal" framing so a future contributor doesn't "fix" this into an expensive exhaustive search.
- Real-time delivery needs a request-scoped live channel (a Socket.IO room keyed to the `service_request` id), which is a new pattern distinct from the existing per-user notification channel (`01`/`10` §Notifications) — both will coexist.
- Once a farmer selects a bundle, its child slots become the actual storage/transport slots that feed the provider-acceptance/payment/confirmation lifecycle designed separately (2h/5h/48h windows, 1:N provider attempts per slot) — that lifecycle's own ADR is not yet written, but this bundle-selection step is its entry point.
- This is an accepted production-core matching decision. Reconcile any remaining schema/API documentation before implementing it. Development follows the Waterfall gates in `.ai/11-project-schedule.md`.

## Alternatives considered

- **Single auto-selected "best" deal** (the original design) — rejected; doesn't match the marketplace experience the business wants.
- **Async-only flow** (request → job → notification → farmer views results) — rejected; farmer should see results as part of one continuous search interaction in the normal case, not be routed through a notification for something that just happened.
- **Exhaustive/provably-optimal search** — rejected for MVP; computationally expensive relative to the benefit, given "good feasible options" was explicitly stated as sufficient.
- **Fixed maximum provider/vehicle count per bundle** — rejected; would artificially block legitimate fulfillment of larger quantities that genuinely need more providers.
