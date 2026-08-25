# Architecture Safety Skill

## Goal

Prevent AI agents from replacing working architecture unnecessarily.

## Preserve Existing Architecture

Before introducing a new pattern, identify:

- current pattern
- module boundary
- dependency direction
- state ownership
- data access pattern

Prefer extension over replacement.

## Default Architecture

For the current Nutri-AI stage:

```text
Frontend
    ↓
API
    ↓
Application services
    ↓
Repositories
    ↓
PostgreSQL
```

Prefer a modular monolith unless scale or requirements prove otherwise.

## Domain Ownership

Example:

```text
foods
 ├── food rules
 └── food repository

meals
 ├── meal rules
 └── meal repository

ai
 ├── analysis rules
 └── AI provider
```

Avoid duplicating business rules in controllers and frontend.

## Reject Unnecessary Architecture Changes

Do not introduce:

- microservices
- CQRS
- event-driven infrastructure
- multiple databases
- generic ORM wrappers
- competing architectural patterns

unless clearly required.
