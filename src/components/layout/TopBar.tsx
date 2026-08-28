import { useState } from "react";
import { Icon } from "../../icons";
import type { View } from "../../types";

interface TopBarProps {
  title: string;
  onOpenSearch: () => void;
  onNavigate: (view: View) => void;
  avatarText: string;
}

export function TopBar({
  title,
  onOpenSearch,
  onNavigate,
  avatarText,
}: TopBarProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => onNavigate("dashboard")}
          aria-label="NutriAI Home"
        >
          <Icon name="leaf" size={22} style={{ color: "var(--brand-primary)" }} />
        </button>
        <div>
          <span className="topbar-date">Saturday, August 22</span>
          <h1 className="topbar-title">{title}</h1>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="search-trigger-btn"
          onClick={onOpenSearch}
          aria-label="Open search and command palette"
        >
          <Icon name="search" size={16} />
          <span>Search diary, foods, recipes...</span>
          <kbd>⌘ K</kbd>
        </button>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="icon-action-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="View notifications"
            aria-expanded={showNotifications}
          >
            <Icon name="bell" size={18} />
            <span className="notification-count-dot">2</span>
          </button>

          {showNotifications && (
            <div
              style={{
                position: "absolute",
                top: "48px",
                right: 0,
                width: "300px",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-elevated)",
                padding: "var(--space-4)",
                zIndex: 50,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "var(--space-3)",
                  borderBottom: "1px solid var(--border-subtle)",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                }}
              >
                <span>Notifications</span>
                <span style={{ fontSize: "0.75rem", color: "var(--brand-primary)", fontWeight: 600 }}>2 new</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-3) 0" }}>
                <div style={{ display: "flex", gap: "var(--space-3)", fontSize: "0.8125rem" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#eaf6ee", color: "#286d48", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon name="check" size={13} />
                  </div>
                  <div>
                    <strong style={{ display: "block", color: "var(--text-primary)" }}>Meal confirmed</strong>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Your Phở bò analysis is saved to today's diary.</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--space-3)", fontSize: "0.8125rem" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#fff0e8", color: "#9e532b", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon name="sparkles" size={13} />
                  </div>
                  <div>
                    <strong style={{ display: "block", color: "var(--text-primary)" }}>Protein rhythm insight</strong>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>You hit 74% of your daily protein target across 3 meals.</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-full"
                onClick={() => {
                  setShowNotifications(false);
                  onNavigate("insights");
                }}
                style={{ marginTop: "var(--space-2)", color: "var(--brand-primary)" }}
              >
                View all insights
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onNavigate("profile")}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: "#b98a73",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.8125rem",
            display: "grid",
            placeItems: "center",
            boxShadow: "var(--shadow-xs)",
          }}
          aria-label="Profile"
        >
          {avatarText}
        </button>
      </div>
    </header>
  );
}
