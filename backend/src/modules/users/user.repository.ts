import type { PrismaClient, User as PrismaUser } from "@prisma/client";
import type { Repository } from "../../common/ports/repository.js";
import type { UserRole } from "../../common/types/request-context.js";

export interface UserRecord {
  id: string;
  role: UserRole;
  permissions: readonly string[];
}

export interface UserRepository extends Repository<UserRecord> {
  findByEmail(email: string): Promise<UserRecord | null>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toUserRecord(user) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return user ? toUserRecord(user) : null;
  }
}

function toUserRecord(user: PrismaUser): UserRecord {
  return {
    id: user.id,
    role: user.role,
    // Permissions are intentionally kept outside the persistence model until
    // authentication/authorization policy is implemented in Issue #8.
    permissions: [],
  };
}
