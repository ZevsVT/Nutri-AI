# Change Control Skill

## Purpose

Prevent scope creep and uncontrolled modification.

## Change Classification

Every change must be:

### Required
Directly necessary for the issue.

### Supporting
Needed to make the requested change safe.

### Optional
Useful but not required.

Implement only Required + Supporting changes by default.

## File-Level Rule

For every changed file ask:

> What exact requirement requires this file to change?

If there is no clear answer, do not change it.

## Refactor Rule

A refactor is justified only if:

- the current structure blocks implementation
- the current structure causes a correctness problem
- the current structure creates a real security issue
- the feature genuinely requires shared logic

"Cleaner" is not enough.

## Dependency Rule

Adding/upgrading a dependency requires:

```text
Dependency:
Reason:
Why existing dependencies are insufficient:
Version:
Risk:
```

Avoid unrelated upgrades.

## Database Change Rule

Classify migrations:

```text
SAFE ADDITIVE
POTENTIALLY BREAKING
DESTRUCTIVE
DATA TRANSFORM
```

Destructive/data-transform changes require impact analysis, recovery consideration, and verification.

## API Change Rule

Changes to:

- URL
- HTTP method
- request body
- response body
- status codes
- authentication behavior

are contract changes.

Update consumers, tests, and documentation.

## Final Scope Audit

Compare:

```text
Expected files vs actual files
Expected APIs vs actual APIs
Expected data changes vs actual data changes
Expected dependencies vs actual dependencies
```

Unexpected changes must be removed or explicitly justified.
