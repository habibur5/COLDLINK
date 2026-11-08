# ADR-0006: Payment module and sandbox-only provider adapters

**Status:** Accepted for production-grade sandbox-only scope. Live payment processing, production partners, and all real-money operation are excluded.
**Date:** 2026-11-04

## Context

ColdLink needs sandbox payment integrations for two provider protocols without coupling marketplace or booking behavior to either provider. The previous architecture treated payments as deferred and had no concrete payment module, provider interface, or payment-attempt persistence. The #19 design must enable initiation, provider callback verification, durable attempts, and idempotency while remaining strictly non-production.

## Decision

1. Establish a dedicated `payments` module. It owns payment orchestration, durable payment attempts, authenticated initiation, provider-specific callback/return/IPN routes, idempotency, and payment-attempt status transitions.
2. Implement separate bKash and SSLCommerz provider adapters beneath the Payment module. For #19, bKash uses one-time Tokenized Checkout without agreement; SSLCommerz uses Hosted Checkout. Adapter protocol details remain inside each adapter.
3. Persist merchant reference, provider reference, amount, currency, provider, status, and relevant timestamps. Store monetary values as `BIGINT` poisha. Enforce uniqueness and idempotency; never persist credentials, access tokens, PINs, OTPs, or unnecessary callback payloads.
4. Verify successful payments authoritatively: bKash Execute and Query; SSLCommerz Order Validation. Browser redirects and callback claims alone never confirm success. Ambiguous results stay pending/inconclusive; payment creation is not blindly retried after timeouts.
5. The Payment module and adapters remain independent of bookings, ledger, wallet, and marketplace modules. A verified attempt never changes booking lifecycle state under #19.
6. Keep configuration sandbox-only. Load sandbox credentials/endpoints only; no live transactions, production credentials, production fallback, or production provider selection/approval.
7. Require automated adapter/callback/idempotency/isolation tests and successful and failed roundtrips against both provider sandboxes before closing #19. If sandbox credentials or callback access are unavailable, document the limitation and keep #19 open. Academic installment workflows may orchestrate repeated one-time sandbox attempts or simulated attempts; they do not add recurring provider agreements.
8. Use the established repository tooling and foundation (INF-01/02 are complete). Do not add a test dependency without approval.

## Consequences

- `payments` becomes a first-class module in the architecture and folder/module rules; it is not a ledger or booking-lifecycle module.
- Payment-attempt schema ownership, exact ownership relation, column lengths/indexes, API paths/contracts, and test-tool selection are implementation details to resolve within the accepted constraints.
- Production custodian/provider selection, regulatory integrations, actual custody, live refunds, payouts, settlement, and live payment operation are excluded. Persisted installment, refund, ledger, commission, and settlement business logic is academic-grade and may only simulate external financial operations.
- INF-01 and INF-02 are schedule entries, not separate GitHub issues. At decision time, the backend did not exist; that historical status is superseded by current code-inspected progress in `09`.
