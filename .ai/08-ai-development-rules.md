# AI Development Rules

Strict contract for AI agents. **The current user prompt defines WHAT to build. `.ai/` docs and existing code define HOW.**

## Decision hierarchy
```text
1 Current user request → 2 ColdLink decisions (.ai/) → 3 Existing code patterns → 4 Reusable code → 5 General best practice
```

## Before coding
1. Read the relevant docs: `01` architecture, `02` folders, `03` code, `04` + `10` (any DB work), `05` API, `06` modules, `07` git; `09` for status.
2. Inspect the existing code: modules, routes, services, entities, validation, error handling, naming. Docs alone do not describe the current implementation.
3. Find existing patterns and reusable code; extend before creating.
4. Decide exactly which files to create/modify/delete. Touch nothing "nearby".
5. If scope is unclear, name the ambiguity instead of silently picking an interpretation. Ask when it materially changes the implementation.

## Scope control
- Implement **only** what the current prompt asks. "User registration only" means no login, logout, refresh, password reset, verification, profile or roles.
- Not authorization to build: related features, common companions, documented/listed endpoints, future needs, "best practices".
- Smallest necessary change. Create/modify only necessary files. Preserve existing behavior.

## Never
- Refactor, reformat or "improve" unrelated code.
- Silently change architecture: swap Express, add layers, move logic across boundaries, change module boundaries.
- Add dependencies that are not needed or not in the approved stack (`00`). Undecided technologies (validation, auth, testing, etc.) are not selected.
- Modify unrelated modules (only for genuine cross-module needs).
- Put domain logic in `shared/` or business logic in routes/controllers/repositories.
- Duplicate another module's rules (`06` single-owner table).
- Invent endpoints, response envelopes, error formats or fields (`05`).
- Treat documented future features as tasks.
- Weaken authentication, authorization, access control or backend validation.

## Conflicts
- ColdLink decision beats generic best practice.
- Existing code beats assumptions: inspect it and follow its pattern.
- Anything listed under a doc's **Undecided**: follow existing code; if none, ask. Do not decide it.

## Feature checklist
- **Persistence:** reuse existing patterns; change only needed structures; keep relationships; follow `04` and `10`; capacity changes go through a transaction (`01`).
- **Input:** reuse existing validation approach; validate what the operation needs.
- **API:** preserve paths, methods and contracts (`05`).
- **Capacity conflict:** `409`.

## Verify after coding (report only what you actually ran)
TypeScript errors and unnecessary assertions · imports (missing, unused, wrong path, new dependency) · lint (if configured, else say so) · relevant existing tests (do not add a framework) · routes (method, path, registration, auth, response) · validation · DB changes/queries/relationships · expected failure cases.

## Completion report
```text
Created files:   <list or None>
Modified files:  <list or None>
Deleted files:   <list or None>
Why each change: <necessary for the requested feature>
Verification:    <checks performed; state any not performed>
Suggested commit: type(scope): description   (do NOT commit; see 07)
```
