# ADR-0009: Refund and provider-penalty policy

**Status:** Accepted for Academic MVP; simulated records and outcomes only. **Date:** 2026-11-08. Resolves the policy decisions in [GitHub issue #5](https://github.com/habibur5/COLDLINK/issues/5). Implementation acceptance remains open.

## Decision

### Scope and financial boundary

Refunds, provider penalties, balance changes, and collections are persisted academic records and deterministic simulations. No production refund is submitted, no real money is collected or moved, and no invoice is generated. A simulated refund submission is not completion. Every financial outcome is append-only and auditable; corrections use new compensating entries, never edits or deletion of prior entries.

### Farmer refunds and delivered-value calculation

- No charge applies before payment or to an approved-but-unpaid booking. A paid component with no delivered service is fully refundable.
- Value each component independently. For service already delivered, the farmer owes only the measured delivered value after any applicable service reduction; refund the unearned remainder of the amount paid. No non-refundable platform charge or additional time-based cancellation fee applies. ColdLink bears gateway fees and unrecoverable processing costs.
- Storage duration uses inclusive calendar-day counting wherever storage duration is calculated: both the start and end dates count (for example, January 1 through January 5 is five days). This rule is specific to storage and does not automatically apply to unrelated services. For refund valuation, storage service days run from Intake through actual Returned; any service on a calendar day, including a partial day, counts as one full chargeable day. Charges continue while the goods remain at the facility and stop only on actual return.
- Transportation uses the booking's snapshotted milestone template. The default template is Goods Picked Up (30%), Goods In Transit (30%), and Goods Delivered (40%). Admins may modify milestones and shares, which must total 100%. The active template is snapshotted at booking creation; later edits affect only new bookings. Only completed milestones count as delivered.
- For partial service or provider failure, apply an admin-configurable reduction percentage for the provider to the measured delivered value. The farmer owes the reduced amount; the provider's modeled credit uses that reduced service amount subject to the agreed commission rules. An unset reduction rate means no additional reduction. Snapshot the rate when the failure is recorded.

### Provider failure and replacement

- On failure after acceptance, offer a replacement. The farmer must explicitly accept the replacement provider and recalculated price. Price the replacement only for the remaining undelivered scope; preserve the original provider's delivered value and record associated price/refund differences as simulated adjustments.
- The farmer pays the recalculated replacement price, even if higher than the original price; ColdLink does not cover the difference. If the farmer declines, refund the unearned amount of the affected component (the full amount only if none of that component's service was delivered).
- A service reduction and a provider penalty may both apply only when the penalty is independently justified by a reviewed violation. Do not count the same replacement cost twice.

### Refund workflow

The system calculates eligible refund amounts from policy and service progress. An authorized admin records simulated submission and a distinct simulated confirmation before a refund reaches `completed`. Refund states are `requested`, `approved`, `simulated_submitted`, `processing`, `completed`, `rejected`, and `failed`. No production refund endpoint is called.

### Provider penalties, appeals, and modeled ledgers

- A single pre-acceptance cancellation incurs no automatic penalty. Repeated pre-acceptance cancellations are evaluated using an admin-configurable count and time window per provider and service capability. Reaching the threshold flags the pattern for manual review only; it does not automatically establish a violation or penalty.
- Post-acceptance cancellation or failure, including documented offline use of reserved capacity, may be a violation only after administrative review.
- The penalty is a configurable percentage of the affected component's agreed service price, by service type, with explicitly recorded provider-specific exceptions. If no rate is configured, no penalty is assessed. Snapshot the rate and cap policy when the violation is recorded. Round down to whole poisha, then cap at documented direct replacement cost. Without a replacement, only a separately documented direct cost may support a penalty.
- An assessed penalty is a modeled provider receivable recorded as equal-and-opposite entries in the provider and ColdLink ledgers. It remains outstanding until an admin records simulated collection; partial collection is allowed and leaves the remainder outstanding. No actual collection or invoice occurs.
- Providers may appeal with a reason and optional evidence. An authorized admin records a reasoned decision using `pending`, `approved`, `partial`, or `rejected`. Appeal status is distinct from penalty status, and simulated collection is paused while an appeal is pending. Approval cancels the penalty; partial approval reduces it to the approved amount; rejection upholds it. Capture the configurable appeal deadline at assessment. After it expires without appeal, an authorized admin may record simulated collection.
- Waivers, reductions, reversals, and simulated collections are new auditable financial entries; preserve the original penalty and appeal history. Never use farmer funds or unrelated provider balances.

## Consequences

- Issue #5 is closed as the policy decision; its Academic MVP implementation acceptance criteria—persisted records, validated policy transitions, audit history, tests, and simulated outcomes—are tracked in child issue #22.
- Penalty rates, provider-specific exceptions, reduction percentages, repeated-cancellation thresholds/windows, appeal deadlines, and active transport milestone templates are policy configuration. No penalty or reduction is applied when its rate is unset.
- These policies do not enable production payment/refund processing or actual provider settlement.
