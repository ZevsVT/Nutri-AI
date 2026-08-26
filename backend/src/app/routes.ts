import type { FastifyInstance, RouteHandlerMethod } from "fastify";
import { API_PREFIX } from "../config/constants.js";
import {
  createAuthenticate,
  createAuthorize,
} from "../common/middleware/auth.js";
import { validateRequest } from "../common/middleware/request-validation.js";
import type { SystemController } from "../modules/system/system.controller.js";
import type { ApiController } from "../modules/api/api.controller.js";
import type { StorageController } from "../modules/storage/storage.controller.js";
import { storageObjectParamsSchema } from "../modules/storage/storage.schemas.js";
import { AuthController } from "../modules/auth/auth.controller.js";
import {
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerSchema,
} from "../modules/auth/auth.schemas.js";
import {
  apiMetadataQuerySchema,
  echoBodySchema,
} from "../modules/system/system.schemas.js";
import {
  barcodeSchema,
  chatSchema,
  confirmAnalysisSchema,
  createAnalysisSchema,
  createMealSchema,
  dailyNutritionSchema,
  foodSearchSchema,
  idParamsSchema,
  insightsSchema,
  listMealsSchema,
  recipesSchema,
  updateMealSchema,
  waterListSchema,
  waterSchema,
  weeklyNutritionSchema,
} from "../modules/api/api.schemas.js";

const apiMetadataQueryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    format: { type: "string", enum: ["full", "compact"], default: "full" },
  },
};

const echoBodyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message"],
  properties: { message: { type: "string", minLength: 1, maxLength: 1_000 } },
};

const apiMetadataResponseJsonSchema = { $ref: "ApiMetadataResponse#" };
const echoResponseJsonSchema = { $ref: "EchoResponse#" };
const currentUserResponseJsonSchema = { $ref: "CurrentUserResponse#" };
const adminCheckResponseJsonSchema = { $ref: "AdminCheckResponse#" };
const errorResponseJsonSchema = { $ref: "ErrorResponse#" };

