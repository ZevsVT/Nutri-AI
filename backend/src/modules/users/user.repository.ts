import type { Repository } from "../../common/ports/repository.js";

export interface UserRecord {
  id: string;
  role: string;
  permissions: readonly string[];
}

export interface UserRepository extends Repository<UserRecord> {
  findByEmail(email: string): Promise<UserRecord | null>;
}
