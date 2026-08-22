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

The primary task is intentionally three steps: capture → confirm → understand. AI output is never persisted without an explicit confirmation action.

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

The first server implementation should map these models to PostgreSQL/Prisma:

```text
User(id, email, createdAt, updatedAt)
UserPreference(userId, locale, ageRange, dietaryPreferences[], allergies[], interests[])
Food(id, canonicalName, aliases[], cuisine, category)
FoodNutrition(id, foodId, servingAmount, servingUnit, calories, proteinG, carbsG, fatG, fiberG, sugarG, sodiumMg, sourceId, nutritionVersion)
FoodSource(id, name, externalId, sourceUrl, retrievedAt)
Meal(id, userId, mealType, loggedAt, status, imageUrl, confidence, createdAt, updatedAt)
MealItem(id, mealId, foodId, label, amount, unit, confidence, nutritionSnapshot)
NutritionAnalysis(id, mealId, structuredResult, explanation, source, confidence, nutritionVersion)
AIConversation(id, userId, contextMealId, createdAt, updatedAt)
AIMessage(id, conversationId, role, content, groundingContext, createdAt)
Recipe(id, title, cuisine, tags[], ingredients[], steps[], nutrition, allergens[])
WaterLog(id, userId, loggedAt, amountMl)
NutritionInsight(id, userId, periodStart, periodEnd, type, message, evidence)
UserConsent(id, userId, consentType, version, grantedAt, revokedAt)
```

Every nutrition record carries `source`, `confidence`, and `nutritionVersion`. A model can classify food and portion; it must not invent nutrition facts.

## API contracts

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
