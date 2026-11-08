# ADR-0010: Storage installments, overstay, and extensions

**Status:** Accepted for Academic MVP; persisted records and simulated outcomes only. **Date:** 2026-11-09. Resolves the policy decisions in [GitHub issue #6](https://github.com/habibur5/COLDLINK/issues/6). Implementation acceptance is tracked in [GitHub issue #23](https://github.com/habibur5/COLDLINK/issues/23).

## Scope and boundary

This decision applies only to **storage bookings**. Transport remains a one-time service and has no installment, overstay, or extension workflow. All money-like amounts are academic records in integer poisha: no recurring agreement, live debit, invoice, custody, payout, or production collection is permitted. Collection is a manual, deterministic simulation performed by an authorized user.

The scope is intentionally small but complete: persist schedules and outcomes, validate transitions, preserve audit history, and expose the workflow through the booking resource. It does not introduce production-financial enforcement.

## Installment policy

### Configuration and snapshots

- A provider configures an installment cadence: `weekly`, `biweekly`, `monthly`, `per_storage_period`, or `custom` (minimum 7 days; a longer interval collapses to a single period when it exceeds the booking duration).
- The Platform Admin may set a provider-specific cadence override. The effective cadence is snapshotted when the booking is confirmed, so later setting changes affect only new bookings.
- The global fallback cadence is `per_storage_period`.
- A provider may configure a down-payment percentage. A separate nullable Platform Admin override takes precedence; if neither exists, the global default is `0%`. The effective percentage is also snapshotted at confirmation.
- For a non-zero deposit, the values used to present the required payment after provider approvals are carried unchanged into that confirmation snapshot.

### Confirmation and schedule generation

- After the required providers approve a booking, a non-zero initial down payment is due before the existing booking payment deadline. A simulated payment confirms the booking and creates its final schedule. A provider may waive its own facility's deposit with a mandatory reason; the Platform Admin may override that decision. If an applicable deposit is neither paid nor waived by the deadline, cancel the booking and release reserved capacity.
- With a `0%` deposit, provider approval confirms the booking directly and creates the schedule.
- The down payment is a separate schedule item, not a regular installment. The remaining storage cost is split equally across regular installments; any integer-poisha remainder is assigned to the final regular installment.
- `per_storage_period` creates one upfront regular installment due at confirmation. Other schedules are anchored to the storage start date and make each period payable at its start. The number of regular installments is the number of complete cadence periods, with a shorter remaining period folded into the final installment; a booking shorter than its cadence has one regular installment.
- An installment moves `scheduled → due → paid | overdue | waived`. A daily job marks it due on its due date and overdue after the snapshotted global seven-day grace period. Later installments do not cancel the booking or release capacity when overdue.
- Support or an authorized Platform Admin manually initiates simulated collection. Successful simulation records payment and the corresponding academic ledger events. Subsequent-installment waivers are all-or-nothing, require a reason, and are separate from initial-deposit waivers.

## Collection notices and ledger effects

- Create persisted in-app notices seven days before the scheduled storage end date, when an installment becomes due, when it becomes overdue, and when an extension resolves. Email or SMS may be added only when those delivery channels exist.
- The notice lead time and installment grace period are global `platform_settings`, each snapshotted where it affects a booking or installment.
- A paid installment records the farmer's modeled payment, the provider's modeled gross earning/Pending balance, and modeled commission as immutable ledger entries under ADR-0008. No ledger entry is created merely because an installment is scheduled or overdue.

## Overstay and deemed return

- Overstay applies when goods have not reached actual **Returned** after the agreed storage end date. It begins on the following day.
- A daily job maintains one active record per storage booking. Its daily charge is `quantity × snapshotted price_per_unit_per_day × snapshotted overstay multiplier`, rounded to whole poisha. The global multiplier defaults to `1.5` and is snapshotted when overstay begins.
- An active record accumulates active overstay days and total accrued amount. It is finalized at actual return or confirmed deemed return, producing one modeled farmer receivable/provider receivable ledger outcome. It is not a real debt collection or invoice.
- The global deemed-return threshold defaults to **30 active overstay days**, is snapshotted when overstay begins, and is not itself an automatic state transition. The daily job flags eligibility; a holder of `overstay.confirm.any` confirms deemed return, finalizes overstay, and makes the component settlement-eligible. Deemed return stops overstay accrual without claiming physical return.

## Extensions

- A farmer may submit one extension request for a storage booking on or before its current end date. A second request is rejected while another is pending.
- Extension states are `pending`, `approved`, `rejected`, `cancelled`, and `expired`. The provider has the existing `initial_response_window` to decide; the farmer may cancel while it is pending.
- Capacity is checked when the request is created and rechecked in the same transaction as provider approval. Approval updates the storage booking/allocation end date and prices only the additional period using the booking's original snapshotted storage rate.
- Existing installments are immutable. Approval appends regular installments for the extension period with the booking's snapshotted cadence and no second deposit. If the first calculated extension due date has passed, it becomes due on approval rather than being backdated.
- A timely pending request pauses overstay and deemed-return active-day counting. If it is rejected, expires, or is cancelled after the original end date, no charge is backdated; overstay begins the following day. Physical return automatically cancels a pending extension request.

## Authorization and audit

- Farmers may read their own installments and overstay records and request/cancel their own extensions.
- Booking parties may read the relevant records; the provider party decides extension requests through the booking state machine and ownership checks.
- `installment.collect` and `installment.waive` govern manual collection and subsequent-installment waivers. `installment.waive-deposit` is restricted to the storage provider party; its `.any` form is available to the Platform Admin. `overstay.confirm.any` is required for deemed-return confirmation.
- Deposit waivers, installment waivers, collections, deemed-return confirmations, and extension decisions are auditable, with waiver reasons mandatory. Ledger corrections are compensating entries, never edits or deletion.

## Consequences

- The implementation needs persisted installment, extension, and overstay records; provider and platform setting snapshots; daily jobs; notification creation; ledger integration; capacity-safe extension approval; API contracts; permissions; and tests.
- The Payment module remains independent of this workflow. No sandbox checkout is required for installment collection; the implementation uses the academic deterministic simulator.
- This decision complements ADR-0008 and ADR-0009. Their academic-finance boundary remains authoritative.
