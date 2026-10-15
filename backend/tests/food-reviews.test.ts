import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { PrismaClient, type UserRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import dotenv from "dotenv";
import { buildApp } from "../src/app/app.js";
import { loadConfig } from "../src/config/env.js";
import { PrismaAuthRepository } from "../src/modules/auth/auth.repository.js";
import { PrismaBusinessApiService } from "../src/modules/api/api.service.js";
import {
  ReviewRepository,
  fingerprint,
} from "../src/modules/food-reviews/review.repository.js";
import { ReviewService } from "../src/modules/food-reviews/review.service.js";
import { validBarcode } from "../src/modules/foods/barcode.js";
import {
  draftSchema,
  type DraftInput,
  type ReviewOperation,
  type Evidence,
} from "../src/modules/food-reviews/review.schemas.js";

dotenv.config();
const prefix = "/api/v1/admin/food-reviews";
const roles: UserRole[] = [
  "ADMIN",
  "NUTRITION_EDITOR",
  "MODERATOR",
  "USER",
  "SUPPORT",
];
const catalogEvidence: Evidence[] = [
  { kind: "CATALOG", reference: "Verified food table, page 18" },
];

test("review schemas reject identity patches and validate nutrition/product evidence boundaries", () => {
  assert.equal(validBarcode("4006381333931"), true);
  assert.equal(validBarcode("4006381333932"), false);
  assert.equal(validBarcode("abc123"), false);
  for (const actor of ["authorId", "reviewerId", "role"])
    assert.equal(
      draftSchema.safeParse({
        operation: {
          type: "CREATE_FOOD",
          canonicalName: "test",
          fields: { nameVi: "Test" },
        },
        explanation: "source",
        evidence: catalogEvidence,
        [actor]: randomUUID(),
      }).success,
      false,
    );
  assert.equal(
    draftSchema.safeParse({
      targetFoodId: randomUUID(),
      operation: {
        type: "UPDATE_FOOD",
        fields: { canonicalName: "replacement" },
      },
      explanation: "source",
      evidence: catalogEvidence,
    }).success,
    false,
  );
  assert.equal(fingerprint({ b: 2, a: 1 }), fingerprint({ a: 1, b: 2 }));
});

test(
  "PostgreSQL review workflow through real sessions",
  { timeout: 180000 },
  async (context) => {
    const configured = process.env.DATABASE_URL;
    if (!configured) {
      assert.ok(!process.env.CI, "CI must configure DATABASE_URL");
      context.skip("Set DATABASE_URL to run isolated PostgreSQL review tests");
      return;
    }
    const schema = `review18_${randomUUID().replaceAll("-", "")}`;
    const admin = new PrismaClient({
      datasources: { db: { url: configured } },
    });
    await admin.$connect(); // A configured database must never silently skip.
    const url = new URL(configured);
    url.searchParams.set("schema", schema);
    const prisma = new PrismaClient({ datasources: { db: { url: url.href } } });
    let app: FastifyInstance | undefined;
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const migrate = () =>
      execFileSync(
        process.execPath,
        [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
        { env: { ...process.env, DATABASE_URL: url.href }, stdio: "pipe" },
      );
    try {
      migrate();
      app = await buildApp({
        config: loadConfig({
          NODE_ENV: "development",
          AUTH_DEV_MODE: "true",
          RATE_LIMIT_ENABLED: "false",
          LOG_LEVEL: "silent",
          CORS_ORIGINS: "http://localhost:5173",
        }),
        authRepository: new PrismaAuthRepository(prisma),
        businessApiService: new PrismaBusinessApiService(prisma),
        reviewService: new ReviewService(new ReviewRepository(prisma)),
      });
      const api = app;
      const actors = new Map<string, { id: string; cookie: string }>();
      for (const role of [...roles, "OTHER_EDITOR", "OTHER_ADMIN"]) {
        const registered = await api.inject({
          method: "POST",
          url: "/api/v1/auth/register",
          payload: {
            email: `${role.toLowerCase()}@review.test`,
            name: role,
            password: "correct horse battery",
          },
        });
        assert.equal(registered.statusCode, 201, registered.body);
        const id = registered.json().data.user.id as string;
        await prisma.user.update({
          where: { id },
          data: {
            role:
              role === "OTHER_EDITOR"
                ? "NUTRITION_EDITOR"
                : role === "OTHER_ADMIN"
                  ? "ADMIN"
                  : (role as UserRole),
          },
        });
        const cookie = String(registered.headers["set-cookie"]).split(";")[0]!;
        actors.set(role, { id, cookie });
      }
      const request = (
        role: string,
        method: "GET" | "POST" | "PATCH",
        path: string,
        payload?: unknown,
      ) =>
        api.inject({
          method,
          url: path,
          headers: {
            cookie: actors.get(role)!.cookie,
            "x-food-review-request": "1",
          },
          ...(payload === undefined ? {} : { payload: payload as object }),
        });
      const create = async (
        operation: ReviewOperation,
        targetFoodId?: string,
        evidence = catalogEvidence,
        role = "NUTRITION_EDITOR",
        predecessorId?: string,
      ) => {
        const result = await request(role, "POST", prefix, {
          operation,
          targetFoodId,
          evidence,
          explanation: "Verified against authoritative evidence",
          predecessorId,
        });
        assert.equal(result.statusCode, 201, result.body);
        return result.json().data as {
          id: string;
          revision: number;
          state: string;
          content: { payload: ReviewOperation };
          history: { publication: { foodId: string } | null }[];
        };
      };
      const action = (
        id: string,
        name: string,
        role = "NUTRITION_EDITOR",
        revision = 1,
        extra: object = {},
      ) =>
        request(role, "POST", `${prefix}/${id}/${name}`, {
          revision,
          ...extra,
        });
      const publish = async (
        operation: ReviewOperation,
        foodId?: string,
        evidence = catalogEvidence,
      ) => {
        const review = await create(operation, foodId, evidence);
        const submit = await action(review.id, "submit");
        assert.equal(submit.statusCode, 200, submit.body);
        const approve = await action(review.id, "approve", "ADMIN");
        assert.equal(approve.statusCode, 200, approve.body);
        return approve.json().data as typeof review;
      };
      const food = await prisma.food.create({
        data: {
          canonicalName: "review-base-food",
          normalizedName: "review base food",
          nameVi: "Review base food",
          foodType: "DISH",
        },
      });
      const source = await prisma.foodSource.create({
        data: {
          name: "Review source",
          provider: "test",
          sourceType: "CURATED",
          sourceReference: "Verified table",
        },
      });
      const nutrition = (
        version: string,
        calories: number | null = 100,
      ): ReviewOperation => ({
        type: "PUBLISH_NUTRITION",
        sourceId: source.id,
        sourceVersion: version,
        referenceQuantity: 100,
        referenceUnit: "g",
        preparationState: "BOILED",
        values: {
          calories,
          protein: 10,
          carbohydrates: 10,
          fat: 2,
          fiber: 0,
          sugar: 0,
          sodium: 0,
        },
      });
      const nutritionEvidence = (
        foodId: string,
        version: string,
      ): Evidence[] => [
        {
          kind: "NUTRITION",
          reference: "Laboratory food composition table",
          foodId,
          sourceId: source.id,
          sourceVersion: version,
        },
      ];

      await context.test(
        "role policy, cookie protection and privileged fields",
        async () => {
          assert.equal((await api.inject({ url: prefix })).statusCode, 401);
          assert.equal(
            (
              await api.inject({
                url: prefix,
                headers: {
                  "x-development-user-id": actors.get("ADMIN")!.id,
                  "x-development-user-role": "ADMIN",
                },
              })
            ).statusCode,
            401,
          );
          for (const role of roles) {
            const canRead = ["ADMIN", "NUTRITION_EDITOR", "MODERATOR"].includes(
              role,
            );
            assert.equal(
              (await request(role, "GET", prefix)).statusCode,
              canRead ? 200 : 403,
            );
            const me = await request(role, "GET", "/api/v1/auth/me");
            assert.equal(
              me.json().data.user.permissions.includes("food-reviews:read"),
              canRead,
            );
            const draft = await request(role, "POST", prefix, {
              targetFoodId: food.id,
              operation: { type: "UPDATE_FOOD", fields: { description: role } },
              explanation: "Evidence",
              evidence: catalogEvidence,
            });
            assert.equal(
              draft.statusCode,
              ["ADMIN", "NUTRITION_EDITOR"].includes(role) ? 201 : 403,
              draft.body,
            );
          }
          for (const actor of ["authorId", "reviewerId", "role"])
            assert.equal(
              (
                await request("NUTRITION_EDITOR", "POST", prefix, {
                  targetFoodId: food.id,
                  operation: {
                    type: "UPDATE_FOOD",
                    fields: { description: "forged" },
                  },
                  explanation: "Evidence",
                  evidence: catalogEvidence,
                  [actor]: actors.get("ADMIN")!.id,
                })
              ).statusCode,
              400,
            );
          assert.equal(
            (
              await api.inject({
                method: "POST",
                url: prefix,
                headers: { cookie: actors.get("ADMIN")!.cookie },
                payload: {},
              })
            ).statusCode,
            403,
          );
          assert.equal(
            (
              await api.inject({
                method: "POST",
                url: prefix,
                headers: {
                  cookie: actors.get("ADMIN")!.cookie,
                  origin: "https://attacker.invalid",
                  "x-food-review-request": "1",
                },
                payload: {},
              })
            ).statusCode,
            403,
          );
          assert.equal(
            (
              await api.inject({
                method: "POST",
                url: "/api/v1/auth/register",
                payload: {
                  email: "forged@review.test",
                  name: "Forged",
                  password: "correct horse battery",
                  role: "ADMIN",
                },
              })
            ).statusCode,
            400,
          );
          assert.equal(
            (await request("ADMIN", "GET", prefix + "?pageSize=101"))
              .statusCode,
            400,
          );
          assert.equal(
            (await request("ADMIN", "GET", prefix + "/invalid-id")).statusCode,
            400,
          );
          assert.equal(
            (await request("ADMIN", "GET", prefix + "/" + randomUUID()))
              .statusCode,
            404,
          );
        },
      );

      await context.test(
        "draft ownership, immutable submission, decisions, successors and self approval",
        async () => {
          const draft = await create(
            { type: "UPDATE_FOOD", fields: { description: "First draft" } },
            food.id,
          );
          const edit = {
            revision: 1,
            operation: {
              type: "UPDATE_FOOD",
              fields: { description: "Reviewed revision" },
            },
            evidence: catalogEvidence,
            explanation: "Corrected evidence",
          };
          assert.equal(
            (
              await request(
                "OTHER_EDITOR",
                "PATCH",
                `${prefix}/${draft.id}`,
                edit,
              )
            ).statusCode,
            403,
          );
          assert.equal(
            (await request("ADMIN", "PATCH", `${prefix}/${draft.id}`, edit))
              .statusCode,
            403,
          );
          assert.equal(
            (
              await request(
                "NUTRITION_EDITOR",
                "PATCH",
                `${prefix}/${draft.id}`,
                edit,
              )
            ).statusCode,
            200,
          );
          assert.equal((await action(draft.id, "submit")).statusCode, 409);
          assert.equal(
            (await action(draft.id, "submit", "NUTRITION_EDITOR", 2))
              .statusCode,
            200,
          );
          assert.equal(
            (
              await request(
                "NUTRITION_EDITOR",
                "PATCH",
                `${prefix}/${draft.id}`,
                { ...edit, revision: 2 },
              )
            ).statusCode,
            409,
          );
          for (const role of [
            "NUTRITION_EDITOR",
            "MODERATOR",
            "USER",
            "SUPPORT",
          ]) {
            assert.equal(
              (await action(draft.id, "approve", role, 2)).statusCode,
              403,
            );
            assert.equal(
              (
                await action(draft.id, "reject", role, 2, {
                  reason: "Evidence",
                })
              ).statusCode,
              403,
            );
          }
          assert.equal(
            (await action(draft.id, "reject", "ADMIN", 2)).statusCode,
            400,
          );
          assert.equal(
            (await action(draft.id, "reject", "ADMIN", 2, { reason: " " }))
              .statusCode,
            400,
          );
          assert.equal(
            (
              await action(draft.id, "reject", "ADMIN", 2, {
                reason: "Source mismatch",
              })
            ).statusCode,
            200,
          );
          assert.equal(
            (await action(draft.id, "withdraw", "NUTRITION_EDITOR", 2))
              .statusCode,
            409,
          );
          const successor = await create(
            { type: "UPDATE_FOOD", fields: { description: "Successor" } },
            food.id,
            catalogEvidence,
            "NUTRITION_EDITOR",
            draft.id,
          );
          assert.equal(
            (await action(successor.id, "withdraw")).statusCode,
            200,
          );
          const history = await request(
            "MODERATOR",
            "GET",
            `${prefix}/${draft.id}/history`,
          );
          assert.equal(history.json().data.length, 4);
          assert.equal(
            history.json().data[0].content.payload.fields.description,
            "First draft",
          );
          assert.equal(
            history.json().data[3].content.payload.fields.description,
            "Reviewed revision",
          );
          await assert.rejects(
            prisma.foodReviewRevision.update({
              where: { reviewId_revision: { reviewId: draft.id, revision: 2 } },
              data: { explanation: "tamper" },
            }),
          );
          const adminDraft = await create(
            { type: "UPDATE_FOOD", fields: { description: "Admin authored" } },
            food.id,
            catalogEvidence,
            "ADMIN",
          );
          assert.equal(
            (await action(adminDraft.id, "submit", "ADMIN")).statusCode,
            200,
          );
          assert.equal(
            (await action(adminDraft.id, "approve", "ADMIN")).statusCode,
            403,
          );
          assert.equal(
            (await action(adminDraft.id, "approve", "OTHER_ADMIN")).statusCode,
            200,
          );
        },
      );

      await context.test(
        "staging invisibility, identity reservation, exact atomic publication and retries",
        async () => {
          const op: ReviewOperation = {
            type: "CREATE_FOOD",
            canonicalName: "review-proposed-canonical",
            fields: { nameVi: "Review proposed name", foodType: "DISH" },
          };
          const draft = await create(op);
          const duplicate = await request("OTHER_EDITOR", "POST", prefix, {
            operation: op,
            evidence: catalogEvidence,
            explanation: "duplicate",
          });
          assert.equal(duplicate.statusCode, 409);
          const reservedName = await create(
            { type: "UPDATE_FOOD", fields: { nameVi: "Review proposed name" } },
            food.id,
          );
          assert.equal(
            (await action(reservedName.id, "submit")).statusCode,
            200,
          );
          assert.equal(
            (await action(reservedName.id, "approve", "ADMIN")).statusCode,
            409,
          );
          const search = () =>
            api.inject({ url: "/api/v1/foods/search?q=review%20proposed" });
          assert.equal((await search()).json().data.length, 0);
          assert.equal((await action(draft.id, "submit")).statusCode, 200);
          assert.equal((await search()).json().data.length, 0);
          assert.equal(
            (
              await action(draft.id, "approve", "ADMIN", 1, {
                fields: { nameVi: "Altered on approval" },
              })
            ).statusCode,
            400,
          );
          const approvals = await Promise.all([
            action(draft.id, "approve", "ADMIN"),
            action(draft.id, "approve", "OTHER_ADMIN"),
          ]);
          assert.deepEqual(
            approvals.map((r) => r.statusCode).sort(),
            [200, 409],
          );
          assert.equal(
            (await action(draft.id, "approve", "ADMIN")).statusCode,
            409,
          );
          const rows = (await search()).json().data;
          assert.equal(rows.length, 1);
          assert.equal(rows[0].name.vi, "Review proposed name");
          const successor = await create(
            {
              type: "UPDATE_FOOD",
              fields: { description: "Correction after creation" },
            },
            rows[0].id,
            catalogEvidence,
            "NUTRITION_EDITOR",
            draft.id,
          );
          assert.equal((await action(successor.id, "submit")).statusCode, 200);
          assert.equal(
            (await action(successor.id, "approve", "ADMIN")).statusCode,
            200,
          );
          assert.equal(
            await prisma.foodReviewAudit.count({
              where: { reviewId: draft.id, action: "APPROVED" },
            }),
            1,
          );
          assert.equal(
            await prisma.food.count({
              where: { canonicalName: "review-proposed-canonical" },
            }),
            1,
          );
        },
      );

      await context.test(
        "aliases keep ownership; metadata normalization and all stale catalog paths",
        async () => {
          await publish(
            {
              type: "ADD_ALIAS",
              alias: "Unique reviewed alias",
              language: "vi",
            },
            food.id,
          );
          const alias = await prisma.foodAlias.findFirstOrThrow({
            where: { foodId: food.id },
          });
          const another = await prisma.food.create({
            data: { canonicalName: "review-other", nameVi: "Review other" },
          });
          const conflict = await create(
            { type: "ADD_ALIAS", alias: alias.alias, language: "vi" },
            another.id,
          );
          assert.equal((await action(conflict.id, "submit")).statusCode, 200);
          assert.equal(
            (await action(conflict.id, "approve", "ADMIN")).statusCode,
            409,
          );
          assert.equal(
            (
              await prisma.foodReview.findUniqueOrThrow({
                where: { id: conflict.id },
              })
            ).state,
            "SUBMITTED",
          );
          await publish({ type: "REMOVE_ALIAS", aliasId: alias.id }, food.id);
          assert.equal(
            (
              await prisma.foodAlias.findUniqueOrThrow({
                where: { id: alias.id },
              })
            ).isActive,
            false,
          );
          assert.equal(
            (await action(conflict.id, "approve", "ADMIN")).statusCode,
            409,
          );
          await assert.rejects(
            prisma.foodAlias.update({
              where: { id: alias.id },
              data: { foodId: another.id },
            }),
          );
          await publish(
            { type: "UPDATE_FOOD", fields: { nameVi: "Tên đã sửa" } },
            food.id,
          );
          const after = await prisma.food.findUniqueOrThrow({
            where: { id: food.id },
          });
          assert.equal(after.normalizedName, "ten \u0111a sua");
          assert.equal(after.canonicalName, food.canonicalName);
          for (const change of [
            async () => {
              await prisma.foodAlias.create({
                data: {
                  foodId: food.id,
                  alias: randomUUID(),
                  normalizedAlias: randomUUID(),
                },
              });
            },
            async () => {
              await prisma.foodNutrition.updateMany({
                where: { foodId: food.id },
                data: { confidence: 0.8 },
              });
              await prisma.nutritionVersion.create({
                data: {
                  sourceId: source.id,
                  version: randomUUID(),
                  effectiveFrom: new Date(),
                  foodNutrition: {
                    create: {
                      foodId: food.id,
                      servingAmount: 100,
                      servingUnit: "g",
                      calories: 1,
                    },
                  },
                },
              });
            },
            async () => {
              await publish(
                { type: "UPDATE_FOOD", fields: { description: randomUUID() } },
                food.id,
              );
            },
          ]) {
            const stale = await create(
              { type: "UPDATE_FOOD", fields: { description: "stale" } },
              food.id,
            );
            assert.equal((await action(stale.id, "submit")).statusCode, 200);
            await change();
            assert.equal(
              (await action(stale.id, "approve", "ADMIN")).statusCode,
              409,
            );
            assert.equal(
              await prisma.foodReviewAudit.count({
                where: { reviewId: stale.id, action: "APPROVED" },
              }),
              0,
            );
          }
        },
      );

      await context.test(
        "publication rollback includes nutrition, workflow and audit",
        async () => {
          const draft = await create(
            nutrition("rollback-version"),
            food.id,
            nutritionEvidence(food.id, "rollback-version"),
          );
          assert.equal((await action(draft.id, "submit")).statusCode, 200);
          await prisma.$executeRawUnsafe(
            `CREATE FUNCTION fail_approval_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'APPROVED' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`,
          );
          await prisma.$executeRawUnsafe(
            'CREATE TRIGGER fail_approval_audit BEFORE INSERT ON "FoodReviewAudit" FOR EACH ROW EXECUTE FUNCTION fail_approval_audit()',
          );
          const before = await prisma.foodNutrition.findMany({
            where: { foodId: food.id },
            orderBy: { id: "asc" },
          });
          const failed = await action(draft.id, "approve", "ADMIN");
          assert.equal(failed.statusCode, 500);
          assert.equal(failed.body.includes("injected"), false);
          assert.deepEqual(
            await prisma.foodNutrition.findMany({
              where: { foodId: food.id },
              orderBy: { id: "asc" },
            }),
            before,
          );
          assert.equal(
            await prisma.nutritionVersion.count({
              where: { version: "rollback-version" },
            }),
            0,
          );
          assert.equal(
            (
              await prisma.foodReview.findUniqueOrThrow({
                where: { id: draft.id },
              })
            ).state,
            "SUBMITTED",
          );
          assert.equal(
            await prisma.foodReviewAudit.count({
              where: { reviewId: draft.id, action: "APPROVED" },
            }),
            0,
          );
          await prisma.$executeRawUnsafe(
            'DROP TRIGGER fail_approval_audit ON "FoodReviewAudit"',
          );
          assert.equal(
            (await action(draft.id, "approve", "ADMIN")).statusCode,
            200,
          );
        },
      );

      await context.test(
        "nutrition versioning, nulls, withdrawal and historical meals",
        async () => {
          await publish(
            nutrition("facts-v1"),
            food.id,
            nutritionEvidence(food.id, "facts-v1"),
          );
          const meal = await request("USER", "POST", "/api/v1/meals", {
            mealType: "LUNCH",
            capturedAt: new Date().toISOString(),
            items: [{ foodId: food.id, quantity: 100, unit: "g" }],
          });
          assert.equal(meal.statusCode, 201, meal.body);
          const mealId = meal.json().data.id;
          const before = (
            await request("USER", "GET", `/api/v1/meals/${mealId}`)
          ).json().data;
          await publish(
            nutrition("facts-v2", null),
            food.id,
            nutritionEvidence(food.id, "facts-v2"),
          );
          const publicFood = await api.inject({
            url: `/api/v1/foods/${food.id}`,
          });
          assert.equal(publicFood.json().data.nutrition.calories, null);
          assert.ok(
            await prisma.foodNutrition.findFirst({
              where: {
                foodId: food.id,
                nutritionVersion: { version: "facts-v1" },
              },
            }),
          );
          await publish(
            { type: "WITHDRAW_NUTRITION" },
            food.id,
            nutritionEvidence(food.id, "facts-v2"),
          );
          assert.equal(
            (await api.inject({ url: `/api/v1/foods/${food.id}` })).json().data
              .nutrition,
            undefined,
          );
          assert.deepEqual(
            (await request("USER", "GET", `/api/v1/meals/${mealId}`)).json()
              .data,
            before,
          );
          await publish(
            { type: "SET_FOOD_STATUS", status: "INACTIVE" },
            food.id,
          );
          assert.equal(
            (await api.inject({ url: `/api/v1/foods/${food.id}` })).statusCode,
            404,
          );
          assert.deepEqual(
            (await request("USER", "GET", `/api/v1/meals/${mealId}`)).json()
              .data,
            before,
          );
          assert.equal(
            (
              await request(
                "MODERATOR",
                "GET",
                "/api/v1/admin/foods?status=INACTIVE",
              )
            )
              .json()
              .data.some((f: { id: string }) => f.id === food.id),
            true,
          );
          await publish({ type: "SET_FOOD_STATUS", status: "ACTIVE" }, food.id);
          assert.equal(
            (await api.inject({ url: `/api/v1/foods/${food.id}` })).statusCode,
            200,
          );
        },
      );

      await context.test(
        "packaged product evidence, barcode lifecycle, pointers and direct-write conflicts",
        async () => {
          const productEvidence: Evidence[] = [
            {
              kind: "PRODUCT",
              reference: "Manufacturer product label",
              brand: "Review Brand",
              formulation: "Original",
              sourceId: source.id,
            },
          ];
          const published = await publish(
            {
              type: "CREATE_FOOD",
              canonicalName: "review-packaged-product",
              fields: {
                nameVi: "Review packaged product",
                foodType: "PACKAGED_FOOD",
              },
              product: {
                brand: "Review Brand",
                formulation: "Original",
                productName: "Review product",
                sourceId: source.id,
                packageQuantity: 250,
                packageUnit: "g",
              },
            },
            undefined,
            productEvidence,
          );
          const productFoodId = published.history.find((h) => h.publication)
            ?.publication?.foodId;
          assert.ok(productFoodId);
          const evidence: Evidence[] = [
            {
              ...productEvidence[0]!,
              foodId: productFoodId,
              barcode: "4006381333931",
            },
          ];
          const barcodeDraft = await create(
            { type: "ADD_BARCODE", barcode: "4006381333931" },
            productFoodId,
            evidence,
          );
          const scan = () =>
            request("USER", "POST", "/api/v1/barcode/scan", {
              barcode: "4006381333931",
            });
          assert.equal((await scan()).json().data.status, "UNRESOLVED");
          assert.equal(
            (await action(barcodeDraft.id, "submit")).statusCode,
            200,
          );
          assert.equal((await scan()).json().data.status, "UNRESOLVED");
          assert.equal(
            (await action(barcodeDraft.id, "approve", "ADMIN")).statusCode,
            200,
          );
          assert.equal(
            (await scan()).json().data.product.foodId,
            productFoodId,
          );
          assert.equal(
            (await scan()).json().data.product.package.quantity,
            250,
          );
          assert.equal((await scan()).json().data.source.reviewedAt, null);
          const equivalent = await create(
            { type: "ADD_BARCODE", barcode: "04006381333931" },
            productFoodId,
            evidence,
          );
          assert.equal((await action(equivalent.id, "submit")).statusCode, 200);
          assert.equal(
            (await action(equivalent.id, "approve", "ADMIN")).statusCode,
            409,
          );
          await publish(
            {
              type: "UPDATE_PRODUCT",
              fields: {
                productName: "Reviewed package name",
                packageQuantity: 275,
                packageUnit: "g",
              },
            },
            productFoodId,
            [{ ...productEvidence[0]!, foodId: productFoodId }],
          );
          assert.equal(
            (await scan()).json().data.product.productName,
            "Reviewed package name",
          );
          assert.equal(
            (await scan()).json().data.product.package.quantity,
            275,
          );
          const productNutrition = await publish(
            nutrition("product-v1"),
            productFoodId,
            [
              ...nutritionEvidence(productFoodId, "product-v1"),
              { ...productEvidence[0]!, foodId: productFoodId },
            ],
          );
          assert.equal(productNutrition.state, "APPROVED");
          assert.ok(
            (
              await prisma.packagedProduct.findUniqueOrThrow({
                where: { foodId: productFoodId },
              })
            ).currentNutritionVersionId,
          );
          for (const change of [
            async () => {
              await prisma.packagedProduct.update({
                where: { foodId: productFoodId },
                data: { packageQuantity: 300 },
              });
            },
            async () => {
              await prisma.foodBarcode.update({
                where: { normalizedBarcode: "04006381333931" },
                data: { status: "INACTIVE" },
              });
            },
            async () => {
              await prisma.packagedProduct.update({
                where: { foodId: productFoodId },
                data: { currentNutritionVersionId: null },
              });
            },
          ]) {
            const stale = await create(
              {
                type: "UPDATE_PRODUCT",
                fields: { productName: "New package name" },
              },
              productFoodId,
              [{ ...productEvidence[0]!, foodId: productFoodId }],
            );
            assert.equal((await action(stale.id, "submit")).statusCode, 200);
            await change();
            assert.equal(
              (await action(stale.id, "approve", "ADMIN")).statusCode,
              409,
            );
          }
          await publish(
            {
              type: "SET_BARCODE_STATUS",
              barcode: "4006381333931",
              status: "ACTIVE",
            },
            productFoodId,
            evidence,
          );
          await publish(
            { type: "SET_FOOD_STATUS", status: "DEPRECATED" },
            productFoodId,
          );
          assert.equal((await scan()).json().data.status, "UNRESOLVED");
          await publish(
            { type: "SET_FOOD_STATUS", status: "ACTIVE" },
            productFoodId,
          );
          assert.equal((await scan()).json().data.status, "RESOLVED");
          await assert.rejects(
            prisma.foodBarcode.update({
              where: { normalizedBarcode: "04006381333931" },
              data: { foodId: food.id },
            }),
          );
          const invalidEvidence: DraftInput = {
            targetFoodId: productFoodId,
            operation: nutrition("bad-evidence"),
            explanation: "AI estimated facts",
            evidence: [
              {
                kind: "PRODUCT",
                reference: "AI image result",
                sourceId: source.id,
              },
            ],
          };
          assert.equal(
            (await request("NUTRITION_EDITOR", "POST", prefix, invalidEvidence))
              .statusCode,
            400,
          );
        },
      );

      await context.test(
        "suspended, expired and revoked sessions cannot act",
        async () => {
          const actor = actors.get("OTHER_EDITOR")!;
          await prisma.user.update({
            where: { id: actor.id },
            data: { status: "SUSPENDED" },
          });
          assert.equal(
            (await request("OTHER_EDITOR", "GET", prefix)).statusCode,
            401,
          );
          await prisma.user.update({
            where: { id: actor.id },
            data: { status: "ACTIVE" },
          });
          await prisma.session.updateMany({
            where: { userId: actor.id },
            data: { expiresAt: new Date(0) },
          });
          assert.equal(
            (await request("OTHER_EDITOR", "GET", prefix)).statusCode,
            401,
          );
          await prisma.session.updateMany({
            where: { userId: actors.get("OTHER_ADMIN")!.id },
            data: { revokedAt: new Date() },
          });
          assert.equal(
            (await request("OTHER_ADMIN", "GET", prefix)).statusCode,
            401,
          );
        },
      );

      await context.test(
        "catalog identity and audit retention survive ordinary deactivation",
        async () => {
          await assert.rejects(
            prisma.food.update({
              where: { id: food.id },
              data: { canonicalName: "rewritten" },
            }),
          );
          const audit = await prisma.foodReviewAudit.findFirstOrThrow();
          await assert.rejects(
            prisma.foodReviewAudit.delete({ where: { id: audit.id } }),
          );
          await prisma.user.update({
            where: { id: actors.get("NUTRITION_EDITOR")!.id },
            data: { status: "DELETED" },
          });
          assert.ok(
            await prisma.foodReviewAudit.findUnique({
              where: { id: audit.id },
            }),
          );
        },
      );
    } finally {
      await app?.close();
      await prisma.$disconnect();
      await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.$disconnect();
    }
  },
);

test(
  "additive review migration preserves representative populated data",
  { timeout: 120000 },
  async (context) => {
    const configured = process.env.DATABASE_URL;
    if (!configured) {
      assert.ok(!process.env.CI, "CI must configure DATABASE_URL");
      context.skip("Set DATABASE_URL for migration verification");
      return;
    }
    const schema = `review18_populated_${randomUUID().replaceAll("-", "")}`;
    const admin = new PrismaClient({
      datasources: { db: { url: configured } },
    });
    const url = new URL(configured);
    url.searchParams.set("schema", schema);
    const prisma = new PrismaClient({ datasources: { db: { url: url.href } } });
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    try {
      const migrations = readdirSync("prisma/migrations")
        .filter((n) => /^\d/.test(n))
        .sort();
      for (const name of migrations.filter(
        (n) => n !== "20261014090000_food_reviews",
      ))
        execFileSync(
          process.execPath,
          [
            resolve("node_modules/prisma/build/index.js"),
            "db",
            "execute",
            "--file",
            resolve("prisma/migrations", name, "migration.sql"),
            "--schema",
            "prisma/schema.prisma",
          ],
          { env: { ...process.env, DATABASE_URL: url.href }, stdio: "pipe" },
        );
      const id = randomUUID();
      await prisma.$executeRaw`INSERT INTO "Food" (id, "canonicalName", "nameVi", "updatedAt") VALUES (${id}::uuid, 'populated-before-review', 'Existing food', NOW())`;
      const userId = randomUUID();
      const sourceId = randomUUID();
      const versionId = randomUUID();
      const mealId = randomUUID();
      const itemId = randomUUID();
      await prisma.$executeRaw`INSERT INTO "User" (id, email, "updatedAt") VALUES (${userId}::uuid, 'migration@review.test', NOW())`;
      await prisma.$executeRaw`INSERT INTO "FoodAlias" (id, "foodId", alias, "normalizedAlias") VALUES (${randomUUID()}::uuid, ${id}::uuid, 'Existing alias', 'existing alias')`;
      await prisma.$executeRaw`INSERT INTO "FoodSource" (id, name, provider, "sourceType", "updatedAt") VALUES (${sourceId}::uuid, 'Existing source', 'migration', 'CURATED', NOW())`;
      await prisma.$executeRaw`INSERT INTO "NutritionVersion" (id, "sourceId", version, "effectiveFrom") VALUES (${versionId}::uuid, ${sourceId}::uuid, 'existing-v1', NOW())`;
      await prisma.$executeRaw`INSERT INTO "PackagedProduct" ("foodId", "importKey", brand, variant, "sourceId", "sourceReference", "sourceVersion", "reviewedAt", "manifestHash", "currentNutritionVersionId") VALUES (${id}::uuid, 'existing-product', 'Existing brand', 'Original', ${sourceId}::uuid, 'Existing label', 'existing-v1', NOW(), ${"a".repeat(64)}, ${versionId}::uuid)`;
      await prisma.$executeRaw`INSERT INTO "FoodBarcode" ("normalizedBarcode", barcode, "foodId", "sourceUrl") VALUES ('04006381333931', '4006381333931', ${id}::uuid, 'https://example.com/existing-label')`;
      const [productBefore] = await prisma.$queryRaw<
        Record<string, unknown>[]
      >`SELECT * FROM "PackagedProduct" WHERE "foodId" = ${id}::uuid`;
      const [barcodeBefore] = await prisma.$queryRaw<
        Record<string, unknown>[]
      >`SELECT * FROM "FoodBarcode" WHERE "foodId" = ${id}::uuid`;
      await prisma.$executeRaw`INSERT INTO "FoodNutrition" (id, "foodId", "nutritionVersionId", "servingAmount", "servingUnit", calories, protein, carbohydrates, fat, "updatedAt") VALUES (${randomUUID()}::uuid, ${id}::uuid, ${versionId}::uuid, 100, 'g', 100, NULL, NULL, 0, NOW())`;
      await prisma.$executeRaw`INSERT INTO "Meal" (id, "userId", "mealType", "capturedAt", status, "updatedAt") VALUES (${mealId}::uuid, ${userId}::uuid, 'LUNCH', NOW(), 'CONFIRMED', NOW())`;
      await prisma.$executeRaw`INSERT INTO "MealItem" (id, "mealId", "foodId", quantity, unit, "displayName", "updatedAt") VALUES (${itemId}::uuid, ${mealId}::uuid, ${id}::uuid, 100, 'g', 'Historical food', NOW())`;
      await prisma.$executeRaw`INSERT INTO "MealItemNutrition" (id, "mealItemId", "nutritionVersionId", "sourceId", "servingAmount", "servingUnit", calories, protein, carbohydrates, fat, fiber, sugar, sodium) VALUES (${randomUUID()}::uuid, ${itemId}::uuid, ${versionId}::uuid, ${sourceId}::uuid, 100, 'g', 100, 10, 10, 2, 0, 0, 0)`;
      const before =
        await prisma.$queryRaw`SELECT * FROM "Food" WHERE id = ${id}::uuid`;
      const snapshotBefore =
        await prisma.$queryRaw`SELECT * FROM "MealItemNutrition" WHERE "mealItemId" = ${itemId}::uuid`;
      execFileSync(
        process.execPath,
        [
          resolve("node_modules/prisma/build/index.js"),
          "db",
          "execute",
          "--file",
          resolve(
            "prisma/migrations/20261014090000_food_reviews/migration.sql",
          ),
          "--schema",
          "prisma/schema.prisma",
        ],
        { env: { ...process.env, DATABASE_URL: url.href }, stdio: "pipe" },
      );
      assert.deepEqual(
        await prisma.$queryRaw`SELECT * FROM "Food" WHERE id = ${id}::uuid`,
        before,
      );
      assert.equal(await prisma.foodReview.count(), 0);
      const productAfter = await prisma.packagedProduct.findUniqueOrThrow({
        where: { foodId: id },
      });
      const barcodeAfter = await prisma.foodBarcode.findUniqueOrThrow({
        where: { normalizedBarcode: "04006381333931" },
      });
      for (const [key, value] of Object.entries(productBefore!))
        assert.deepEqual(productAfter[key as keyof typeof productAfter], value);
      for (const [key, value] of Object.entries(barcodeBefore!))
        assert.deepEqual(barcodeAfter[key as keyof typeof barcodeAfter], value);
      assert.equal(
        (await new ReviewRepository(prisma).food(id)).packagedProduct
          ?.formulation,
        "Original",
      );
      assert.deepEqual(
        await prisma.$queryRaw`SELECT * FROM "MealItemNutrition" WHERE "mealItemId" = ${itemId}::uuid`,
        snapshotBefore,
      );
      assert.equal(
        (await prisma.foodNutrition.findFirstOrThrow()).protein,
        null,
      );
      assert.equal(
        (await prisma.foodNutrition.findFirstOrThrow()).isActive,
        true,
      );
      assert.equal((await prisma.foodAlias.findFirstOrThrow()).isActive, true);
    } finally {
      await prisma.$disconnect();
      await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.$disconnect();
    }
  },
);
