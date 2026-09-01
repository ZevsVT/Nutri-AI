import {
  AIInputType,
  AIAnalysisStatus,
  ConsentStatus,
  ConsentType,
  FoodSourceType,
  InsightSeverity,
  MealStatus,
  MealType,
  PrismaClient,
  RecipeDifficulty,
  RecipeStatus,
  UserRole,
} from "@prisma/client";
import {
  normalizeFoodText,
  slugifyFoodName,
} from "../src/modules/foods/food-taxonomy.js";
import {
  validateFoodDefinitions,
  vietnameseFoodDefinitions,
} from "./vietnamese-foods.js";

const prisma = new PrismaClient();

const demoUserId = "00000000-0000-0000-0000-000000000100";
const curatedSourceId = "00000000-0000-0000-0000-000000000110";
const curatedVersionId = "00000000-0000-0000-0000-000000000111";
const usdaSourceId = "00000000-0000-0000-0000-000000000120";
const usdaVersionId = "00000000-0000-0000-0000-000000000121";

interface FoodDefinition {
  id: string;
  canonicalName: string;
  nameVi: string;
  nameEn: string;
  category: string;
  cuisine: string;
  foodType: string;
  aliases: string[];
  nutrition?: readonly [number, number, number, number, number, number, number];
  subcategory?: string;
  region?: string;
  cookingMethod?: string;
  servingUnit?: string;
  defaultServingSize?: number;
}

const foodDefinitions: FoodDefinition[] = [
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
];

// Identity-only records intentionally carry no nutrition values. Nutrition is
// added only when backed by a reviewed source/version.
const additionalFoodDefinitions: FoodDefinition[] = [
  ["gao", "Gạo", "Rice", "STAPLE", "INGREDIENT", "RAW"],
  ["thit-bo", "Thịt bò", "Beef", "MEAT", "INGREDIENT", "RAW"],
  ["thit-ga", "Thịt gà", "Chicken", "POULTRY", "INGREDIENT", "RAW"],
  ["ca-loc", "Cá lóc", "Snakehead fish", "SEAFOOD", "INGREDIENT", "RAW"],
  [
    "ca-kho-to",
    "Cá kho tộ",
    "Caramelized fish in clay pot",
    "SEAFOOD",
    "DISH",
    "BRAISED",
  ],
  ["ga-luoc", "Gà luộc", "Boiled chicken", "POULTRY", "DISH", "BOILED"],
  ["ga-nuong", "Gà nướng", "Grilled chicken", "POULTRY", "DISH", "GRILLED"],
  [
    "thit-kho",
    "Thịt kho",
    "Vietnamese braised pork",
    "MEAT",
    "DISH",
    "BRAISED",
  ],
  ["canh-chua", "Canh chua", "Sour soup", "SOUP", "DISH", "SIMMERED"],
  [
    "rau-muong",
    "Rau muống",
    "Water spinach",
    "VEGETABLES",
    "INGREDIENT",
    "RAW",
  ],
  [
    "rau-muong-xao-toi",
    "Rau muống xào tỏi",
    "Stir-fried morning glory with garlic",
    "VEGETABLES",
    "DISH",
    "STIR_FRIED",
  ],
  ["dau-hu", "Đậu hũ", "Tofu", "PLANT_PROTEIN", "INGREDIENT", "STEAMED"],
  [
    "dau-hu-chien",
    "Đậu hũ chiên",
    "Fried tofu",
    "PLANT_PROTEIN",
    "DISH",
    "FRIED",
  ],
  ["chuoi", "Chuối", "Banana", "FRUITS", "INGREDIENT", "RAW"],
  ["xoai", "Xoài", "Mango", "FRUITS", "INGREDIENT", "RAW"],
  [
    "cha-gio",
    "Chả giò",
    "Vietnamese fried spring roll",
    "SNACK",
    "SNACK",
    "FRIED",
  ],
  ["banh-cuon", "Bánh cuốn", "Steamed rice rolls", "SNACK", "DISH", "STEAMED"],
  ["che", "Chè", "Vietnamese sweet soup", "DESSERT", "DESSERT", "SIMMERED"],
  [
    "ca-phe-sua-da",
    "Cà phê sữa đá",
    "Vietnamese iced coffee with condensed milk",
    "BEVERAGE",
    "BEVERAGE",
    "OTHER",
  ],
  ["nuoc-mia", "Nước mía", "Sugarcane juice", "BEVERAGE", "BEVERAGE", "OTHER"],
  ["nuoc-mam", "Nước mắm", "Fish sauce", "CONDIMENT", "CONDIMENT", "FERMENTED"],
  ["tuong-ot", "Tương ớt", "Chili sauce", "CONDIMENT", "CONDIMENT", "OTHER"],
  [
    "mi-quang",
    "Mì Quảng",
    "Quang-style noodles",
    "NOODLES",
    "DISH",
    "SIMMERED",
  ],
  [
    "hu-tieu",
    "Hủ tiếu",
    "Southern Vietnamese noodle soup",
    "NOODLES",
    "DISH",
    "SIMMERED",
  ],
  [
    "banh-canh",
    "Bánh canh",
    "Thick tapioca noodle soup",
    "NOODLES",
    "DISH",
    "SIMMERED",
  ],
  ["banh-trang", "Bánh tráng", "Rice paper", "STAPLE", "INGREDIENT", "DRIED"],
  [
    "sua-chua-dong-hop",
    "Sữa chua đóng hộp",
    "Packaged yogurt",
    "PACKAGED_FOOD",
    "PACKAGED_FOOD",
    "OTHER",
  ],
].map(([slug, nameVi, nameEn, category, foodType, cookingMethod], index) => ({
  id: `00000000-0000-0000-0000-0000000003${String(index + 1).padStart(2, "0")}`,
  canonicalName: slug,
  nameVi,
  nameEn,
  category,
  cuisine: "Vietnamese",
  foodType,
  aliases: [slug.replace(/-/g, " "), nameEn.toLowerCase()],
  region: "NATIONWIDE",
  cookingMethod,
  servingUnit: "SERVING",
  defaultServingSize: 1,
}));

