# ADR-0015: Sandbox payment attempts for V1 payment obligations

**Status:** Accepted for V1; clarifies and extends the sandbox-only boundary in ADR-0006.
**Date:** 2026-11-10

## Context

ADR-0006 establishes bKash Tokenized Checkout and SSLCommerz Hosted Checkout sandbox adapters, authoritative verification, and no real-money operation. Existing finance documents distinguish academic financial records from provider checkout and describe some collections as deterministic simulations only. The approved V1 scope is that sandbox payment-provider integration is available for applicable payment/collection obligations, while all records and outcomes remain non-custodial and no real funds move.

## Decision

1. V1 uses only the approved bKash one-time Tokenized Checkout sandbox and SSLCommerz Hosted Checkout sandbox. No agreements, recurring debits, production endpoints/credentials, live payment, or real-money transactions are permitted.
2. Applicable V1 customer payment obligations use sandbox attempts, including booking/down-payment obligations, subsequent storage installments, simulated penalty collections, and other applicable payment obligations. Each installment is a separate one-time attempt; no recurring provider agreement or automatic debit is introduced. Internal simulated workflows that are not customer payment obligations (including refunds, withdrawals, and settlements) do not use a payment-provider attempt.
3. A sandbox attempt represents a provider test outcome, not money received, custody, a real debt payment, or a real settlement. Refunds, provider withdrawals, and provider settlements remain separate simulated internal workflows; no production refund or payout API is called.
4. The Payment module owns attempt initiation, persistence, idempotency, callbacks, and authoritative provider verification. The owning booking/installment/penalty workflow decides whether a verified attempt result changes its own academic record. A Payment attempt or provider callback does not itself mutate booking, installment, penalty, ledger, or settlement state.
5. Preserve integer poisha, provider-reference/merchant-reference/amount/currency validation, sandbox-only configuration, and all other safety requirements in ADR-0006 and `.ai/payment-sandbox-scope.md`.
6. Do not infer or add a Payment-attempt ownership foreign key, obligation relation, or polymorphic target. That persistence relationship remains unresolved until explicitly approved; authenticated ownership and callback correlation remain required.

## Consequences

- ADR-0006 remains authoritative for adapter protocols and verification, as amended by this ADR for applicable V1 customer obligations that use sandbox attempts.
- ADR-0009 and ADR-0010 continue to define penalty and storage-installment policy, including waivers, schedule rules, notices, overstay, deemed return, and financial records. Their reference to simulated collection means no real-money collection; where an applicable sandbox attempt is used, the owning workflow records only the modeled outcome after verified attempt result.
- The Payment module remains separate from domain lifecycle and academic ledgers. No callback directly confirms a booking or posts a ledger entry.
- Exact attempt ownership/association remains open. This ADR does not settle the schema relation or expand issue #19’s adapter acceptance criteria.
- This decision changes scope documentation only and does not claim that sandbox checkout or obligation workflows are implemented.
