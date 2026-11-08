# Payment sandbox integration — approved design for #19

**Status:** Design approved. INF-01 and INF-02 are complete; #19 remains open through provider sandbox roundtrip tests. This is production-grade integration work strictly limited to sandbox environments.

## Scope and boundaries

- bKash **Tokenized Checkout without agreement**, one-time sandbox checkout only.
- SSLCommerz **Hosted Checkout**, sandbox only; no Easy Checkout.
- Dedicated `payments` module owns orchestration, durable Payment attempts, authenticated initiation, provider callback/return/IPN routes, idempotency, and authoritative verification.
- Separate bKash and SSLCommerz adapters own their provider-specific HTTP/API and callback formats under `payments/providers/`.
- Booking, ledger, wallet, and marketplace modules remain independent. Payment callbacks never transition booking state.
- No partner outreach; no Hold.bd; no production provider selection/approval; no live transactions or production fallback. These exclusions apply to all project work.
- Refunds, installments, agreements/recurring payments, payouts, settlement, capture/void products, and production configuration are outside #19. Installment business workflows are academic-grade and may call a new sandbox payment attempt per installment or simulate collection; they do not expand #19 into live recurring payments.

## bKash sandbox flow

1. An authenticated caller requests payment initiation. The Payment module validates ownership and creates/reuses the idempotent local Payment attempt.
2. The bKash adapter obtains a sandbox authorization token and calls the Tokenized Checkout without-agreement create-payment operation with the merchant reference, BDT amount, and callback URLs.
3. The adapter returns the provider reference and provider-issued `bKashURL`; the caller redirects the customer to that URL. ColdLink never collects wallet PIN or OTP.
4. A success callback causes the Payment module to ask the bKash adapter to Execute the payment. Failure/cancel callbacks are not success evidence.
5. Execute success is checked against the attempt's provider reference, merchant reference, amount, and currency before the attempt can become `succeeded`.
6. If Execute is inconclusive or times out, use Query Payment. Preserve `pending`/`verification_pending` until an authoritative result is available; never blindly recreate a transaction after an ambiguous timeout.

```text
Caller → payments: initiate (authenticated, idempotent)
payments → bKash adapter → bKash sandbox: create payment
payments → caller: provider checkout URL
Customer → bKash hosted checkout
bKash → payments callback → bKash adapter: Execute
                           ↘ Query Payment if Execute inconclusive
bKash adapter → payments: normalized verified result
```

## SSLCommerz sandbox flow

1. An authenticated caller requests payment initiation. The Payment module validates ownership and creates/reuses the idempotent local Payment attempt.
2. The SSLCommerz adapter creates a sandbox session using the approved Hosted Checkout flow and the attempt's merchant reference, BDT amount, and success/fail/cancel/IPN URLs.
3. The adapter returns the provider-issued hosted checkout URL and provider reference. The caller redirects the customer to the hosted page.
4. Browser returns and IPN notifications are treated as untrusted signals. The Payment module sends the relevant provider reference/validation ID to the adapter.
5. The adapter calls the sandbox Order Validation API and returns normalized facts. Confirm success only after validating provider status and matching merchant reference, amount, and currency to the stored attempt.
6. Duplicate callbacks/validation notifications are idempotent. A browser success redirect alone never marks the attempt successful.

```text
Caller → payments: initiate (authenticated, idempotent)
payments → SSLCommerz adapter → sandbox: create/get session
payments → caller: provider hosted checkout URL
Customer → SSLCommerz hosted checkout
SSLCommerz → payments: success/fail/cancel return and/or IPN
payments → SSLCommerz adapter → Order Validation API
adapter → payments: normalized verified result
```

## Provider-neutral interface

Keep the interface small and provider-neutral; raw provider payloads stay inside the adapters. The exact TypeScript definitions are implementation work, but the approved operations are:

```ts
interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  verifyCallback(input: ProviderCallback): Promise<VerifiedPayment>;
  queryPayment(input: PaymentReference): Promise<VerifiedPayment>;
}
```

The shared input/result types carry the local merchant reference, provider reference where known, BDT amount in integer poisha, currency, checkout URL, normalized status, and verified reference/amount/currency facts. `ProviderCallback` is untrusted input. The adapter must perform authoritative provider verification before returning a verified success. Provider-specific response and callback schemas are not exposed to the rest of the application.

