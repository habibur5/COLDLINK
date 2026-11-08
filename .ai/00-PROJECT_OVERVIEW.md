# ColdLink — Project Overview

ColdLink is a Bangladesh-focused marketplace where farmers compare and book cold storage and agricultural transport. Follow the **Waterfall Model**: requirements → architecture/data design → implementation → verification → release, with review gates between phases. `.ai/12-development-strategy.md` is the source of truth for feature grades and exclusions; `CONTEXT.md` is the domain glossary.

## Feature grades

**Production-grade core:** advanced permission-based RBAC, secure authentication/sessions, user/provider management, provider and resource verification, deterministic matching and recommendations, routing, booking lifecycle, transactional capacity management, API/security/database integrity, operational admin, and bKash/SSLCommerz sandbox checkout. These retain the approved architecture and receive production-grade validation and testing. Payment endpoints remain sandbox-only.

**Academic-grade:** automated installment schedule/collection workflows, refunds, provider financial ledger, commission, simulated provider settlement/withdrawal, dispute-resolution enhancements and other retained future features. These require coherent business logic, database persistence, validation and tests where applicable. External financial actions may only be simulated or use sandbox payment attempts.

## Core product rules

- A service request covers one crop, one quantity and storage-only, transportation-only, or both.
- Fulfillment can be split across any number of storage and transport slots. Search is deterministic and heuristic, not exhaustive or AI/ML; only feasible bundles are ranked.
- Storage compatibility, capacity, availability, active status and route feasibility gate eligibility. Transport additionally requires vehicle suitability, capacity, availability, and that pickup lies in that vehicle's own declared service area. No universal storage radius.
- Routing is provider-abstracted; default OSRM on Bangladesh OSM data. Route absence means infeasible; routing and matching rules are documented in ADR-0001/0002 and `01`.
- Booking snapshots agreed prices and uses a transaction with row locking for capacity safety. Booking/component state transitions and capacity correctness are production-grade.
- A user has no fixed account type. Authorization uses the accepted permission model in ADR-0003: server-side, default-deny, explicit party scope, deny-wins and auditable.
- Provider capability approval and each resource's verification are separate marketplace visibility gates (ADR-0005). Legal evidence uncertainty is tracked in #20; no regulator-system integration is in scope.
- No hard deletion of records referenced by bookings; deactivation/soft deletion preserves history.

## Payment and finance boundary

- Supported checkout integrations: bKash one-time Tokenized Checkout Sandbox and SSLCommerz Hosted Checkout Sandbox. Persist attempts, verify with authoritative provider APIs, enforce idempotency, and never let callbacks alone confirm success.
- Storage installments, overstay, and extension workflows follow ADR-0010: persisted academic obligations and deterministic simulated collection only. No recurring agreement, live debit, invoice, or financial enforcement beyond cancelling an unpaid required initial deposit.
- Refund, commission, ledger, dispute-finance and settlement concepts may have persisted academic records and simulated state transitions. ColdLink never holds funds, initiates live refunds, issues payouts, or settles real money.
- No production payment integration, live transaction, Hold.bd/partner engagement, real custody, payout, settlement, or production refund processing.

## Stack and architecture

React/TypeScript frontend; Node.js/Express/TypeScript backend; Prisma ORM 7 with MariaDB driver adapter; MariaDB/InnoDB; Redis/BullMQ where needed; Zod validation; pino logging; Sentry. ORM choice is ADR-0007. Existing infrastructure completion must be confirmed from code in `.ai/09-feature-progress.md`.

## Explicitly excluded

AI/ML recommendations, weather prediction, live GPS tracking, blockchain, multi-currency, native mobile apps, production payments/real-money operations, actual custody/payout/settlement, real regulatory-system integrations, and real-world payment partnerships.

## Planning references

- `.ai/12-development-strategy.md`: Waterfall gates, feature grades, issue allocation, exclusions.
- `.ai/11-project-schedule.md`: sequential Waterfall phase plan and gates.
- `.ai/09-feature-progress.md`: code-inspected implementation status.
- `.ai/10-DB-SCHEMA.md`: data-model reference; update it before schema implementation.
- `.ai/adr/`: accepted architecture decisions; ADR-0006, ADR-0008, and ADR-0010 include the financial scope boundaries.