function normalizeAlias(alias: string): string {
  return normalizeFoodText(alias);
}

const categoryMap: Record<string, string> = {
  "noodle soup": "NOODLES",
  "rice noodle": "NOODLES",
  "rice plate": "RICE",
  "rice dish": "RICE",
  "rice porridge": "RICE",
  sandwich: "STAPLE",
  "fresh roll": "SNACK",
  "savory pancake": "SNACK",
};
const foodTypeMap: Record<string, string> = {
  "main dish": "DISH",
  "side dish": "DISH",
  breakfast: "MEAL",
};

// These legacy definitions document the pre-Issue #14 seed shape; only the
// dedicated UTF-8 catalog is written now.
void foodDefinitions;
void additionalFoodDefinitions;

async function main(): Promise<void> {
  validateFoodDefinitions(vietnameseFoodDefinitions);
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

    await transaction.nutritionVersion.upsert({
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

    // The former MVP seed contained unverified demo nutrition numbers. Keep
    // the source/version records for provenance, but remove those mappings and
    // snapshots so this catalog never presents fabricated nutrition data.
    await transaction.mealItemNutrition.deleteMany({
      where: { sourceId: curatedSource.id },
    });
    await transaction.foodNutrition.deleteMany({
      where: { nutritionVersionId: curatedVersionId },
    });
    await transaction.nutritionAnalysis.deleteMany({
      where: { mealId: "00000000-0000-0000-0000-000000000301" },
    });

    const foods = new Map<string, { id: string; nameVi: string }>();
    for (const definition of vietnameseFoodDefinitions) {
      const slug = slugifyFoodName(definition.nameVi);
      const existing = await transaction.food.findFirst({
        where: {
          OR: [
            { id: definition.id },
            { canonicalName: definition.canonicalName },
            { slug },
          ],
        },
        select: { id: true },
      });
      const food = await transaction.food.upsert({
        where: { id: existing?.id ?? definition.id },
        update: {
          canonicalName: definition.canonicalName,
          slug,
          normalizedName: normalizeFoodText(definition.nameVi),
          nameVi: definition.nameVi,
          nameEn: definition.nameEn,
          category: categoryMap[definition.category] ?? definition.category,
          subcategory: definition.subcategory ?? definition.category,
          cuisine: definition.cuisine,
          foodType: foodTypeMap[definition.foodType] ?? definition.foodType,
          region: definition.region ?? "NATIONWIDE",
          cookingMethod: definition.cookingMethod ?? "OTHER",
          servingUnit: definition.servingUnit ?? "SERVING",
          defaultServingSize: definition.defaultServingSize ?? 1,
          status: "ACTIVE",
          isActive: true,
        },
        create: {
          id: definition.id,
          canonicalName: definition.canonicalName,
          slug: slugifyFoodName(definition.nameVi),
          normalizedName: normalizeFoodText(definition.nameVi),
          nameVi: definition.nameVi,
          nameEn: definition.nameEn,
          category: categoryMap[definition.category] ?? definition.category,
          subcategory: definition.subcategory ?? definition.category,
          cuisine: definition.cuisine,
          foodType: foodTypeMap[definition.foodType] ?? definition.foodType,
          region: definition.region ?? "NATIONWIDE",
          cookingMethod: definition.cookingMethod ?? "OTHER",
          servingUnit: definition.servingUnit ?? "SERVING",
          defaultServingSize: definition.defaultServingSize ?? 1,
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
    }

    const componentLinks = [
      ["com-tam", "gao"],
      ["com-ga", "thit-ga"],
      ["pho-bo", "thit-bo"],
      ["canh-chua", "ca-loc"],
    ] as const;
    for (const [foodName, componentName] of componentLinks) {
      const food = foods.get(foodName);
      const component = foods.get(componentName);
      if (!food || !component) continue;
      await transaction.foodComponent.upsert({
        where: {
          foodId_componentFoodId: {
            foodId: food.id,
            componentFoodId: component.id,
          },
        },
        update: { quantity: 1, unit: "SERVING" },
        create: {
          foodId: food.id,
          componentFoodId: component.id,
          quantity: 1,
          unit: "SERVING",
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
    `Seeded ${vietnameseFoodDefinitions.length} Vietnamese foods and demo data (nutrition mappings intentionally omitted until source-reviewed).\n`,
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
