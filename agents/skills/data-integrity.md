# Data Integrity & Data Safety Skill

Use whenever code can read, transform, migrate, seed, or persist data.

## Core Rule

> Never change data merely because it is convenient.

## Data Classes

Classify data as:

- configuration
- static reference data
- user-generated data
- AI-generated data
- system-generated data
- historical records
- analytics
- secrets

## Immutable vs Mutable

Ask:

> Should this record change after confirmation?

For Nutri-AI:

- confirmed nutrition should normally remain historically stable
- user preferences may change
- canonical food definitions may be versioned
- AI predictions should remain distinguishable from confirmed values

## Nutrition Provenance

Preserve:

```text
source
version
calculation context
confidence
timestamp where relevant
```

## Seed Safety

Seeds must be:

- deterministic
- repeatable
- development-only unless explicitly designed otherwise
- incapable of silently overwriting production data

## Migration Safety

Before migration:

```text
old schema
 ↓
data impact
 ↓
new schema
 ↓
verification
```

## User Isolation

Prefer:

```text
findMealForUser(mealId, userId)
```

over assuming a global ID is enough.

## AI Data Separation

Keep:

```text
AI prediction
Trusted source
User correction
User-confirmed value
```

separate.

## Final Data Check

Ask:

- Were any IDs changed?
- Were any records deleted?
- Were seed values changed?
- Were nutrition values changed?
- Were historical values preserved?
- Were migrations reviewed?
- Were test records isolated?
