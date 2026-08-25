import type { FastifyReply, FastifyRequest } from "fastify";
import { successResponse } from "../../common/errors/error-handler.js";
import type { RequestUser } from "../../common/types/request-context.js";
import type { ApiMetadataQuery, EchoBody } from "./system.schemas.js";
import type { SystemService } from "./system.service.js";

export class SystemController {
  constructor(private readonly service: SystemService) {}

  health = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(this.service.getHealth());
  };

  ready = async (_request: FastifyRequest, reply: FastifyReply) => {
    const readiness = await this.service.getReadiness();
    if (readiness.status !== "ready") {
      return reply.code(503).send({ status: "not_ready" });
    }
    return reply.send({ status: "ready" });
  };

  apiMetadata = async (
    request: FastifyRequest<{ Querystring: ApiMetadataQuery }>,
    reply: FastifyReply,
  ) => {
    return reply.send(
      successResponse(this.service.getApiMetadata(request.query.format)),
    );
  };

  echo = async (
    request: FastifyRequest<{ Body: EchoBody }>,
    reply: FastifyReply,
  ) => {
    return reply.send(successResponse(this.service.echo(request.body.message)));
  };

  currentUser = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(successResponse({ user: request.user as RequestUser }));
  };

  adminCheck = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(
      successResponse({ authorized: true, userId: request.user?.id }),
    );
  };
}
