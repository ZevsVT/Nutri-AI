# NutriAI MVP architecture

## Information architecture

The authenticated shell uses one primary navigation model across breakpoints:

| Area | Purpose | MVP state |
| --- | --- | --- |
| Dashboard | Answer “how am I doing today?” with meals, habits, and one practical insight | Demo data |
| Analyze | Capture a meal, review recognition, then explain and save it | Functional client flow |
| Diary | Review logged meals by day and meal type | Demo data + saved analysis |
| Insights | Show transparent nutrition patterns, never a body score | Demo data |
| AI assistant | Ask about the current day and receive short, grounded explanations | Mock assistant |
| Recipes | Browse practical, culturally relevant meal ideas | Demo data |
| Profile | Preferences, privacy, and account controls | UI scaffold |

The primary task is intentionally three steps: capture → confirm → understand.
AI recognition metadata may be persisted for audit and correction, but it is
never treated as confirmed meal nutrition without an explicit confirmation
action.

## Component hierarchy

```text
AppShell
├── Sidebar / BottomNav
├── TopBar
└── ViewRouter
    ├── DashboardView
    │   ├── DailyOverview
    │   ├── QuickAnalyzeCard
    │   ├── MealList / MealCard
    │   └── NutritionInsight
    ├── AnalyzeView
    │   ├── CapturePanel
    │   ├── RecognitionReview
    │   └── AnalysisResult
    ├── DiaryView
    ├── InsightsView
    ├── AssistantView
    ├── RecipesView
    └── ProfileView
```

## Domain schema

Issue #7 maps the first persistence foundation to PostgreSQL/Prisma:

```text
User(id, email, role, status, createdAt, updatedAt)
UserPreference(userId, language, timezone, dietaryPreference, foodPreferences[], foodExclusions[])
UserConsent(userId, consentType, version, status, grantedAt, revokedAt, createdAt)
Food(id, canonicalName, nameVi, nameEn, aliases[], cuisine, category, isActive)
FoodSource(id, name, provider, sourceType, sourceUrl, license)
NutritionVersion(id, sourceId, version, effectiveFrom, effectiveTo)
FoodNutrition(id, foodId, nutritionVersionId, servingAmount, servingUnit, nutrition values)
Meal(id, userId, mealType, capturedAt, status, imageUrl, confirmedAt, deletedAt)
MealItem(id, mealId, foodId, quantity, unit, displayName, confidence)
MealItemNutrition(mealItemId, nutritionVersionId, sourceId, nutrition snapshot)
NutritionAnalysis(mealId, status, cached totals, method, confidence)
AIAnalysis(userId, mealId, provider, model, status, inputType, confidence)
AIFoodPrediction(analysisId, foodId, predictedName, quantity, confidence)
AICorrection(analysisId, predictionId, userId, correctionType, corrected food/portion)
Recipe(id, nameVi, nameEn, servings, preparation times, difficulty, status)
RecipeIngredient(recipeId, foodId, quantity, unit)
RecipeNutrition(recipeId, nutrition values)
WaterLog(id, userId, loggedAt, amountMl)
NutritionInsight(id, userId, periodStart, periodEnd, type, summary, data)
```

`MealItemNutrition` preserves the values, portion, source, and nutrition version
used at confirmation time. A model can classify food and portion; it must not
invent nutrition facts. The database details, delete strategy, migrations, and
repository boundaries are documented in [`docs/database.md`](database.md).

## API contracts

The implemented versioned contracts, ownership rules, response envelope, and
error catalogue are documented in [`api.md`](api.md).

All production endpoints are server-side and validate payloads before touching the database. API and AI keys never ship to the browser.

```text
GET  /api/foods/search?q=&locale=
GET  /api/foods/:id
POST /api/meals                         -> create manually confirmed meal
GET  /api/meals?from=&to=
PATCH /api/meals/:id
DELETE /api/meals/:id
POST /api/meal-analysis                 -> upload reference, return analysis id
GET  /api/meal-analysis/:id             -> poll structured recognition result
POST /api/meal-analysis/:id/confirm     -> save user-corrected items
POST /api/ai/chat                       -> grounded response from server context
GET  /api/nutrition/daily?date=
GET  /api/nutrition/weekly?from=&to=
GET  /api/recipes?tags=&cuisine=
POST /api/barcode/scan
```

The analysis service follows:

```text
input → vision recognition → food normalization → nutrition source lookup
      → portion calculation → confidence → grounded explanation
```

USDA FoodData Central is the international baseline. A curated Vietnamese-food table should be normalized into the same `FoodNutrition` shape and cached server-side.

## User flow

```text
Register → short onboarding → Dashboard → Analyze
  → capture photo/text → recognition review
  → edit items/portion → confirm
  → nutrition facts + practical explanation → Save to diary
  → Diary / Insights / grounded AI assistant
```

Safety copy stays neutral: values are estimates, a meal is not “good” or “bad”, and medical conditions/allergies route to qualified healthcare advice.

## Current prototype boundary

The repository currently contains a client-only, realistic demo implementation so the complete journey can be evaluated without credentials. The mock service is deliberately isolated from the UI data model; replacing it with the contracts above is the next integration step.
