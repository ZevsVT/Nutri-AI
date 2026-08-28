export type View =
  | "dashboard"
  | "analyze"
  | "diary"
  | "insights"
  | "assistant"
  | "recipes"
  | "profile";

export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export interface NutritionFacts {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number; // in mg
  sugar: number;  // in g
}

export interface MealItem {
  id: string;
  name: string;
  detail: string;
  portion: string;
  amount: number; // e.g. 100
  unit: string;   // e.g. "g" or "ml"
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: number;
  removable?: boolean;
  source?: string;
}

export interface Meal {
  id: string;
  type: MealType;
  name: string;
  description: string;
  time: string;
  date?: string;
  art: string;
  image: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium?: number;
  confidence: number;
  portion: string;
  tags: string[];
  items?: MealItem[];
  source?: string;
}

export interface DetectedItem {
  id: string;
  name: string;
  detail: string;
  portion: string;
  amount: number;
  unit: string;
  baseCalories: number;
  baseProtein: number;
  baseCarbs: number;
  baseFat: number;
  baseFiber: number;
  confidence: number;
  removable?: boolean;
  source?: string;
}

export interface RecipeIngredient {
  name: string;
  amount: string;
  calories?: number;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  art: string;
  image: string;
  time: string;
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  difficulty?: "Easy" | "Medium" | "Advanced";
  tag: string;
  cuisine?: string;
  calories: number;
  protein: string;
  carbs?: string;
  fat?: string;
  fiber: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  nutritionSummary: NutritionFacts;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: string;
  timestamp?: string;
  suggestedActions?: string[];
}

export interface FoodDatabaseEntry {
  id: string;
  name: string;
  category: string;
  serving: string;
  defaultAmount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  source: string;
}

export interface UserGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl: number;
  plantDiversityTarget: number;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarText: string;
  accountType: string;
  memberSince: string;
  dietaryPreference: string;
  allergies: string[];
  nutritionInterests: string[];
  goals: UserGoals;
}
