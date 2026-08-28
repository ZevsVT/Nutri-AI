import { useMemo } from "react";
import type { Meal, UserProfile, View } from "../../types";
import { calculateDailyTotals } from "../../services/nutritionEngine";
import { DailyHero } from "./DailyHero";
import { MetricGrid } from "./MetricGrid";
import { TodayMeals } from "./TodayMeals";
import { QuickHabitTracker, DailyInsightCard } from "./QuickHabitTracker";

interface DashboardViewProps {
  meals: Meal[];
  userProfile: UserProfile;
  waterMl: number;
  plantCount: number;
  onAddWater: (amountMl: number) => void;
  onIncrementPlants: () => void;
  onSelectMeal: (meal: Meal) => void;
  onNavigate: (view: View) => void;
}

export function DashboardView({
  meals,
  userProfile,
  waterMl,
  plantCount,
  onAddWater,
  onIncrementPlants,
  onSelectMeal,
  onNavigate,
}: DashboardViewProps) {
  const dailyTotals = useMemo(() => {
    const raw = calculateDailyTotals(meals);
    return { ...raw, water: waterMl };
  }, [meals, waterMl]);

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <p className="section-kicker">Personal Health Dashboard</p>
          <h2>Good day, {userProfile.name}</h2>
          <p className="view-header-subtitle">
            Here is your daily nutrition context and habits for today.
          </p>
        </div>
      </div>

      <DailyHero
        onAnalyze={() => onNavigate("analyze")}
        totals={dailyTotals}
        goals={userProfile.goals}
      />

      <MetricGrid totals={dailyTotals} goals={userProfile.goals} />

      <div className="dashboard-content-split">
        <TodayMeals
          meals={meals}
          onSelectMeal={onSelectMeal}
          onAddMeal={() => onNavigate("analyze")}
          onViewDiary={() => onNavigate("diary")}
        />

        <div className="dashboard-side-stack">
          <DailyInsightCard onAskAI={() => onNavigate("assistant")} />
          <QuickHabitTracker
            waterMl={waterMl}
            targetWaterMl={userProfile.goals.waterMl}
            onAddWater={onAddWater}
            plantCount={plantCount}
            targetPlantCount={userProfile.goals.plantDiversityTarget}
            onIncrementPlants={onIncrementPlants}
          />
        </div>
      </div>
    </div>
  );
}
