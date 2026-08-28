import { useEffect, useState } from "react";
import { Icon, type IconName } from "../../icons";
import type { View } from "../../types";
import { searchFoods, recipes } from "../../data";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
  onSelectFood?: (foodName: string) => void;
  onOpenQuickLog?: () => void;
  onOpenBarcode?: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: "Navigation" | "Food" | "Recipe" | "Action";
  icon: IconName;
  action: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onSelectFood,
  onOpenQuickLog,
  onOpenBarcode,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const baseItems: CommandItem[] = [
    {
      id: "act-quick-log",
      title: "Quick Manual Food Log",
      subtitle: "Add custom meal or pick from food database",
      category: "Action",
      icon: "plus",
      action: () => {
        if (onOpenQuickLog) onOpenQuickLog();
      },
    },
    {
      id: "act-barcode",
      title: "Open Barcode Scanner",
      subtitle: "Scan packaged foods with instant nutrition lookup",
      category: "Action",
      icon: "scan",
      action: () => {
        if (onOpenBarcode) onOpenBarcode();
      },
    },
    {
      id: "nav-dash",
      title: "Go to Dashboard",
      subtitle: "Daily overview and nutrition metrics",
      category: "Navigation",
      icon: "home",
      action: () => onNavigate("dashboard"),
    },
    {
      id: "nav-analyze",
      title: "Analyze a Meal",
      subtitle: "Capture photo or review AI recognition",
      category: "Navigation",
      icon: "scan",
      action: () => onNavigate("analyze"),
    },
    {
      id: "nav-diary",
      title: "Food Diary",
      subtitle: "Review logged meals and macro balance",
      category: "Navigation",
      icon: "book",
      action: () => onNavigate("diary"),
    },
    {
      id: "nav-insights",
      title: "Nutrition Insights",
      subtitle: "Weekly rhythm, habits, and plant variety",
      category: "Navigation",
      icon: "chart",
      action: () => onNavigate("insights"),
    },
    {
      id: "nav-assistant",
      title: "Ask AI Assistant",
      subtitle: "Grounded guidance based on today's diary",
      category: "Navigation",
      icon: "sparkles",
      action: () => onNavigate("assistant"),
    },
    {
      id: "nav-recipes",
      title: "Browse Recipes",
      subtitle: "High-protein, quick, and balanced meal ideas",
      category: "Navigation",
      icon: "recipe",
      action: () => onNavigate("recipes"),
    },
    {
      id: "nav-profile",
      title: "Profile & Settings",
      subtitle: "Adjust nutrition goals and privacy",
      category: "Navigation",
      icon: "settings",
      action: () => onNavigate("profile"),
    },
  ];

  // Dynamic food items
  const foodItems: CommandItem[] = searchFoods.map((food) => ({
    id: `food-${food.id}`,
    title: food.name,
    subtitle: `${food.calories} kcal · ${food.protein}g protein · ${food.serving}`,
    category: "Food",
    icon: "utensils",
    action: () => {
      if (onSelectFood) onSelectFood(food.name);
      onNavigate("diary");
    },
  }));

  // Dynamic recipe items
  const recipeItems: CommandItem[] = recipes.map((recipe) => ({
    id: `recipe-${recipe.id}`,
    title: recipe.title,
    subtitle: `${recipe.tag} · ${recipe.time} · ${recipe.protein} protein`,
    category: "Recipe",
    icon: "recipe",
    action: () => onNavigate("recipes"),
  }));

  const allItems = [...baseItems, ...foodItems, ...recipeItems];

  const filteredItems = query.trim()
    ? allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : baseItems;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (isOpen) {
        if (e.key === "Escape") {
          onClose();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
        } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
          e.preventDefault();
          filteredItems[selectedIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, filteredItems, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="command-palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Quick search and command palette"
    >
      <div className="command-palette">
        <div className="command-search-bar">
          <Icon name="search" size={18} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, food name, or recipe..."
            aria-label="Search command palette"
          />
          <kbd>ESC</kbd>
        </div>
        <div className="command-results-list">
          {filteredItems.length === 0 ? (
            <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No results found for "{query}"
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`command-item ${index === selectedIndex ? "command-item--selected" : ""}`}
                onClick={() => {
                  item.action();
                  onClose();
                }}
              >
                <div className="command-item-icon">
                  <Icon name={item.icon} size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: "0.875rem" }}>{item.title}</strong>
                  <small style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{item.subtitle}</small>
                </div>
                <span className="command-item-meta">{item.category}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