export async function registerRoutes(
  app: FastifyInstance,
  controller: SystemController,
  apiController?: ApiController,
  storageController?: StorageController,
): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        response: { 200: { $ref: "HealthResponse#" } },
      },
    },
    controller.health,
  );
  app.get(
    "/ready",
    {
      schema: {
        tags: ["system"],
        response: {
          200: { $ref: "ReadyResponse#" },
          503: { $ref: "NotReadyResponse#" },
        },
      },
    },
    controller.ready,
  );

  app.get(
    API_PREFIX,
    {
      preValidation: validateRequest("query", apiMetadataQuerySchema),
      schema: {
        tags: ["system"],
        description: "Versioned API metadata and contract boundary.",
        querystring: apiMetadataQueryJsonSchema,
        response: {
          200: {
            ...apiMetadataResponseJsonSchema,
            description: "API metadata",
            examples: [
              {
                success: true,
                data: {
                  name: "Nutri-AI API",
                  version: "v1",
                  status: "running",
                },
              },
            ],
          },
        },
      },
    },
    controller.apiMetadata,
  );

  app.post(
    `${API_PREFIX}/foundation/echo`,
    {
      preValidation: validateRequest("body", echoBodySchema),
      schema: {
        tags: ["foundation"],
        description:
          "Validation contract example; this route is not a product API.",
        body: echoBodyJsonSchema,
        response: {
          200: echoResponseJsonSchema,
          400: errorResponseJsonSchema,
        },
      },
    },
    controller.echo,
  );

  const authController = new AuthController(app.authService, app.config);
  const authenticate = createAuthenticate(app.config, app.authService);
  const authorizeAdmin = createAuthorize(
    app.config,
    app.authService,
    "admin:read",
  );

  app.post(
    API_PREFIX + "/auth/register",
    { preValidation: validateRequest("body", registerSchema) },
    authController.register,
  );
  app.post(
    API_PREFIX + "/auth/login",
    { preValidation: validateRequest("body", loginSchema) },
    authController.login,
  );
  app.post(API_PREFIX + "/auth/logout", authController.logout);
  app.get(
    API_PREFIX + "/auth/me",
    { preHandler: authenticate },
    authController.me,
  );
  app.post(
    API_PREFIX + "/auth/password-reset/request",
    { preValidation: validateRequest("body", passwordResetRequestSchema) },
    authController.requestPasswordReset,
  );
  app.post(
    API_PREFIX + "/auth/password-reset/confirm",
    { preValidation: validateRequest("body", passwordResetConfirmSchema) },
    authController.confirmPasswordReset,
  );

  app.get(
    `${API_PREFIX}/foundation/me`,
    {
      preHandler: authenticate,
      schema: {
        tags: ["foundation"],
        description: "Authenticated identity boundary.",
        response: {
          200: currentUserResponseJsonSchema,
          401: errorResponseJsonSchema,
        },
      },
    },
    controller.currentUser,
  );
  app.get(
    `${API_PREFIX}/foundation/admin-check`,
    {
      preHandler: [authenticate, authorizeAdmin],
      schema: {
        tags: ["foundation"],
        description: "Server-side authorization boundary.",
        response: {
          200: adminCheckResponseJsonSchema,
          401: errorResponseJsonSchema,
          403: errorResponseJsonSchema,
        },
      },
    },
    controller.adminCheck,
  );

  if (!apiController) return;

  const privateRoute = { preHandler: authenticate };
  const validate = (target: "body" | "query" | "params", schema: Parameters<typeof validateRequest>[1]) => ({ preValidation: validateRequest(target, schema) });
  const handler = (value: unknown) => value as RouteHandlerMethod;

  app.get(`${API_PREFIX}/foods/search`, { ...validate("query", foodSearchSchema) }, handler(apiController.searchFoods));
  app.get(`${API_PREFIX}/foods/:id`, { ...validate("params", idParamsSchema) }, handler(apiController.getFood));

  app.post(`${API_PREFIX}/meals`, { ...privateRoute, ...validate("body", createMealSchema) }, handler(apiController.createMeal));
  app.get(`${API_PREFIX}/meals`, { ...privateRoute, ...validate("query", listMealsSchema) }, handler(apiController.listMeals));
  app.get(`${API_PREFIX}/meals/:id`, { ...privateRoute, ...validate("params", idParamsSchema) }, handler(apiController.getMeal));
  app.patch(`${API_PREFIX}/meals/:id`, { ...privateRoute, ...validate("params", idParamsSchema), ...validate("body", updateMealSchema) }, handler(apiController.updateMeal));
  app.delete(`${API_PREFIX}/meals/:id`, { ...privateRoute, ...validate("params", idParamsSchema) }, handler(apiController.deleteMeal));

  app.post(`${API_PREFIX}/meal-analysis`, { ...privateRoute, ...validate("body", createAnalysisSchema) }, handler(apiController.createAnalysis));
  app.get(`${API_PREFIX}/meal-analysis/:id`, { ...privateRoute, ...validate("params", idParamsSchema) }, handler(apiController.getAnalysis));
  app.post(`${API_PREFIX}/meal-analysis/:id/confirm`, { ...privateRoute, ...validate("params", idParamsSchema), ...validate("body", confirmAnalysisSchema) }, handler(apiController.confirmAnalysis));

  app.get(`${API_PREFIX}/nutrition/daily`, { ...privateRoute, ...validate("query", dailyNutritionSchema) }, handler(apiController.dailyNutrition));
  app.get(`${API_PREFIX}/nutrition/weekly`, { ...privateRoute, ...validate("query", weeklyNutritionSchema) }, handler(apiController.weeklyNutrition));
  app.post(`${API_PREFIX}/ai/chat`, { ...privateRoute, ...validate("body", chatSchema) }, handler(apiController.chat));
  app.get(`${API_PREFIX}/recipes`, { ...validate("query", recipesSchema) }, handler(apiController.listRecipes));
  app.post(`${API_PREFIX}/water`, { ...privateRoute, ...validate("body", waterSchema) }, handler(apiController.createWater));
  app.get(`${API_PREFIX}/water`, { ...privateRoute, ...validate("query", waterListSchema) }, handler(apiController.listWater));
  app.get(`${API_PREFIX}/insights`, { ...privateRoute, ...validate("query", insightsSchema) }, handler(apiController.listInsights));
  app.post(`${API_PREFIX}/barcode/scan`, { ...privateRoute, ...validate("body", barcodeSchema) }, handler(apiController.scanBarcode));

  if (storageController) {
    app.post(`${API_PREFIX}/storage/uploads`, { preHandler: authenticate, bodyLimit: app.config.fileUploadLimitBytes + 65_536 }, handler(storageController.upload));
    app.get(`${API_PREFIX}/storage/objects/:id`, { preHandler: [authenticate], ...validate("params", storageObjectParamsSchema) }, handler(storageController.read));
    app.get(`${API_PREFIX}/storage/objects/:id/url`, { preHandler: [authenticate], ...validate("params", storageObjectParamsSchema) }, handler(storageController.readUrl));
    app.delete(`${API_PREFIX}/storage/objects/:id`, { preHandler: [authenticate], ...validate("params", storageObjectParamsSchema) }, handler(storageController.delete));
  }
}
