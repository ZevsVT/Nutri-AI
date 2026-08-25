import { AppError } from "../../common/errors/app-error.js";
import type { UserRecord, UserRepository } from "./user.repository.js";

export class UnavailableUserRepository implements UserRepository {
  async findById(_id: string): Promise<UserRecord | null> {
    void _id;
    throw new AppError(
      "DATABASE_ERROR",
      "The user repository is not configured",
    );
  }

  async findByEmail(_email: string): Promise<UserRecord | null> {
    void _email;
    throw new AppError(
      "DATABASE_ERROR",
      "The user repository is not configured",
    );
  }
}
