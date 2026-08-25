import type { RequestUser } from "../../common/types/request-context.js";

export interface SessionToken {
  value: string;
  expiresAt: Date;
}

export interface SessionTokenProvider {
  create(user: RequestUser): Promise<SessionToken>;
  verify(value: string): Promise<RequestUser | null>;
  revoke(value: string): Promise<void>;
}
