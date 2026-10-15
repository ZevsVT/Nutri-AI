import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../../common/errors/app-error.js";
import { successResponse } from "../../common/errors/error-handler.js";
import { parseOrThrow } from "../../common/middleware/request-validation.js";
import { createAuthenticate } from "../../common/middleware/auth.js";
import { API_PREFIX } from "../../config/constants.js";
import {
  requireReviewPermission,
  type ReviewService,
} from "./review.service.js";
import {
  draftSchema,
  editDraftSchema,
  foodQuerySchema,
  rejectionSchema,
  reviewIdSchema,
  reviewQuerySchema,
  reviewPaginationSchema,
  revisionSchema,
} from "./review.schemas.js";

export class ReviewController {
  constructor(private readonly reviewService?: ReviewService) {}
  private get service() {
    if (!this.reviewService)
      throw new AppError("DATABASE_ERROR", "Food reviews require PostgreSQL");
    return this.reviewService;
  }
  foods = async (request: FastifyRequest) => {
    const query = parseOrThrow(foodQuerySchema, request.query, "query");
    return this.page(await this.service.repository.foods(query), query);
  };
  food = async (request: FastifyRequest) =>
    successResponse(
      await this.service.repository.food(
        parseOrThrow(reviewIdSchema, request.params, "params").id,
      ),
    );
  sources = async (request: FastifyRequest) =>
    successResponse(
      await this.service.repository.sources(
        parseOrThrow(reviewPaginationSchema, request.query, "query"),
      ),
    );
  list = async (request: FastifyRequest) => {
    const query = parseOrThrow(reviewQuerySchema, request.query, "query");
    return this.page(await this.service.repository.list(query), query);
  };
  detail = async (request: FastifyRequest) =>
    successResponse(
      await this.service.detail(
        parseOrThrow(reviewIdSchema, request.params, "params").id,
      ),
    );
  history = async (request: FastifyRequest) => {
    const query = parseOrThrow(reviewPaginationSchema, request.query, "query");
    return this.page(
      await this.service.repository.history(
        parseOrThrow(reviewIdSchema, request.params, "params").id,
        query,
      ),
      query,
    );
  };
  create = async (request: FastifyRequest) =>
    successResponse(
      await this.service.create(
        request.user!,
        parseOrThrow(draftSchema, request.body, "body"),
      ),
    );
  edit = async (request: FastifyRequest) =>
    successResponse(
      await this.service.edit(
        request.user!,
        parseOrThrow(reviewIdSchema, request.params, "params").id,
        parseOrThrow(editDraftSchema, request.body, "body"),
      ),
    );
  transition =
    (action: "submit" | "withdraw" | "approve" | "reject") =>
    async (request: FastifyRequest) => {
      const input = parseOrThrow(
        action === "reject" ? rejectionSchema : revisionSchema,
        request.body,
        "body",
      );
      return successResponse(
        await this.service.transition(
          request.user!,
          parseOrThrow(reviewIdSchema, request.params, "params").id,
          input.revision,
          action,
          "reason" in input ? (input.reason as string) : undefined,
        ),
      );
    };
  private page<T>(
    result: { data: T[]; total: number },
    query: { page: number; pageSize: number },
  ) {
    return {
      ...successResponse(result.data),
      meta: {
        ...query,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }
}

export async function registerReviewRoutes(
  app: FastifyInstance,
  service?: ReviewService,
) {
  const controller = new ReviewController(service);
  // Catalog administration always requires a real session, even in development.
  const authenticate = createAuthenticate(
    { ...app.config, authDevMode: false },
    app.authService,
  );
  const access =
    (permission: string, mutation = false) =>
    async (request: FastifyRequest) => {
      await authenticate(request);
      requireReviewPermission(request.user!, permission);
      if (mutation && request.headers["x-food-review-request"] !== "1")
        throw new AppError(
          "AUTHORIZATION_ERROR",
          "Review mutations require the X-Food-Review-Request header",
        );
    };
  const read = { preHandler: access("food-reviews:read") };
  const write = { preHandler: access("food-reviews:write", true) };
  const decide = { preHandler: access("food-reviews:decide", true) };
  const base = API_PREFIX + "/admin";
  app.get(base + "/foods", read, controller.foods);
  app.get(base + "/foods/:id", read, controller.food);
  app.get(base + "/nutrition-sources", read, controller.sources);
  app.get(base + "/food-reviews", read, controller.list);
  app.post(base + "/food-reviews", write, async (request, reply) =>
    reply.code(201).send(await controller.create(request)),
  );
  app.get(base + "/food-reviews/:id", read, controller.detail);
  app.patch(base + "/food-reviews/:id", write, controller.edit);
  app.get(base + "/food-reviews/:id/history", read, controller.history);
  app.post(
    base + "/food-reviews/:id/submit",
    write,
    controller.transition("submit"),
  );
  app.post(
    base + "/food-reviews/:id/withdraw",
    write,
    controller.transition("withdraw"),
  );
  app.post(
    base + "/food-reviews/:id/approve",
    decide,
    controller.transition("approve"),
  );
  app.post(
    base + "/food-reviews/:id/reject",
    decide,
    controller.transition("reject"),
  );
}
