# Admin-console permission reconciliation

**Status:** Approved mapping for #11; approved additions are not yet seeded. **Date:** 2026-11-10. Related: [issue #11](https://github.com/habibur5/COLDLINK/issues/11), [#9](https://github.com/habibur5/COLDLINK/issues/9), [#10](https://github.com/habibur5/COLDLINK/issues/10), and ADR-0003.

This document reconciles #11's operations with the settled #9/#10 decisions. It does not modify those decisions or itself seed/update the runtime permission catalog. Approved additions must enter through #9's versioned migration process and be explicitly assigned to the bootstrap Platform Admin. Do not automatically grant them to ordinary users or existing roles.

## Governing rules

- Use the `resource.action` format and existing #9 authorization model: server-side checks, deny wins, default deny, and no authority inferred from role names.
- On party-scoped resources, use the base key for a record where the caller is a party and `.any` only for cross-party access. Non-party resources have no `.any` form. There is no `.own` suffix.
- Do not introduce global or resource wildcards for Admin Console access.
- Preserve #9's explicit Platform Admin assignment rule for new curated keys. Preserve #10's flag catalog, precedence, lifecycle, and permissions unchanged.
- Permission assignment changes use revoke plus grant and require both corresponding permissions. There is no separate update permission.
- `delete` remains soft deletion/deactivation only. These additions create no new deletion operations or live financial capabilities.

## Reuse settled keys

| #11 operation | Reuse | Scope/purpose |
|---|---|---|
| Inspect service applications and provider verification; approve/reject/request information | `service-application.read`; `provider-verification.read`, `.approve`, `.reject`, `.request-info` | Add `.any` for cross-party records. Use the settled `request-info` spelling. |
| Suspend/reinstate provider accounts and service applications/capabilities | `user.suspend`, `.reinstate`; `service-application.suspend`, `.reinstate` | Add `.any` for cross-party records. These actions already exist in #9; do not add parallel provider-verification suspension keys. Reasons and audit apply as required. |
| Inspect, suspend, and reinstate facilities/vehicles | `facility.read`, `.suspend`, `.reinstate`; `vehicle.read`, `.suspend`, `.reinstate` | Add `.any` for cross-party records. Status actions already exist in #9; verification decisions remain separately permissioned. |
| Inspect/cancel bookings | `booking.read`, `.cancel` | Add `.any` for cross-party records. Exceptional staff transitions are separately listed below. |
| Inspect/file/resolve disputes; provider response | `dispute.read`, `.create`, `.resolve`, `.update` | Add `.any` for cross-party reads, farmer-on-behalf creation, and resolution. Provider response uses party-scoped `dispute.update`; providers cannot resolve. Do not add `dispute.file`. |
| Inspect sandbox payment attempts | `payment.read` | Add `.any` for cross-party attempts; inspection only. |
| Inspect/approve/reject refunds | `refund.read`, `.approve`, `.reject` | Add `.any` for cross-party records. Simulated submission and confirmation are distinct approved additions below. |
| Inspect/create/waive penalties | `penalty.read`, `.create`, `.waive` | Add `.any` for cross-party records. Appeal submission is party-scoped; review, appeal resolution, simulated collection, and reduction are separate additions below. |
| Inspect ledger and modeled balances; settlement operations | `ledger.read`; `settlement.read`, `.create`, `.approve`, `.execute` | Add `.any` for cross-party records. `execute` remains simulation-only and never authorizes a real transfer. |
| Role CRUD and role membership | `role.read`, `.create`, `.update`, `.delete`, `.assign`, `.unassign` | Global resource; no `.any`. `delete` means deactivation. Role membership keys do not grant/revoke permissions within a role. |
| Inspect permission catalog | `permission.read` | Global and runtime read-only; it does not permit catalog edits or assignment changes. |
| Feature flags | #10 exact keys: `feature-flag.create`, `.read`, `.update`, `.override-role`, `.override-provider`, `.override-user`, `.archive` | Global resource; no `.any`. No `feature-flag.delete`; archive is irreversible and not implied by update. |
| Platform settings | `platform-setting.read`, `.update` | Existing policy catalog only; global, no `.any`. |
| Bounded operational counts | `report.read` | Global, no `.any`; no extra metrics, exports, or analytics. |
| Audit log | `audit-log.read` | Global, no `.any`; does not permit editing or deleting records. |

