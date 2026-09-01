import type { FastifyReply, FastifyRequest } from "fastify";
import { successResponse } from "../../common/errors/error-handler.js";
import type { BusinessApiService } from "./api.service.js";
import type {
  CreateAnalysisBody,
  CreateMealBody,
  ConfirmAnalysisBody,
  FoodSearchQuery,
  ListMealsQuery,
  UpdateMealBody,
} from "./api.schemas.js";

type Params = { id: string };
type Request<T = unknown, Q = unknown, P = unknown> = FastifyRequest<{
  Body: T;
  Querystring: Q;
  Params: P;
}>;

function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export class ApiController {
  constructor(private readonly service: BusinessApiService) {}

  searchFoods = async (
    request: Request<unknown, FoodSearchQuery>,
    reply: FastifyReply,
  ) => {
    const result = await this.service.searchFoods({
      query: request.query.q,
      locale: request.query.locale,
      page: request.query.page,
      pageSize: request.query.pageSize,
      filters: {
        foodType: request.query.foodType,
        category: request.query.category,
        subcategory: request.query.subcategory,
        region: request.query.region,
        cookingMethod: request.query.cookingMethod,
        cuisine: request.query.cuisine,
      },
    });
    return reply.send({
      ...successResponse(result.data),
      meta: pageMeta(request.query.page, request.query.pageSize, result.total),
    });
  };
  getFood = async (
    request: Request<unknown, unknown, Params>,
    reply: FastifyReply,
  ) =>
    reply.send(
      successResponse(
        await this.service.getFood(
          request.user?.id ?? "public",
          request.params.id,
        ),
      ),
    );
  createMeal = async (
    request: Request<CreateMealBody>,
    reply: FastifyReply,
  ) => {
    const data = await this.service.createMeal(request.user!.id, request.body);
    return reply.code(201).send(successResponse(data));
  };
  listMeals = async (
    request: Request<unknown, ListMealsQuery>,
    reply: FastifyReply,
  ) => {
    const query = request.query as Parameters<
      BusinessApiService["listMeals"]
    >[1];
    const result = await this.service.listMeals(request.user!.id, query);
    return reply.send({
      ...successResponse(result.data),
      meta: pageMeta(query.page, query.pageSize, result.total),
    });
  };
  getMeal = async (
    request: Request<unknown, unknown, Params>,
    reply: FastifyReply,
  ) =>
    reply.send(
      successResponse(
        await this.service.getMeal(request.user!.id, request.params.id),
      ),
    );
  updateMeal = async (
    request: Request<UpdateMealBody, unknown, Params>,
    reply: FastifyReply,
  ) =>
    reply.send(
      successResponse(
        await this.service.updateMeal(
          request.user!.id,
          request.params.id,
          request.body,
        ),
      ),
    );
  deleteMeal = async (
    request: Request<unknown, unknown, Params>,
    reply: FastifyReply,
  ) => {
    await this.service.deleteMeal(request.user!.id, request.params.id);
    return reply.code(204).send();
  };
  createAnalysis = async (
    request: Request<CreateAnalysisBody>,
    reply: FastifyReply,
  ) =>
    reply
      .code(202)
      .send(
        successResponse(
          await this.service.createAnalysis(request.user!.id, request.body),
        ),
      );
  getAnalysis = async (
    request: Request<unknown, unknown, Params>,
    reply: FastifyReply,
  ) =>
    reply.send(
      successResponse(
        await this.service.getAnalysis(request.user!.id, request.params.id),
      ),
    );
  confirmAnalysis = async (
    request: Request<ConfirmAnalysisBody, unknown, Params>,
    reply: FastifyReply,
  ) =>
    reply.send(
      successResponse(
        await this.service.confirmAnalysis(
          request.user!.id,
          request.params.id,
          request.body.items,
        ),
      ),
    );
  dailyNutrition = async (
    request: Request<unknown, { date: Date }>,
    reply: FastifyReply,
  ) =>
    reply.send(
      successResponse(
        await this.service.dailyNutrition(request.user!.id, request.query.date),
      ),
    );
  weeklyNutrition = async (
    request: Request<unknown, { from: Date; to: Date }>,
    reply: FastifyReply,
  ) =>
    reply.send(
      successResponse(
        await this.service.weeklyNutrition(
          request.user!.id,
          request.query.from,
          request.query.to,
        ),
      ),
    );
  chat = async (request: Request<{ message: string }>, reply: FastifyReply) =>
    reply.send(
      successResponse(
        await this.service.chat(request.user!.id, request.body.message),
      ),
    );
  listRecipes = async (
    request: Request<
      unknown,
      { tags?: string[]; cuisine?: string; page: number; pageSize: number }
    >,
    reply: FastifyReply,
  ) => {
    const result = await this.service.listRecipes(request.query);
    return reply.send({
      ...successResponse(result.data),
      meta: pageMeta(request.query.page, request.query.pageSize, result.total),
    });
  };
  createWater = async (
    request: Request<{ amountMl: number; loggedAt: Date }>,
    reply: FastifyReply,
  ) =>
    reply
      .code(201)
      .send(
        successResponse(
          await this.service.createWater(request.user!.id, request.body),
        ),
      );
  listWater = async (
    request: Request<
      unknown,
      { from?: Date; to?: Date; page: number; pageSize: number }
    >,
    reply: FastifyReply,
  ) => {
    const result = await this.service.listWater(
      request.user!.id,
      request.query,
    );
    return reply.send({
      ...successResponse(result.data),
      meta: pageMeta(request.query.page, request.query.pageSize, result.total),
    });
  };
  listInsights = async (
    request: Request<unknown, { page: number; pageSize: number }>,
    reply: FastifyReply,
  ) => {
    const result = await this.service.listInsights(
      request.user!.id,
      request.query,
    );
    return reply.send({
      ...successResponse(result.data),
      meta: pageMeta(request.query.page, request.query.pageSize, result.total),
    });
  };
  scanBarcode = async (
    request: Request<{ barcode: string }>,
    reply: FastifyReply,
  ) =>
    reply.send(
      successResponse(
        await this.service.scanBarcode(request.user!.id, request.body.barcode),
      ),
    );
}
