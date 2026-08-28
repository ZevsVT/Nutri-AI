import { useState } from "react";
import { Icon } from "../../icons";
import { Tabs } from "../common/Tabs";
import { recipes } from "../../data";
import { RecipeDetailModal } from "./RecipeDetailModal";
import type { Meal, Recipe } from "../../types";

interface RecipesViewProps {
  onLogMealFromRecipe: (meal: Meal) => void;
}

export function RecipesView({ onLogMealFromRecipe }: RecipesViewProps) {
  const [filter, setFilter] = useState<string>("All");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const categories = [
    { id: "All", label: "All Recipes" },
    { id: "High protein", label: "High Protein" },
    { id: "Vegetarian", label: "Vegetarian" },
    { id: "Quick meal", label: "Quick (<20 min)" },
  ];

  const filteredRecipes = filter === "All"
    ? recipes
    : recipes.filter((r) => r.tag === filter);

  const handleLogRecipe = (recipe: Recipe) => {
    const newMeal: Meal = {
      id: `recipe-meal-${Date.now()}`,
      type: "Dinner",
      name: recipe.title,
      description: recipe.description,
      time: "Just now",
      date: "Today, Aug 22",
      art: recipe.art,
      image: recipe.image,
      calories: recipe.calories,
      protein: parseInt(recipe.protein, 10) || 25,
      carbs: parseInt(recipe.carbs || "40", 10) || 40,
      fat: parseInt(recipe.fat || "12", 10) || 12,
      fiber: parseInt(recipe.fiber, 10) || 7,
      confidence: 0.99,
      portion: "1 serving",
      tags: [recipe.tag, "Recipe"],
      source: "NutriAI Curated Recipes",
    };
    onLogMealFromRecipe(newMeal);
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <p className="section-kicker">Nutrient-Dense Inspiration</p>
          <h2>Recipes for Real Life</h2>
          <p className="view-header-subtitle">
            Culturally relevant, high-protein, and fiber-forward meal ideas.
          </p>
        </div>
        <Tabs
          tabs={categories}
          activeTab={filter}
          onChange={(f) => setFilter(f)}
        />
      </div>

      <div className="recipe-cards-grid">
        {filteredRecipes.map((recipe) => (
          <article
            key={recipe.id}
            className="recipe-card-single"
            onClick={() => setSelectedRecipe(recipe)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedRecipe(recipe);
              }
            }}
          >
            <div className="recipe-card-cover">
              <img src={recipe.image} alt={recipe.title} loading="lazy" />
              <div
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-pill)",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "var(--text-secondary)",
                }}
              >
                <Icon name="clock" size={13} />
                {recipe.time}
              </div>
            </div>
            <div className="recipe-card-body">
              <span className="badge badge-green" style={{ marginBottom: "6px" }}>
                {recipe.tag}
              </span>
              <h3 style={{ fontSize: "1.05rem", marginBottom: "4px" }}>{recipe.title}</h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "var(--space-3)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {recipe.description}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  paddingTop: "var(--space-2)",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <span>{recipe.calories} kcal</span>
                <span>{recipe.protein} protein</span>
                <span style={{ color: "var(--brand-primary)", display: "flex", alignItems: "center", gap: "2px" }}>
                  View <Icon name="arrow" size={13} />
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={selectedRecipe !== null}
        onClose={() => setSelectedRecipe(null)}
        onLogMeal={handleLogRecipe}
      />
    </div>
  );
}