## Approved additions for the #9 catalog follow-up

Every key below is approved for inclusion through the #9 migration/catalog process. The `.any` suffix is used only for cross-party access. These are catalog decisions, not implementation authorization.

| Approved key | Exact operation | Scope and purpose |
|---|---|---|
| `facility.approve.any` | Approve a specific facility's evidence | Cross-party facility verification, independently of provider approval |
| `facility.reject.any` | Reject a specific facility's evidence | Cross-party; rejection reason required |
| `facility.request-info.any` | Request facility evidence/information | Cross-party facility review; distinct from provider capability verification |
| `vehicle.approve.any` | Approve a specific vehicle's evidence | Cross-party vehicle verification, independently of provider approval |
| `vehicle.reject.any` | Reject a specific vehicle's evidence | Cross-party; rejection reason required |
| `vehicle.request-info.any` | Request vehicle evidence/information | Cross-party vehicle review |
| `booking.approve.any` | Approve a provider's booking component as an exceptional staff action | Cross-party; reason required; obey booking state machine, party, verification, and capacity rules |
| `booking.complete.any` | Mark a booking component completed as an exceptional staff action | Cross-party; reason required; obey booking state machine and business invariants; no separate case document or supporting evidence required |
| `refund.record-submission.any` | Record simulated refund submission | Cross-party academic simulation; not a provider API call or confirmation |
| `refund.record-confirmation.any` | Record simulated refund confirmation | Cross-party academic simulation; separate from submission and no provider API call |
| `penalty.review.any` | Review whether a reported failure/violation supports an assessment | Cross-party review under the existing penalty rules |
| `penalty.appeal` | Submit an appeal on a party-scoped penalty | Party-scoped provider operation; no `.any` in this key |
| `penalty.resolve-appeal.any` | Resolve a provider penalty appeal | Cross-party decision under existing appeal rules |
| `penalty.record-collection.any` | Record simulated penalty collection | Cross-party academic simulation; no actual money collection |
| `penalty.reduce.any` | Record a policy-compliant partial penalty reduction | Cross-party; distinct from waiver |
| `commission.read` | Read commission configuration | Global configuration for already-approved provider/service rates and exceptions |
| `commission.update` | Update commission configuration | Global; limited to approved rates, negotiated exceptions, and snapshot rules; no new financial policies/fees/charges |
| `role.grant-permission` | Grant a permission within an editable role | Global role operation; distinct from assigning a role to a user |
| `role.revoke-permission` | Revoke a permission within an editable role | Global role operation; distinct from unassigning a role |
| `user.grant-permission.any` | Grant a user-level ALLOW or DENY assignment | Cross-party user; DENY reasons remain mandatory under ADR-0003 |
| `user.revoke-permission.any` | Revoke a user-level permission assignment | Cross-party user; authorization change is audited |

### Permission-assignment changes

Changing an existing role or user permission assignment is performed as a revoke plus grant. The operation requires both the relevant `*.revoke-permission` and `*.grant-permission` permissions. No `role.update-permission` or `user.update-permission.any` key is added. Role grants/revocations concern role-permission membership; user grants/revocations concern direct user-level assignments. Catalog editing remains migration/seeding-only.

## Explicit exclusions and constraints

- Do not change #9's catalog model, permission sources, resolution, bootstrap behavior, or other settled decisions. Additions are explicitly granted to the bootstrap Platform Admin by the migration, not to ordinary users or existing roles.
- Do not change #10's flag catalog, scopes, precedence, lifecycle, or permissions.
- Do not add duplicate facility/vehicle/service-application suspend or reinstate keys; those actions are already in #9.
- Do not add broad wildcard permissions, hard deletion, real-money transfer/collection, live provider calls, or policy-bypassing operations.
- All financial behavior remains within the already-approved simulated workflows and policy boundaries.
