# ADR-0011: Authentication sessions and contact verification

**Status:** Accepted for V1. Resolves the production-grade authentication/session decisions in [GitHub issue #13](https://github.com/habibur5/COLDLINK/issues/13). Authentication implementation remains not started; see `.ai/09-feature-progress.md`.

## Context

Issue #13 asks for token transport and lifetimes, refresh-token rotation and persistence, registration/contact rules, email and phone verification, contact changes, and session behavior. The project has no authentication implementation yet. This ADR records the approved product/security contract; API response schemas and implementation details remain subject to the existing design boundaries.

## Decisions

### Registration and contact methods

1. Signup requires an email address. Phone-only signup is not allowed in V1. A user may also provide a phone number, but it is an optional, unverified contact; phone verification and SMS delivery are outside V1.
2. Normalize email by trimming and case-normalizing it; normalize phone numbers to E.164. Enforce uniqueness on the normalized current email and phone values. Reject a contact collision without merging accounts or transferring ownership, using a non-enumerating response where practical.
3. An unverified phone is stored with `phone_verified_at = NULL`, displayed masked and labelled unverified, and cannot be used to log in or recover an account in V1. A later, separately approved OTP flow may verify it.
4. A new contact must be verified before it becomes active. For email changes, retain the current verified email until the new email is verified, then switch atomically. A pending change never weakens the email-verification gate. A changed phone remains unverified until a future phone-verification flow.
5. Preserve prior contact values and their change/verification history. Historical values do not reserve current-contact uniqueness; a former value can be attached to another account only after that user independently proves control. Do not merge accounts based on a historical contact match.

### Email verification gate

6. Email verification is mandatory before **any account functionality or user action**. Before verification, allow only registration, email verification, resend-verification, and a limited login/logout flow needed to reach or leave verification. An unverified login returns a limited verification-required result and issues no access or refresh tokens. No profile, session-management, or product/account operation is available before verification.
7. Email-verification links are single-use and expire 24 hours after issuance. Resending verification invalidates any previous outstanding verification link for the account. Resend responses do not reveal whether an email address is registered; apply rate limits.

### Tokens and sessions

8. Access tokens use `Authorization: Bearer <access-token>`. The refresh endpoint uses `Authorization: Bearer <refresh-token>`; it validates token type and rejects an access token. Tokens are not transported in cookies or request bodies.
9. Access tokens last 15 minutes. Each refresh token lasts 30 days and is rotated on every successful refresh. Reuse of an already-rotated refresh token revokes that session's entire token family and requires re-authentication.
10. Store only cryptographic hashes of refresh tokens. Store one `auth_tokens` row per issued refresh token, linked to its session/token family. Set `used_at` when a token successfully rotates. Set `revoked_at` when a token is explicitly revoked; preserve token rows for reuse detection and history.
11. A user may have multiple active sessions (for example, across devices). Logout revokes only the current session. A separate revoke-all action revokes all the user's sessions. Revocation invalidates access and refresh tokens immediately, not only when their expiry is reached; authenticated requests check the associated server-side session status.
12. Access tokens carry user identity and a session reference, never permission claims. Authorization remains server-side as defined by ADR-0003.

## Consequences

- Email is required and verified for every usable V1 account; the older issue wording allowing phone-only registration is narrowed by this decision.
- The schema must support optional E.164 phone values, phone verification state, per-session status, linked refresh-token rotation history, and preserved contact history. See `.ai/10-DB-SCHEMA.md`.
- Exact auth response/error schemas, token serialization/format, and phone-input presentation contract remain implementation/API details to define using established repository conventions. Do not begin authentication implementation until the Waterfall design gate and required code/tooling inspection are satisfied.
- Phone verification, SMS delivery, phone login/recovery, and phone-only signup are not V1 capabilities.
