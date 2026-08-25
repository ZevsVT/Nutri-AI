export interface MealImageInput {
  bytes: Uint8Array;
  contentType: string;
  fileName?: string;
}

export interface MealAnalysis {
  items: readonly { label: string; confidence: number }[];
  provider: string;
}

export interface PortionEstimate {
  amount: number;
  unit: string;
  confidence: number;
}

export interface InsightRequest {
  context: string;
}

export interface AIProvider {
  analyzeMeal(input: MealImageInput): Promise<MealAnalysis>;
  estimatePortion(input: MealImageInput): Promise<PortionEstimate>;
  generateInsight(request: InsightRequest): Promise<string>;
  generateResponse(request: InsightRequest): Promise<string>;
}