The Payment module—not the provider adapter—owns persistence, idempotency, authenticated ownership checks, status transitions, and callback routing. Provider adapters do not import or mutate bookings, ledger, wallet, or marketplace state.

## Payment-attempt lifecycle

```text
created → pending → verification_pending → succeeded
                   ↘                    ↘ failed
                    ↘                    ↘ cancelled
created → verification_pending (ambiguous create response)
```

- Persist the merchant reference, provider reference, provider, amount, currency, status, and relevant timestamps.
- Status vocabulary for #19: `created`, `pending`, `verification_pending`, `succeeded`, `failed`, `cancelled`.
- A timeout or missing callback is not a failure; keep the attempt `pending` or `verification_pending` until authoritative verification.
- Only verified provider results can resolve an attempt to `succeeded`, `failed`, or `cancelled`.
- Verify merchant reference, provider reference, amount, and currency against the attempt before applying a result.
- Repeated initiation with the same idempotency key/body returns the same attempt/response; key reuse with a different body is rejected under existing idempotency rules.
- Duplicate callbacks are safe and cannot produce duplicate successful transitions. Terminal states do not regress.
- Payment success describes a sandbox provider transaction only; it does not itself transition booking or create academic ledger/settlement entries.

## Persistence, configuration, and safety

- Store amounts as `BIGINT` integer poisha. Persist only required attempt fields and minimal provider references/status metadata.
- Apply uniqueness and idempotency constraints to merchant/provider references and initiation requests. Exact column sizes/index definitions and the ownership FK/association are finalized when implementing the table and must support authenticated ownership validation.
- Never store provider credentials, access tokens, customer PINs/OTPs, or unnecessary raw callback bodies.
- Use the root `.env.example` as canonical, placeholders only. Keep sandbox credentials/endpoints separate from production configuration. For #19, do not load production credentials, expose a production selector, or implement fallback to a live endpoint.
- Sandbox endpoint/credential mismatch must fail closed. No credential or provider response secret may be logged.

## API surface

- Authenticated Payment initiation endpoint; exact path and request/response contract are defined during implementation using existing `/api/v1`, Zod, and OpenAPI conventions.
- Provider-specific callback/return/IPN endpoints as required by the selected provider flows; exact paths/contracts are defined during implementation.
- Validate caller ownership at initiation and correlate all provider callbacks to a persisted attempt.
- Provider return URLs do not constitute confirmation. Callbacks are verified using Execute/Query for bKash and Order Validation for SSLCommerz.
- No booking transition, refund, installment, payout, or settlement endpoint is part of #19. Academic installment workflows may orchestrate sandbox attempts through the payment boundary; all payout/settlement outcomes are simulated.

## Acceptance criteria

### Automated tests

- Provider adapter unit tests use mocked HTTP responses and cover successful, failed, cancelled, pending/inconclusive, timeout, malformed response, provider error, and reference/amount/currency mismatch cases.
- Payment module tests cover authenticated ownership checks, initiation idempotency, same-key retries, conflicting key/body reuse, duplicate callbacks, duplicate success prevention, terminal-state monotonicity, and no booking-state mutation.
- Callback verification tests prove that browser redirects/callback claims alone never mark payment successful.
- Configuration tests prove that only sandbox hosts/credentials are accepted and that production endpoints/credentials cannot be selected or used.

### Provider sandbox roundtrips

- bKash: successful and failed one-time Tokenized Checkout without agreement; verify through Execute and Query as applicable.
- SSLCommerz: successful and failed Hosted Checkout; verify through Order Validation.
- Roundtrip tests must exercise the real provider sandbox and callback/return/IPN paths, not only mocks. If sandbox credentials or callback access are unavailable, document the limitation and leave #19 open.

## Implementation gate and order

1. Verify **INF-01** complete: repo scaffold, folder structure, lint/format.
2. Verify **INF-02** complete: Express + TypeScript + Prisma ORM 7 + MariaDB backend base, depending on INF-01.
3. Inspect the established tooling from INF-01/INF-02; do not add a test dependency without approval. Add the Payment module, schema/migration, routes, configuration, and adapters within the approved boundaries.
4. Implement bKash adapter, then SSLCommerz adapter (or parallelize after the shared interface/config is fixed).
5. Pass automated tests and both successful/failed sandbox roundtrips before closing #19.

INF-01 and INF-02 are separate from #19 and are schedule entries, not GitHub issues. **Do not start #19 implementation until both are verified complete.**
