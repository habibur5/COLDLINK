# ADR-0008: Commission and provider settlement policy

**Status:** Accepted for policy; partner-dependent execution and #5 refund/penalty rules remain open. **Date:** 2026-11-06. Resolves the policy questions in [GitHub issue #4](https://github.com/habibur5/COLDLINK/issues/4).

ColdLink owns the financial workflow and append-only ledger; the licensed payment partner holds collected funds in the TCSA and executes settlements. ColdLink charges a centrally managed percentage commission configured per provider and service, with explicitly recorded negotiated exceptions. Commission is calculated on the provider's agreed service price, excluding taxes, gateway fees and other pass-through charges. The rate is snapshotted when the booking price is agreed, and commission is recorded as earned only when the provider becomes settlement-eligible—not when money is merely collected.

Each collected installment contributes its proportional provider net share to Pending balance; allocation and commission use integer poisha, with per-installment commission rounded down and any cumulative remainder assigned to the final installment. Pending balance is non-withdrawable. Unpaid installments remain separate receivables, and ColdLink does not advance its own funds. After the relevant service is completed and verified, applicable holds have cleared, and an authorized admin confirms the amount, it moves to Available balance. Affected amounts may be held for pending refunds or disputes. There is no automatic approval after three days or any other period.

Providers may request withdrawals from Available balance. An admin-configurable schedule and optional minimum threshold govern processing; an authorized admin approves each payout before it is submitted to the licensed partner. Supported payout methods and actual partner capabilities must be confirmed; none are presumed. Approval and any correction are auditable, immutable ledger events. The default settlement hold duration is deferred until issue #5 resolves refund and provider-penalty policy; rate values are configurable but actual commercial rates must be set before launch.

## Consequences and boundaries

- Pending balance tracks collected amounts not yet approved for availability; it is not a payable funded by uncollected installments.
- The booking's agreed prices and applicable commission rate are immutable snapshots for that booking, even if platform settings later change.
- Refund reversals, dispute liability, provider penalties and recovery of amounts already made available follow #5, not this ADR.
- Withdrawal execution, methods, cadence and any partner-side settlement mechanics remain subject to confirmed production partner capabilities; this decision does not select or approve a partner.
