export interface Repository<TEntity, TId = string> {
  findById(id: TId): Promise<TEntity | null>;
}
