# ADR-0010: English-only V1

**Status:** Accepted for V1. **Date:** 2026-11-09. Resolves the V1 scope decision in [GitHub issue #12](https://github.com/habibur5/COLDLINK/issues/12).

## Decision

ColdLink V1 uses English across the entire platform: user interface, API errors and messages, catalog labels, admin panel, and notifications.

V1 has no language selector, user language preference, automatic language detection, locale negotiation, Bangla content, translation table, or localization-specific frontend dependency. User-entered free text—including addresses, notes, and descriptions—remains as entered and is not translated.

Identifiers and authorization values are language-independent: entity identifiers, permission keys, booking references, and feature-flag keys are never localized or derived from translated labels. Caches need no locale dimension in V1.

Bangla localization and any supporting translation model or frontend internationalization library are deferred. They require a separately approved feature and requirements/design decision; do not pre-build localization infrastructure for V1.

## Consequences

- Catalog values and system-provided text are authored in English only.
- V1 APIs do not expose or consume locale-selection behavior.
- Existing optional schema notes for Bangla fields are deferred and must not be implemented as part of V1.
- Future localization must preserve stable identifiers and authorization semantics and explicitly define translation coverage, fallback, caching, and untranslated free-text behavior.
