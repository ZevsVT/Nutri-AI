# AI correction feedback

Analyze keeps its original food predictions, amounts, units, and model
identity. When a user confirms, the server compares the submitted final list
with the original prediction IDs. A new item yields `FOOD_ADDED`. An omitted
prediction yields `FOOD_REMOVED`. A linked prediction can yield separate
`FOOD_REPLACED`, `NAME_CORRECTED`, and `PORTION_CHANGED` records if the user
changed those fields. An unchanged prediction yields no correction.

The meal, snapshots, feedback rows, and feedback timestamp commit in a single
transaction. A repeat confirmation returns the same meal. A failed or
cancelled review does not produce feedback. Feedback remains separate from
catalog publication and historical nutrition snapshots.

## Evaluation report

Apply migrations and use the backend directory with an authorized,
read-only reporting database connection.

```bash
npm run --silent feedback:report
```

The command includes only active confirmed meals with a current,
separately recorded `AI_PROCESSING` grant for version
`correction-evaluation-v1`. The grant is for correction evaluation.
Only record it when the user has explicitly agreed to that purpose.
Revocation removes the account's meals from subsequent reports.
[Consent management issue #39](https://github.com/ZevsVT/Nutri-AI/issues/39)

The JSON has one group per provider, model and model version. Removals,
replacements, renames, and portion edits are divided by the number of
original predictions. Multiple edits on one prediction count once in the
changed-prediction total and once per applicable correction type.
Additions are divided by the number of confirmed, tracked reviews.
An empty denominator yields null. Rows without the new feedback
timestamp, including old placeholder additions and ID-less legacy
confirmations, appear only in the legacy counts.

The report also lists up to 30 catalog-food correction totals, using active
Vietnamese catalog names. It does not emit user IDs, prediction IDs, free-text
corrections, transcripts, notes, or media references. The command is intended
for authorized maintainers and does not train a model.

## Check a matching change

Use the isolated PostgreSQL tests and controlled provider fixtures to check a
candidate change before release. One fixture puts a Vietnamese name with
diacritics in conflict with another food's normalized alias. The improved
matching rule resolves the uniquely exact Vietnamese name and leaves the
unaccented input ambiguous. The same test confirms a reviewed draft,
compares expected correction counts and rates, and verifies that revoking
evaluation consent excludes it from the report.
