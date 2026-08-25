import {
  AIInputType,
  AIAnalysisStatus,
  ConsentStatus,
  ConsentType,
  FoodSourceType,
  InsightSeverity,
  MealStatus,
  MealType,
  NutritionAnalysisStatus,
  PrismaClient,
  RecipeDifficulty,
  RecipeStatus,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

const demoUserId = "00000000-0000-0000-0000-000000000100";
const curatedSourceId = "00000000-0000-0000-0000-000000000110";
const curatedVersionId = "00000000-0000-0000-0000-000000000111";
const usdaSourceId = "00000000-0000-0000-0000-000000000120";
const usdaVersionId = "00000000-0000-0000-0000-000000000121";

const foodDefinitions = [
  {
    id: "00000000-0000-0000-0000-000000000201",
    canonicalName: "pho-bo",
    nameVi: "Phở bò",
    nameEn: "Beef pho",
    category: "noodle soup",
    cuisine: "Vietnamese",
    foodType: "main dish",
    aliases: ["phở bò", "pho bo", "PHO BO"],
    nutrition: [560, 28, 52, 14, 5, 4, 1100],
  },
  {
    id: "00000000-0000-0000-0000-000000000202",
    canonicalName: "pho-bo-tai",
    nameVi: "Phở bò tái",
    nameEn: "Rare beef pho",
    category: "noodle soup",
    cuisine: "Vietnamese",
    foodType: "main dish",
    aliases: ["phở bò tái", "pho bo tai", "phở tái"],
    nutrition: [590, 31, 53, 16, 5, 4, 1150],
  },
  {
    id: "00000000-0000-0000-0000-000000000203",
    canonicalName: "bun-bo-hue",
    nameVi: "Bún bò Huế",
    nameEn: "Bun bo Hue",
    category: "noodle soup",
    cuisine: "Vietnamese",
    foodType: "main dish",
    aliases: ["bún bò Huế", "bun bo hue", "bun bo Hue"],
    nutrition: [620, 30, 60, 18, 4, 4, 1300],
  },
  {
    id: "00000000-0000-0000-0000-000000000204",
    canonicalName: "bun-cha",
    nameVi: "Bún chả",
    nameEn: "Bun cha",
    category: "rice noodle",
    cuisine: "Vietnamese",
    foodType: "main dish",
    aliases: ["bún chả", "bun cha"],
    nutrition: [540, 27, 58, 19, 4, 9, 980],
  },
  {
    id: "00000000-0000-0000-0000-000000000205",
    canonicalName: "com-tam",
    nameVi: "Cơm tấm",
    nameEn: "Broken rice plate",
    category: "rice plate",
    cuisine: "Vietnamese",
    foodType: "main dish",
    aliases: ["cơm tấm", "com tam", "cơm sườn"],
    nutrition: [640, 24, 75, 23, 3, 7, 900],
  },
  {
    id: "00000000-0000-0000-0000-000000000206",
    canonicalName: "com-tam-suon-bi-cha",
    nameVi: "Cơm tấm sườn bì chả",
    nameEn: "Broken rice with pork, shredded pork skin and egg meatloaf",
    category: "rice plate",
    cuisine: "Vietnamese",
    foodType: "main dish",
    aliases: ["cơm tấm sườn bì chả", "com tam suon bi cha"],
    nutrition: [780, 37, 78, 34, 3, 10, 1250],
  },
  {
    id: "00000000-0000-0000-0000-000000000207",
    canonicalName: "banh-mi-thit",
    nameVi: "Bánh mì thịt",
    nameEn: "Vietnamese pork banh mi",
    category: "sandwich",
    cuisine: "Vietnamese",
    foodType: "main dish",
    aliases: ["bánh mì thịt", "banh mi thit", "bánh mì"],
    nutrition: [430, 19, 49, 18, 3, 7, 850],
  },
  {
    id: "00000000-0000-0000-0000-000000000208",
    canonicalName: "goi-cuon",
    nameVi: "Gỏi cuốn",
    nameEn: "Vietnamese fresh spring roll",
    category: "fresh roll",
    cuisine: "Vietnamese",
    foodType: "side dish",
    aliases: ["gỏi cuốn", "goi cuon", "summer roll"],
    nutrition: [180, 8, 24, 6, 3, 5, 410],
  },
  {
    id: "00000000-0000-0000-0000-000000000209",
    canonicalName: "com-ga",
    nameVi: "Cơm gà",
    nameEn: "Vietnamese chicken rice",
    category: "rice plate",
    cuisine: "Vietnamese",
    foodType: "main dish",
    aliases: ["cơm gà", "com ga", "chicken rice"],
    nutrition: [610, 34, 68, 20, 2, 4, 780],
  },
  {
    id: "00000000-0000-0000-0000-000000000210",
    canonicalName: "banh-xeo",
    nameVi: "Bánh xèo",
    nameEn: "Vietnamese crispy pancake",
    category: "savory pancake",
    cuisine: "Vietnamese",
    foodType: "main dish",
    aliases: ["bánh xèo", "banh xeo"],
    nutrition: [510, 18, 45, 27, 4, 6, 760],
  },
  {
    id: "00000000-0000-0000-0000-000000000211",
    canonicalName: "xoi",
    nameVi: "Xôi",
    nameEn: "Sticky rice",
    category: "rice dish",
    cuisine: "Vietnamese",
    foodType: "breakfast",
    aliases: ["xôi", "xoi", "sticky rice"],
    nutrition: [360, 9, 62, 9, 2, 2, 470],
  },
  {
    id: "00000000-0000-0000-0000-000000000212",
    canonicalName: "chao",
    nameVi: "Cháo",
    nameEn: "Vietnamese rice porridge",
    category: "rice porridge",
    cuisine: "Vietnamese",
    foodType: "breakfast",
    aliases: ["cháo", "chao", "rice porridge"],
    nutrition: [280, 14, 38, 7, 1, 2, 520],
  },
] as const;

function normalizeAlias(alias: string): string {
  return alias
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

async function main(): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const curatedSource = await transaction.foodSource.upsert({
      where: { id: curatedSourceId },
      update: {
        name: "Nutri-AI Vietnamese food table",
        provider: "Nutri-AI",
        sourceType: FoodSourceType.CURATED,
        sourceReference: "nutri-ai-vietnamese-mvp-2026",
        license: "Internal curated development dataset",
      },
      create: {
        id: curatedSourceId,
        name: "Nutri-AI Vietnamese food table",
        provider: "Nutri-AI",
        sourceType: FoodSourceType.CURATED,
        sourceReference: "nutri-ai-vietnamese-mvp-2026",
        license: "Internal curated development dataset",
      },
    });

    await transaction.foodSource.upsert({
      where: { id: usdaSourceId },
      update: {
        name: "FoodData Central",
        provider: "USDA",
        sourceType: FoodSourceType.GOVERNMENT,
        sourceUrl: "https://fdc.nal.usda.gov/",
        license: "USDA FoodData Central terms",
      },
      create: {
        id: usdaSourceId,
        name: "FoodData Central",
        provider: "USDA",
        sourceType: FoodSourceType.GOVERNMENT,
        sourceUrl: "https://fdc.nal.usda.gov/",
        license: "USDA FoodData Central terms",
      },
    });

    const curatedVersion = await transaction.nutritionVersion.upsert({
      where: { id: curatedVersionId },
      update: { sourceId: curatedSource.id, version: "2026.01" },
      create: {
        id: curatedVersionId,
        sourceId: curatedSource.id,
        version: "2026.01",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    await transaction.nutritionVersion.upsert({
      where: { id: usdaVersionId },
      update: { sourceId: usdaSourceId, version: "2025.12" },
      create: {
        id: usdaVersionId,
        sourceId: usdaSourceId,
        version: "2025.12",
        effectiveFrom: new Date("2025-12-01T00:00:00.000Z"),
      },
    });

    const foods = new Map<string, { id: string; nameVi: string }>();
    for (const definition of foodDefinitions) {
      const food = await transaction.food.upsert({
        where: { id: definition.id },
        update: {
          canonicalName: definition.canonicalName,
          nameVi: definition.nameVi,
          nameEn: definition.nameEn,
          category: definition.category,
          cuisine: definition.cuisine,
          foodType: definition.foodType,
          isActive: true,
        },
        create: {
          id: definition.id,
          canonicalName: definition.canonicalName,
          nameVi: definition.nameVi,
          nameEn: definition.nameEn,
          category: definition.category,
          cuisine: definition.cuisine,
          foodType: definition.foodType,
        },
      });
      foods.set(definition.canonicalName, { id: food.id, nameVi: food.nameVi });

      for (const alias of definition.aliases) {
        await transaction.foodAlias.upsert({
          where: {
            normalizedAlias_language: {
              normalizedAlias: normalizeAlias(alias),
              language: "vi",
            },
          },
          update: { foodId: food.id, alias },
          create: {
            foodId: food.id,
            alias,
            normalizedAlias: normalizeAlias(alias),
            language: "vi",
          },
        });
      }

      const [calories, protein, carbohydrates, fat, fiber, sugar, sodium] =
        definition.nutrition;
      await transaction.foodNutrition.upsert({
        where: {
          foodId_nutritionVersionId: {
            foodId: food.id,
            nutritionVersionId: curatedVersion.id,
          },
        },
        update: {
          servingAmount: 1,
          servingUnit: "serving",
          calories,
          protein,
          carbohydrates,
          fat,
          fiber,
          sugar,
          sodium,
        },
        create: {
          foodId: food.id,
          nutritionVersionId: curatedVersion.id,
          servingAmount: 1,
          servingUnit: "serving",
          calories,
          protein,
          carbohydrates,
          fat,
          fiber,
          sugar,
          sodium,
        },
      });
    }

    const demoUser = await transaction.user.upsert({
      where: { id: demoUserId },
      update: {
        email: "demo@nutri-ai.local",
        name: "Demo Thanh",
        role: UserRole.USER,
      },
      create: {
        id: demoUserId,
        email: "demo@nutri-ai.local",
        name: "Demo Thanh",
        role: UserRole.USER,
      },
    });

    await transaction.userPreference.upsert({
      where: { userId: demoUser.id },
      update: {
        language: "vi",
        timezone: "Asia/Ho_Chi_Minh",
        dietaryPreference: "balanced",
        activityContext: "moderately_active",
        foodPreferences: ["Vietnamese food", "fresh herbs"],
        foodExclusions: [],
      },
      create: {
        userId: demoUser.id,
        language: "vi",
        timezone: "Asia/Ho_Chi_Minh",
        dietaryPreference: "balanced",
        activityContext: "moderately_active",
        foodPreferences: ["Vietnamese food", "fresh herbs"],
      },
    });

    await transaction.userConsent.upsert({
      where: { id: "00000000-0000-0000-0000-000000000130" },
      update: {
        userId: demoUser.id,
        consentType: ConsentType.AI_PROCESSING,
        version: "2026.01",
        status: ConsentStatus.GRANTED,
        grantedAt: new Date("2026-08-22T05:30:00.000Z"),
        revokedAt: null,
      },
      create: {
        id: "00000000-0000-0000-0000-000000000130",
        userId: demoUser.id,
        consentType: ConsentType.AI_PROCESSING,
        version: "2026.01",
        status: ConsentStatus.GRANTED,
        grantedAt: new Date("2026-08-22T05:30:00.000Z"),
      },
    });

    await transaction.waterLog.upsert({
      where: { id: "00000000-0000-0000-0000-000000000131" },
      update: {
        userId: demoUser.id,
        amountMl: 350,
        loggedAt: new Date("2026-08-22T05:20:00.000Z"),
      },
      create: {
        id: "00000000-0000-0000-0000-000000000131",
        userId: demoUser.id,
        amountMl: 350,
        loggedAt: new Date("2026-08-22T05:20:00.000Z"),
      },
    });

    const pho = foods.get("pho-bo");
    if (!pho) {
      throw new Error("Seed food pho-bo was not created");
    }

    const mealId = "00000000-0000-0000-0000-000000000301";
    const mealItemId = "00000000-0000-0000-0000-000000000302";
    const analysisId = "00000000-0000-0000-0000-000000000303";
    const predictionId = "00000000-0000-0000-0000-000000000304";

    await transaction.meal.upsert({
      where: { id: mealId },
      update: {
        name: "Phở bò",
        mealType: MealType.LUNCH,
        capturedAt: new Date("2026-08-22T05:40:00.000Z"),
        confirmedAt: new Date("2026-08-22T05:42:00.000Z"),
        status: MealStatus.CONFIRMED,
        deletedAt: null,
      },
      create: {
        id: mealId,
        userId: demoUser.id,
        name: "Phở bò",
        mealType: MealType.LUNCH,
        capturedAt: new Date("2026-08-22T05:40:00.000Z"),
        confirmedAt: new Date("2026-08-22T05:42:00.000Z"),
        status: MealStatus.CONFIRMED,
      },
    });

    await transaction.mealItem.upsert({
      where: { id: mealItemId },
      update: {
        mealId,
        foodId: pho.id,
        quantity: 1,
        unit: "serving",
        displayName: pho.nameVi,
        confidence: 0.87,
      },
      create: {
        id: mealItemId,
        mealId,
        foodId: pho.id,
        quantity: 1,
        unit: "serving",
        displayName: pho.nameVi,
        confidence: 0.87,
      },
    });

    await transaction.mealItemNutrition.upsert({
      where: { mealItemId },
      update: {
        nutritionVersionId: curatedVersion.id,
        sourceId: curatedSource.id,
        servingAmount: 1,
        servingUnit: "serving",
        calories: 560,
        protein: 28,
        carbohydrates: 52,
        fat: 14,
        fiber: 5,
        sugar: 4,
        sodium: 1100,
        estimated: true,
        confidence: 0.87,
      },
      create: {
        mealItemId,
        nutritionVersionId: curatedVersion.id,
        sourceId: curatedSource.id,
        servingAmount: 1,
        servingUnit: "serving",
        calories: 560,
        protein: 28,
        carbohydrates: 52,
        fat: 14,
        fiber: 5,
        sugar: 4,
        sodium: 1100,
        estimated: true,
        confidence: 0.87,
      },
    });

    await transaction.nutritionAnalysis.upsert({
      where: { mealId },
      update: {
        status: NutritionAnalysisStatus.COMPLETED,
        totalCalories: 560,
        totalProtein: 28,
        totalCarbohydrates: 52,
        totalFat: 14,
        totalFiber: 5,
        confidence: 0.87,
        method: "food-nutrition-snapshot",
        version: curatedVersion.version,
      },
      create: {
        mealId,
        status: NutritionAnalysisStatus.COMPLETED,
        totalCalories: 560,
        totalProtein: 28,
        totalCarbohydrates: 52,
        totalFat: 14,
        totalFiber: 5,
        confidence: 0.87,
        method: "food-nutrition-snapshot",
        version: curatedVersion.version,
      },
    });

    const aiAnalysis = await transaction.aIAnalysis.upsert({
      where: { id: analysisId },
      update: {
        userId: demoUser.id,
        mealId,
        provider: "demo",
        model: "demo-recognizer",
        status: AIAnalysisStatus.COMPLETED,
        inputType: AIInputType.TEXT,
        confidence: 0.87,
        startedAt: new Date("2026-08-22T05:40:30.000Z"),
        completedAt: new Date("2026-08-22T05:40:31.000Z"),
      },
      create: {
        id: analysisId,
        userId: demoUser.id,
        mealId,
        provider: "demo",
        model: "demo-recognizer",
        status: AIAnalysisStatus.COMPLETED,
        inputType: AIInputType.TEXT,
        confidence: 0.87,
        startedAt: new Date("2026-08-22T05:40:30.000Z"),
        completedAt: new Date("2026-08-22T05:40:31.000Z"),
      },
    });

    await transaction.aIFoodPrediction.upsert({
      where: { id: predictionId },
      update: {
        analysisId: aiAnalysis.id,
        foodId: pho.id,
        predictedName: pho.nameVi,
        confidence: 0.87,
        estimatedQuantity: 1,
        estimatedUnit: "serving",
      },
      create: {
        id: predictionId,
        analysisId: aiAnalysis.id,
        foodId: pho.id,
        predictedName: pho.nameVi,
        confidence: 0.87,
        estimatedQuantity: 1,
        estimatedUnit: "serving",
      },
    });

    await transaction.nutritionInsight.upsert({
      where: { id: "00000000-0000-0000-0000-000000000305" },
      update: {
        userId: demoUser.id,
        periodStart: new Date("2026-08-22T00:00:00.000Z"),
        periodEnd: new Date("2026-08-22T23:59:59.000Z"),
        type: "PLANT_VARIETY",
        title: "Thêm một thực phẩm giàu chất xơ",
        summary:
          "Bữa trưa đã có rau thơm; thêm một phần trái cây hoặc đậu vào buổi tối sẽ đa dạng hơn.",
        severity: InsightSeverity.POSITIVE,
        confidence: 0.72,
        data: { source: "demo-seed", foodCount: 4 },
      },
      create: {
        id: "00000000-0000-0000-0000-000000000305",
        userId: demoUser.id,
        periodStart: new Date("2026-08-22T00:00:00.000Z"),
        periodEnd: new Date("2026-08-22T23:59:59.000Z"),
        type: "PLANT_VARIETY",
        title: "Thêm một thực phẩm giàu chất xơ",
        summary:
          "Bữa trưa đã có rau thơm; thêm một phần trái cây hoặc đậu vào buổi tối sẽ đa dạng hơn.",
        severity: InsightSeverity.POSITIVE,
        confidence: 0.72,
        data: { source: "demo-seed", foodCount: 4 },
      },
    });

    await transaction.recipe.upsert({
      where: { id: "00000000-0000-0000-0000-000000000306" },
      update: {
        nameVi: "Gỏi cuốn tôm rau thơm",
        nameEn: "Shrimp fresh rolls",
        description: "Gỏi cuốn tươi với rau thơm và nước chấm nhẹ.",
        servings: 2,
        prepTime: 20,
        difficulty: RecipeDifficulty.EASY,
        status: RecipeStatus.PUBLISHED,
      },
      create: {
        id: "00000000-0000-0000-0000-000000000306",
        nameVi: "Gỏi cuốn tôm rau thơm",
        nameEn: "Shrimp fresh rolls",
        description: "Gỏi cuốn tươi với rau thơm và nước chấm nhẹ.",
        servings: 2,
        prepTime: 20,
        difficulty: RecipeDifficulty.EASY,
        status: RecipeStatus.PUBLISHED,
      },
    });
  });

  process.stdout.write(
    `Seeded ${foodDefinitions.length} Vietnamese foods and demo data.\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
