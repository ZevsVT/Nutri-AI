import { useState } from "react";
import { Icon } from "../../icons";
import { Button } from "../common/Button";
import { EditGoalModal } from "./EditGoalModal";
import type { UserGoals, UserProfile } from "../../types";

interface ProfileViewProps {
  userProfile: UserProfile;
  onUpdateGoals: (goals: UserGoals) => void;
  onExportData: () => void;
}

export function ProfileView({
  userProfile,
  onUpdateGoals,
  onExportData,
}: ProfileViewProps) {
  const [isEditGoalsOpen, setIsEditGoalsOpen] = useState(false);
  const [privacyPolicyOpen, setPrivacyPolicyOpen] = useState(false);

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <p className="section-kicker">Account & Preferences</p>
          <h2>Profile & Settings</h2>
          <p className="view-header-subtitle">
            Configure your personalized nutrition goals, dietary focus, and privacy.
          </p>
        </div>
      </div>

      <div className="profile-view-split">
        <div>
          <div className="profile-hero-badge">
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #c49a85, #9b6c56)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: "1.25rem",
                fontWeight: 700,
              }}
            >
              {userProfile.avatarText}
            </div>
            <div>
              <h3 style={{ fontSize: "1.1875rem", marginBottom: "2px" }}>{userProfile.name}</h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", margin: 0 }}>
                {userProfile.accountType} · Member since {userProfile.memberSince}
              </p>
            </div>
          </div>

          <div className="profile-settings-group">
            <div className="card-header" style={{ marginBottom: "var(--space-3)" }}>
              <div>
                <p className="section-kicker">Nutrition Targets</p>
                <h4 style={{ fontSize: "1rem" }}>Daily Nutrition Goals</h4>
              </div>
              <Button
                variant="subtle"
                size="sm"
                icon="edit"
                onClick={() => setIsEditGoalsOpen(true)}
              >
                Edit Targets
              </Button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "0.8125rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-muted)" }}>Target Calories</span>
                <strong>{userProfile.goals.calories} kcal / day</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-muted)" }}>Protein Target</span>
                <strong>{userProfile.goals.protein} g / day</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-muted)" }}>Dietary Fiber Target</span>
                <strong>{userProfile.goals.fiber} g / day</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: "var(--text-muted)" }}>Hydration Target</span>
                <strong>{(userProfile.goals.waterMl / 1000).toFixed(1)} L / day</strong>
              </div>
            </div>
          </div>

          <div className="profile-settings-group">
            <div className="card-header" style={{ marginBottom: "var(--space-3)" }}>
              <div>
                <p className="section-kicker">Personalization</p>
                <h4 style={{ fontSize: "1rem" }}>Dietary Focus & Preferences</h4>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "0.8125rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-muted)" }}>Dietary Style</span>
                <strong>{userProfile.dietaryPreference}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-muted)" }}>Allergies & Exclusions</span>
                <strong>{userProfile.allergies.join(", ")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: "var(--text-muted)" }}>Interests</span>
                <strong>{userProfile.nutritionInterests.join(" · ")}</strong>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="card">
            <div className="card-header" style={{ marginBottom: "var(--space-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="shield-check" size={18} style={{ color: "var(--brand-primary)" }} />
                <h4 style={{ fontSize: "0.9375rem" }}>Privacy & Data Sovereignty</h4>
              </div>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "var(--space-4)" }}>
              NutriAI enforces user-owned data isolation. Your meal history and photos are private to your session.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <Button
                variant="secondary"
                size="sm"
                icon="download"
                fullWidth
                onClick={onExportData}
              >
                Export My Data (JSON)
              </Button>
            </div>
          </div>

          <div
            style={{
              padding: "var(--space-4)",
              backgroundColor: "var(--bg-surface-subtle)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            <strong>Local Offline Prototype Mode</strong>
            <p style={{ margin: "4px 0 0" }}>
              NutriAI is running locally. All state is maintained in reactive local session storage.
            </p>
          </div>
        </div>
      </div>

      <EditGoalModal
        isOpen={isEditGoalsOpen}
        onClose={() => setIsEditGoalsOpen(false)}
        goals={userProfile.goals}
        onSaveGoals={onUpdateGoals}
      />
    </div>
  );
}
