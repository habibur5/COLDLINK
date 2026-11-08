# ADR-0008: Commission and provider settlement policy

**Status:** Accepted as an academic-grade business model only; no actual funds, custody, payout, or settlement. **Date:** 2026-11-06; scope boundary updated 2026-11-08. Resolves policy questions in [GitHub issue #4](https://github.com/habibur5/COLDLINK/issues/4).

ColdLink models the financial workflow and append-only ledger as persisted academic records. No licensed partner holds funds; sandbox transactions do not represent funds available for settlement. The model calculates a centrally managed percentage commission configured per provider and service, with explicitly recorded negotiated exceptions. Commission is calculated on the provider's agreed service price, excluding modeled taxes, gateway fees and other pass-through charges. The rate is snapshotted when the booking price is agreed, and modeled commission is recorded as earned only when the provider becomes settlement-eligible—not when a sandbox attempt succeeds.

Each simulated or sandbox-recorded installment contributes its modeled provider net share to Pending balance; allocation and commission use integer poisha, with per-installment commission rounded down and any cumulative remainder assigned to the final installment. Pending balance is non-withdrawable and does not represent real money. Unpaid installments remain separate modeled receivables; ColdLink does not advance funds. After the relevant service is completed and verified, applicable modeled holds have cleared, and an authorized admin confirms the amount, it moves to academic Available balance. Affected amounts may be held for modeled refunds or disputes. There is no automatic approval after three days or any other period.

Providers may request a simulated withdrawal from Available balance. An admin-configurable schedule and optional minimum threshold govern the academic workflow; an authorized admin approves the modeled payout. No partner submission or real transfer occurs. Approval and corrections are auditable, immutable academic ledger events. The default modeled settlement hold is **7 calendar days after component completion**, configurable by an admin; capture the effective duration when the hold begins, so later changes do not alter an active hold. Issue #5's refund and provider-penalty decisions are recorded in [ADR-0009](0009-refund-and-provider-penalty-policy.md). No commercial rates or live-launch settings are defined by this ADR.

## Consequences and boundaries

- Pending balance tracks modeled installment shares not yet approved for academic availability; it is not a real payable or held fund.
- The booking's agreed prices and applicable commission rate are immutable snapshots for that booking, even if platform settings later change.
- Refund reversals, dispute liability, provider penalties and recovery of amounts already made available follow [ADR-0009](0009-refund-and-provider-penalty-policy.md); this ADR defines only commission and settlement policy.
- External withdrawal methods and partner-side settlement mechanics are excluded; this decision models workflow states only.
