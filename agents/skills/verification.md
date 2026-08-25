# Verification Skill

## Purpose

Make verification mandatory after every meaningful change.

## Static Checks

Run when available:

```text
lint
typecheck
format check
```

## Build

Run the production build.

## Focused Tests

Run:

```text
target tests
  ↓
module tests
  ↓
integration tests
```

Start with tests closest to the change.

## Database Changes

For schema work:

```text
schema validation
 ↓
migration
 ↓
seed
 ↓
integration tests
```

Verify:

- relationships
- constraints
- delete behavior
- historical data
- indexes

## API Changes

Test:

- happy path
- validation failure
- unauthorized
- forbidden
- not found
- conflict
- server error
- rate limiting when relevant

## Regression Review

Ask:

> What adjacent feature could this change break?

## Diff Review

Always inspect:

```bash
git status
git diff --stat
git diff
```

Every changed file must be explainable.

## Final Report

```text
Implemented:
Verified:
Not verified:
Risks:
Follow-up:
```

Never claim a check passed unless it actually ran.
