# Workflow Tracing Skill

Use when changing an existing feature, data flow, API, or business rule.

## Objective

Understand the complete runtime path before editing.

## Trace

```text
entry point
  ↓
caller
  ↓
function
  ↓
service
  ↓
repository/API
  ↓
database/external service
```

For every important value, record:

```text
origin
 ↓
type
 ↓
validation
 ↓
transformation
 ↓
storage
 ↓
consumer
```

Identify side effects:

- state mutation
- DB writes
- cache writes
- network calls
- uploads
- events
- analytics
- background jobs

Identify invariants, such as:

- confirmed nutrition remains reproducible
- user A cannot access user B's data
- IDs remain stable
- response contracts remain compatible

Trace nearby tests before editing.

## Before Coding

Create:

```text
FLOW

Entry:
Main path:
Data:
Side effects:
Persistence:
Tests:
Protected behavior:
```

## Stop Conditions

Stop and reassess if:

- the call chain is unclear
- data ownership is unclear
- a small change requires a broad rewrite
- a migration becomes destructive
- an API contract unexpectedly changes

Do not guess silently.
