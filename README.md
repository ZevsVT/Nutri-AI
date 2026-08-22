# NutriAI

NutriAI is a responsive AI nutrition assistant prototype focused on one trustworthy loop: capture food, confirm recognition, see sourced estimates, and understand what to do next.

## Run locally

```bash
npm install
npm run dev
```

The first version uses local demo data and a simulated AI recognition flow. No API keys are needed. See [`docs/architecture.md`](docs/architecture.md) for the information architecture, schema, API contracts, and production integration boundary.

## Production integration notes

Add authentication, server-side meal-analysis routes, PostgreSQL/Prisma, storage, and USDA FoodData Central behind the API boundary before using real user data. Keep AI and nutrition-provider keys on the server and retain the source/confidence metadata with every result.
