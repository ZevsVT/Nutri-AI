export type View =
  | "dashboard"
  | "analyze"
  | "diary"
  | "insights"
  | "assistant"
  | "recipes"
  | "profile";

export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export type Meal = {
  id: string;
  type: MealType;
  name: string;
  description: string;
  time: string;
  art: string;
  image: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: number;
  portion: string;
  tags: string[];
};

export type DetectedItem = {
  id: string;
  name: string;
  detail: string;
  portion: string;
  confidence: number;
  removable?: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: string;
};

export type Recipe = {
  id: string;
  title: string;
  description: string;
  art: string;
  image: string;
  time: string;
  tag: string;
  protein: string;
  fiber: string;
};
