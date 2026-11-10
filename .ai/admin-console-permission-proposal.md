# Admin-console permission-key proposal

**Status:** Proposed for review; not approved and not part of the seeded catalog. **Date:** 2026-11-10. Scope: [issue #11](https://github.com/habibur5/COLDLINK/issues/11). Existing decisions in [#9](https://github.com/habibur5/COLDLINK/issues/9), [#10](https://github.com/habibur5/COLDLINK/issues/10), and ADR-0003 remain authoritative and unchanged.

This proposal reuses settled keys wherever possible. Only the keys in the “Proposed additions” table are candidates for addition, and none may be seeded or used until approved. `resource.action` follows ADR-0003. Party-scoped resources use a base key for party records and `.any` only for cross-party records. Global/non-party resources have no `.any`. No broad wildcard is proposed.

## Reuse settled keys

| #11 operation | Reuse | Scope/purpose |
|---|---|---|
| Application and capability review | `service-application.read`; `provider-verification.read`, `.approve`, `.reject`, `.request-info` | Use `.any` when reviewing a non-party applicant. `request-info` is the settled action spelling; do not add `service-application.request-information`. |
| Account status | `user.suspend`, `user.reinstate` | Add `.any` for staff acting on a non-party user. Reasons and audit remain required by #11/ADR-0003. |
| Facility/vehicle inspection and status | `facility.read`, `.suspend`, `.reinstate`; `vehicle.read`, `.suspend`, `.reinstate` | Use `.any` only for non-party facilities/vehicles. Approval/rejection/information-request keys are not settled for these resources; see proposed additions. |
| Booking inspection/cancellation | `booking.read`, `booking.cancel` | Use `.any` for cross-party booking access/cancellation. Cancellation remains subject to the approved override reason and lifecycle constraints. |
| Dispute inspection, filing, resolution | `dispute.read`, `.create`, `.resolve` | Use `.any` for staff cross-party access. Farmer-on-behalf filing reuses `dispute.create.any`; do not add `dispute.file`. Provider responses use party-scoped permissions and do not permit resolution. |
| Sandbox payment-attempt inspection | `payment.read` | Use `.any` for non-party payment attempts; inspection only. |
| Refund decisions | `refund.read`, `.approve`, `.reject` | Use `.any` for staff cross-party cases. Simulation submission/confirmation are separate candidate actions below. |
| Penalty assessment/waiver | `penalty.create`, `.read`, `.waive` | Use `.any` for non-party records. `penalty.create.any` records a policy-compliant assessment; waiver remains distinct from reduction. |
| Ledger and modeled balance approval | `ledger.read`; `settlement.approve` | Use `.any` for cross-party reads/approval. `settlement.approve.any` covers the eligible modeled Pending-to-Available transition under #21/ADR-0008. |
| Simulated withdrawal/settlement | `settlement.read`, `.create`, `.approve`, `.execute` | Use `.any` for staff cross-party records. `execute` means only the already-approved academic simulation; it must never initiate a real transfer. |
| Role CRUD and role membership | `role.read`, `.create`, `.update`, `.delete`, `.assign`, `.unassign` | Global resource; no `.any`. `delete` means deactivation. `assign/unassign` concern role membership, not permissions inside the role. |
| Permission catalog | `permission.read` | Global, runtime read-only catalog. It does not grant authority to edit the catalog or assign a permission to a role/user. |
| Feature-flag administration | `feature-flag.create`, `.read`, `.update`, `.override-role`, `.override-provider`, `.override-user`, `.archive` | Reuse #10 exactly. Global resource; no `.any`. No `feature-flag.delete`; archive is separate and irreversible. |
| Platform settings | `platform-setting.read`, `.update` | Reuse for the existing settings catalog only; global resource, no `.any`. |
| Bounded operational counts | `report.read` | Reuse for the approved read-only counts; global resource, no `.any`. No exports or additional analytics. |
| Audit log | `audit-log.read` | Global resource, no `.any`; read permission does not allow editing/deleting audit records. |

## Proposed additions — approval required

All keys below are **proposals only**. `.any` is shown only where the operation targets a record outside the staff member's party relationship.

| Proposed key | Exact operation | Scope | Why it is a gap |
|---|---|---|---|
| `facility.approve.any` | Approve evidence for a specific facility | Cross-party | #9 settles facility read/status actions but not resource-verification decisions. |
| `facility.reject.any` | Reject evidence for a specific facility, requiring reason | Cross-party | Rejection must be separately permissioned from approval. |
| `facility.request-info.any` | Request additional evidence/information for a facility review | Cross-party | Existing `provider-verification.request-info` concerns capability verification; facility review is a distinct gate under ADR-0005. |
| `vehicle.approve.any` | Approve evidence for a specific vehicle | Cross-party | Same independent resource-verification gap. |
| `vehicle.reject.any` | Reject evidence for a specific vehicle, requiring reason | Cross-party | Rejection must be separately permissioned from approval. |
| `vehicle.request-info.any` | Request additional evidence/information for a vehicle review | Cross-party | Vehicle review is a distinct resource-verification gate. |
| `provider-verification.suspend.any` | Suspend an approved service capability | Cross-party | Capability suspension is not application suspension and is absent from the settled provider-verification actions. |
| `provider-verification.reinstate.any` | Reinstate a suspended service capability | Cross-party | Separate reinstatement action is required; application lifecycle keys are not a substitute. |
| `booking.approve.any` | Staff exceptional approval of a provider's booking component | Cross-party | #9 does not settle this staff override key; it is not ordinary party approval. |
| `booking.complete.any` | Staff exceptional marking of a booking component as completed | Cross-party | #9 rejects per-transition permissions for ordinary party actions; this is only the specifically approved cross-party staff override and requires a reason. |
| `refund.simulate-submit.any` | Record the simulated submission step of an academic refund | Cross-party | #22 distinguishes submission from completion; existing `refund.approve/reject` do not authorize submission. |
| `refund.simulate-confirm.any` | Record simulated refund confirmation/completion | Cross-party | Separate from simulated submission and does not call a provider. |
| `penalty.review.any` | Review whether a reported provider failure/violation supports assessment | Cross-party | #22 requires review before an eligible post-acceptance penalty; no settled review action exists. |
| `penalty.resolve-appeal.any` | Decide a provider penalty appeal, including partial approval | Cross-party | Appeal decisions are distinct from penalty assessment and waiver. |
| `penalty.simulate-collect.any` | Record authorized simulated collection of an assessed penalty | Cross-party | #22 defines simulated collection; no settled penalty collection key exists. |
| `penalty.reduce.any` | Record a policy-compliant partial penalty reduction | Cross-party | #22 distinguishes partial reduction from waiver; user requested separate permissions. |
| `commission.read` | Read provider/service commission rates and exceptions | Global configuration | #9 has no `commission` resource. This avoids overloading the broader `platform-setting` permission. |
| `commission.update` | Create/update the already-defined provider/service rates and negotiated exceptions under #21/ADR-0008 | Global configuration | Same resource gap. It does not authorize new rates, fees, or financial policies. |
| `role.grant-permission` | Add a permission assignment to an editable role | Global role | `role.assign` is role membership; `permission.read` is catalog-only. Neither authorizes editing a role's permission bundle. |
| `role.update-permission` | Change an existing permission assignment/effect on an editable role | Global role | Separates permission-bundle changes from general role metadata updates. |
| `role.revoke-permission` | Remove a permission assignment from an editable role | Global role | Permission revocation needs explicit authority and audit; system/bootstrap constraints remain governed by ADR-0003. |
| `user.grant-permission.any` | Grant a user-level ALLOW or DENY assignment | Cross-party user | `user.update` is too broad; no settled key authorizes user-level permission assignment. DENY reason requirements remain per ADR-0003. |
| `user.update-permission.any` | Change an existing user-level permission assignment/effect | Cross-party user | Assignment modification is distinct from grant and revocation. |
| `user.revoke-permission.any` | Revoke a user-level permission assignment | Cross-party user | Revocation needs explicit authority and audit. |

## Constraints retained

- These proposals do not change #9's resource catalog, its fixed/versioned seeding model, its role/user assignment sources, or its deferred action-set decision. If approved, additions must follow #9's migration and explicit Platform Admin assignment rules.
- They do not change #10's flag catalog, scope, precedence, lifecycle, or exact permission keys.
- They do not authorize hard deletion, live payment/refund/collection, real payout/settlement, or bypass of #21/#22 policy.
- No `resource.*` wildcard is proposed as a shortcut for granting console access. Each proposed key is a distinct operation; `.any` is limited to cross-party access.

## Approval requested

Review the proposed keys, particularly the commission resource, booking overrides, simulated refund/penalty operations, and role/user permission grant-update-revoke actions. Do not add these keys to the catalog or implement them until explicitly approved.
