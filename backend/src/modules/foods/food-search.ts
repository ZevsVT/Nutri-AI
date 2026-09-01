import { normalizeFoodText } from "./food-taxonomy.js";

export interface FoodSearchCandidate {
  id: string;
  canonicalName?: string | null;
  normalizedName?: string | null;
  nameVi: string;
  nameEn?: string | null;
  aliases?: readonly { alias: string; normalizedAlias?: string | null; language?: string | null }[] | readonly string[];
  [key: string]: unknown;
}

export interface FoodSearchFilters {
  foodType?: string;
  category?: string;
  subcategory?: string;
  region?: string;
  cookingMethod?: string;
  cuisine?: string;
}

export interface RankedFood<T> {
  item: T;
  score: number;
}

const levenshtein = (left: string, right: string): number => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 0; i < left.length; i += 1) {
    const current = [i + 1];
    for (let j = 0; j < right.length; j += 1) {
      current.push(
        Math.min(
          current[j]! + 1,
          previous[j + 1]! + 1,
          previous[j]! + (left[i] === right[j] ? 0 : 1),
        ),
      );
    }
    previous = current;
  }
  return previous[right.length]!;
};

const similarity = (left: string, right: string): number => {
  const length = Math.max(left.length, right.length);
  return length ? 1 - levenshtein(left, right) / length : 1;
};

const fieldValues = (food: FoodSearchCandidate): Array<{ value: string; weight: number }> => {
  const aliases = (food.aliases ?? []).map((alias) =>
    typeof alias === "string"
      ? { value: normalizeFoodText(alias), weight: 820 }
      : { value: normalizeFoodText(alias.normalizedAlias ?? alias.alias), weight: alias.language === "en" ? 760 : 820 },
  );
  return [
    { value: normalizeFoodText(food.canonicalName ?? ""), weight: 980 },
    { value: normalizeFoodText(food.normalizedName ?? food.nameVi), weight: 950 },
    { value: normalizeFoodText(food.nameVi), weight: 940 },
    { value: normalizeFoodText(food.nameEn ?? ""), weight: 760 },
    ...aliases,
  ].filter((field) => field.value.length > 0);
};

/** Scores names deterministically. Fuzzy matching is deliberately conservative for short words. */
export function scoreFood(food: FoodSearchCandidate, query: string): number {
  const normalizedQuery = normalizeFoodText(query);
  if (!normalizedQuery) return 0;
  const queryTokens = normalizedQuery.split(" ");
  const fields = fieldValues(food);
  let best = 0;
  for (const field of fields) {
    if (field.value === normalizedQuery) best = Math.max(best, field.weight + 100);
    else if (field.value.startsWith(normalizedQuery)) best = Math.max(best, field.weight + 60);
    else if (field.value.includes(normalizedQuery)) best = Math.max(best, field.weight + 30);

    const fieldTokens = field.value.split(" ");
    const matchedTokens = queryTokens.filter((token) =>
      fieldTokens.some((candidate) => candidate === token || candidate.startsWith(token)),
    ).length;
    if (matchedTokens === queryTokens.length) best = Math.max(best, field.weight + 20);

    // Do not make one- or two-character terms fuzzy: they produce noisy results.
    if (normalizedQuery.length >= 3) {
      const distance = levenshtein(normalizedQuery, field.value);
      const maxDistance = normalizedQuery.length <= 5 ? 1 : Math.floor(normalizedQuery.length * 0.25);
      if (distance <= maxDistance) best = Math.max(best, field.weight - 80 - distance * 10);
      const fuzzyToken = queryTokens.every((token) =>
        fieldTokens.some((candidate) => candidate.length >= 3 && similarity(token, candidate) >= 0.7),
      );
      if (fuzzyToken) best = Math.max(best, field.weight - 100);
    }
  }
  return best;
}

export function rankFoods<T extends FoodSearchCandidate>(foods: readonly T[], query: string): RankedFood<T>[] {
  return foods
    .map((item) => ({ item, score: scoreFood(item, query) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.item.nameVi.localeCompare(b.item.nameVi, "vi") || a.item.id.localeCompare(b.item.id));
}

export function searchTokens(query: string): string[] {
  return normalizeFoodText(query).split(" ").filter((token) => token.length >= 2);
}
