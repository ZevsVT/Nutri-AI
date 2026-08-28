import { Icon } from "../../icons";
import { Button } from "../common/Button";
import { ConfidenceBadge } from "../common/Badge";
import type { NutritionFacts } from "../../types";

interface ResultStateProps {
  previewImage: string | null;
  nutrition: NutritionFacts;
  portion: string;
  isSaved: boolean;
  onSaveToDiary: () => void;
  onAnalyzeAnother: () => void;
  onAskAI: () => void;
}

export function ResultState({
  previewImage,
  nutrition,
  portion,
  isSaved,
  onSaveToDiary,
  onAnalyzeAnother,
  onAskAI,
}: ResultStateProps) {
  const bgImg = previewImage || "/images/pho-bo.jpg";

  return (
    <div className="review-layout-split">
      <div className="card">
        <div
          style={{
            position: "relative",
            height: "180px",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            backgroundImage: `url(${bgImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            marginBottom: "var(--space-4)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "12px",
              left: "12px",
              backgroundColor: "rgba(45, 106, 79, 0.88)",
              color: "#fff",
              padding: "4px 8px",
              borderRadius: "var(--radius-xs)",
              fontSize: "0.75rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Icon name="check" size={13} strokeWidth={2.5} />
            Confirmed Analysis
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <div>
            <p className="section-kicker">{portion}</p>
            <h3 style={{ fontSize: "1.375rem" }}>Phở Bò (Beef Noodle Soup)</h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Lean beef tenderloin · fresh flat rice noodles · herbs & sprouts · herbal beef broth
            </p>
          </div>
          <ConfidenceBadge confidence={0.87} />
        </div>

        <div className="result-nutrition-grid">
          <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-calories-bg)" }}>
            <span style={{ color: "var(--nutrient-calories-text)" }}>Energy</span>
            <strong>{nutrition.calories} <small style={{ fontSize: "0.6875rem" }}>kcal</small></strong>
          </div>
          <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-protein-bg)" }}>
            <span style={{ color: "var(--nutrient-protein-text)" }}>Protein</span>
            <strong>{nutrition.protein} <small style={{ fontSize: "0.6875rem" }}>g</small></strong>
          </div>
          <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-carbs-bg)" }}>
            <span style={{ color: "var(--nutrient-carbs-text)" }}>Carbs</span>
            <strong>{nutrition.carbs} <small style={{ fontSize: "0.6875rem" }}>g</small></strong>
          </div>
          <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-fat-bg)" }}>
            <span style={{ color: "var(--nutrient-fat-text)" }}>Fat</span>
            <strong>{nutrition.fat} <small style={{ fontSize: "0.6875rem" }}>g</small></strong>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "var(--space-3) 0",
            borderTop: "1px solid var(--border-subtle)",
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: "0.8125rem",
            color: "var(--text-secondary)",
            marginBottom: "var(--space-5)",
          }}
        >
          <span><strong>Fiber:</strong> {nutrition.fiber}g</span>
          <span><strong>Sodium:</strong> {nutrition.sodium}mg</span>
          <span><strong>Sugar:</strong> {nutrition.sugar}g</span>
        </div>

        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <Button
            variant={isSaved ? "subtle" : "primary"}
            size="lg"
            icon="check"
            onClick={onSaveToDiary}
            fullWidth
            disabled={isSaved}
          >
            {isSaved ? "Saved to Diary" : "Save to Food Diary"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={onAnalyzeAnother}
          >
            Analyze New
          </Button>
        </div>

        <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.6875rem", color: "var(--text-subtle)", marginTop: "var(--space-4)" }}>
          <Icon name="shield-check" size={14} style={{ color: "var(--brand-accent)" }} />
          Verified with Curated Vietnamese Food Table & USDA FoodData Central.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div
          className="card"
          style={{
            backgroundColor: "var(--brand-primary-subtle)",
            border: "1px solid var(--brand-primary-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "var(--space-2)" }}>
            <Icon name="sparkles" size={16} style={{ color: "var(--brand-primary)" }} />
            <h4 style={{ fontSize: "0.9375rem", color: "var(--brand-primary-hover)" }}>
              AI Nutritional Context
            </h4>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "var(--space-3)" }}>
            This meal delivers a rich <strong>{nutrition.protein}g protein</strong> portion from lean beef, supporting muscle recovery. The fresh basil and bean sprouts supply natural phytonutrients.
          </p>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            <strong>Gentle balance tip:</strong> Traditional broth contains higher sodium ({nutrition.sodium}mg). Drinking 2 extra glasses of water this afternoon and opting for steamed greens at dinner will restore optimal electrolyte balance.
          </p>
        </div>

        <div className="card">
          <div className="card-header" style={{ marginBottom: "var(--space-2)" }}>
            <h4 style={{ fontSize: "0.875rem" }}>Have questions about this meal?</h4>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
            Our AI assistant can suggest side pairings or explain glycemic impact.
          </p>
          <Button
            variant="ghost"
            size="sm"
            icon="sparkles"
            onClick={onAskAI}
            style={{ color: "var(--brand-primary)", padding: 0 }}
          >
            Ask NutriAI about this meal →
          </Button>
        </div>
      </div>
    </div>
  );
}
