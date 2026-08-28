import { useState, useMemo } from "react";
import { Sidebar, primaryNav } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { CommandPalette } from "../common/CommandPalette";
import { Toast } from "../common/Toast";
import { QuickLogModal } from "../common/QuickLogModal";
import { BarcodeScannerModal } from "../common/BarcodeScannerModal";
import { DashboardView } from "../dashboard/DashboardView";
import { AnalyzeView } from "../analyze/AnalyzeView";
import { DiaryView } from "../diary/DiaryView";
import { InsightsView } from "../insights/InsightsView";
import { AssistantView } from "../assistant/AssistantView";
import { RecipesView } from "../recipes/RecipesView";
import { ProfileView } from "../profile/ProfileView";
import { MealDetailModal } from "../diary/MealDetailModal";
import { initialMeals, initialUserProfile } from "../../data";
import type { ChatMessage, Meal, UserGoals, UserProfile, View } from "../../types";

const initialChatMessages: ChatMessage[] = [
  {
    id: "welcome-1",
    role: "assistant",
    content: "Hi Thanh! I’m your NutriAI nutrition copilot. I have context on your breakfast (Eggs & Sourdough), lunch (Phở Bò), and afternoon Greek yogurt. What would you like to explore or optimize for dinner?",
    meta: "Grounded in today’s diary (3 meals logged)",
  },
];

export function AppShell() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [meals, setMeals] = useState<Meal[]>(initialMeals);
  const [userProfile, setUserProfile] = useState<UserProfile>(initialUserProfile);
  const [waterMl, setWaterMl] = useState<number>(1400);
  const [plantCount, setPlantCount] = useState<number>(4);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [selectedMealForModal, setSelectedMealForModal] = useState<Meal | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);

  const activeTitle = useMemo(() => {
    if (activeView === "profile") return "Profile & Settings";
    const found = primaryNav.find((item) => item.id === activeView);
    return found ? found.label : "Dashboard";
  }, [activeView]);

  const handleNavigate = (view: View) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddMeal = (newMeal: Meal) => {
    setMeals((prev) => [newMeal, ...prev.filter((m) => m.id !== newMeal.id)]);
    setToastMessage(`"${newMeal.name}" has been saved to your Food Diary`);
  };

  const handleDeleteMeal = (mealId: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== mealId));
    setToastMessage("Meal entry removed from diary");
  };

  const handleAddWater = (amount: number) => {
    setWaterMl((w) => Math.min(5000, w + amount));
    setToastMessage(`Added ${amount} ml water to your hydration tracker`);
  };

  const handleIncrementPlants = () => {
    setPlantCount((p) => Math.min(12, p + 1));
    setToastMessage("Added +1 plant food type to daily diversity score");
  };

  const handleUpdateGoals = (newGoals: UserGoals) => {
    setUserProfile((prev) => ({
      ...prev,
      goals: newGoals,
    }));
    setToastMessage("Daily nutrition targets updated");
  };

  const handleSendMessage = (content: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    };

    let aiReply = "Based on today’s 3 logged meals (Eggs, Phở bò, and Greek yogurt), your protein distribution is well-spaced throughout the day. For dinner, a grilled salmon or tofu plate with steamed gai lan (Chinese broccoli) will fulfill your fiber and healthy fat goals without excess sodium.";
    if (content.toLowerCase().includes("fiber")) {
      aiReply = "You currently have 16g of dietary fiber logged today (target: 28g). Adding half an avocado, chia seeds, or a side of edamame with your dinner will easily bridge the remaining 12g gap.";
    } else if (content.toLowerCase().includes("plant")) {
      aiReply = "You have logged 4 plant foods today (banana, herbs, bean sprouts, blueberries). Simple ways to increase variety: sprinkle pumpkin seeds on snacks, add cilantro/mint to soups, or toss spinach into eggs.";
    } else if (content.toLowerCase().includes("phở") || content.toLowerCase().includes("glycemic")) {
      aiReply = "Your Phở Bò meal contains 52g carbs from fresh flat rice noodles paired with 28g protein from beef. The presence of lean beef and bean sprouts naturally buffers glycemic response, slowing carbohydrate absorption.";
    }

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: aiReply,
      meta: "Grounded in USDA & Vietnamese food tables",
    };

    setChatMessages((prev) => [...prev, userMsg, assistantMsg]);
  };

  const handleExportData = () => {
    const dataObj = {
      userProfile,
      waterMl,
      plantCount,
      meals,
      chatMessages,
      exportedAt: new Date().toISOString(),
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataObj, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `nutriai-data-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setToastMessage("Your nutrition data has been exported (JSON)");
  };

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        userName={userProfile.name}
      />

      <div className="app-main">
        <TopBar
          title={activeTitle}
          onOpenSearch={() => setIsCommandPaletteOpen(true)}
          onNavigate={handleNavigate}
          avatarText={userProfile.avatarText}
        />

        <main className="page-content-wrapper">
          {activeView === "dashboard" && (
            <DashboardView
              meals={meals}
              userProfile={userProfile}
              waterMl={waterMl}
              plantCount={plantCount}
              onAddWater={handleAddWater}
              onIncrementPlants={handleIncrementPlants}
              onSelectMeal={(m) => setSelectedMealForModal(m)}
              onNavigate={handleNavigate}
            />
          )}

          {activeView === "analyze" && (
            <AnalyzeView
              onSaveMeal={handleAddMeal}
              onNavigate={handleNavigate}
            />
          )}

          {activeView === "diary" && (
            <DiaryView
              meals={meals}
              goals={userProfile.goals}
              onDeleteMeal={handleDeleteMeal}
              onNavigate={handleNavigate}
            />
          )}

          {activeView === "insights" && (
            <InsightsView onNavigate={handleNavigate} />
          )}

          {activeView === "assistant" && (
            <AssistantView
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              onLogSuggestedMeal={handleAddMeal}
              meals={meals}
              userProfile={userProfile}
            />
          )}

          {activeView === "recipes" && (
            <RecipesView onLogMealFromRecipe={handleAddMeal} />
          )}

          {activeView === "profile" && (
            <ProfileView
              userProfile={userProfile}
              onUpdateGoals={handleUpdateGoals}
              onExportData={handleExportData}
            />
          )}
        </main>
      </div>

      <BottomNav
        activeView={activeView}
        onNavigate={handleNavigate}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
        onOpenQuickLog={() => setIsQuickLogOpen(true)}
        onOpenBarcode={() => setIsBarcodeOpen(true)}
      />

      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        onSaveMeal={handleAddMeal}
      />

      <BarcodeScannerModal
        isOpen={isBarcodeOpen}
        onClose={() => setIsBarcodeOpen(false)}
        onLogScannedFood={handleAddMeal}
      />

      <MealDetailModal
        meal={selectedMealForModal}
        isOpen={selectedMealForModal !== null}
        onClose={() => setSelectedMealForModal(null)}
        onDeleteMeal={handleDeleteMeal}
      />

      <Toast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}
