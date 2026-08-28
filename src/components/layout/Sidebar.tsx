import { Icon, type IconName } from "../../icons";
import type { View } from "../../types";

export const primaryNav: { id: View; label: string; icon: IconName; badge?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "analyze", label: "Analyze meal", icon: "scan" },
  { id: "diary", label: "Food diary", icon: "book" },
  { id: "insights", label: "Insights", icon: "chart" },
  { id: "assistant", label: "AI assistant", icon: "sparkles", badge: "AI" },
  { id: "recipes", label: "Recipes", icon: "recipe" },
];

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  userName: string;
}

export function Sidebar({ activeView, onNavigate, userName }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Desktop primary navigation">
      <div className="brand-wrapper">
        <div className="brand-mark">
          <Icon name="leaf" size={20} strokeWidth={2.2} />
        </div>
        <div className="brand-name">
          Nutri<span>AI</span>
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-avatar">
          {userName.charAt(0)}
        </div>
        <div className="workspace-info">
          <span>{userName}’s workspace</span>
        </div>
        <Icon name="shield-check" size={14} style={{ color: "var(--brand-accent)" }} />
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {primaryNav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-link-btn ${activeView === item.id ? "nav-link-btn--active" : ""}`}
            onClick={() => onNavigate(item.id)}
            aria-current={activeView === item.id ? "page" : undefined}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
            {item.badge && <span className="nav-link-badge">{item.badge}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="privacy-badge">
          <Icon name="shield" size={15} />
          <span>Local session · Private</span>
        </div>
        <button
          type="button"
          className={`nav-link-btn ${activeView === "profile" ? "nav-link-btn--active" : ""}`}
          onClick={() => onNavigate("profile")}
        >
          <Icon name="settings" size={18} />
          <span>Settings</span>
        </button>
        <button
          type="button"
          className="user-profile-btn"
          onClick={() => onNavigate("profile")}
          aria-label="Open user profile"
        >
          <div className="user-avatar-main">
            {userName.charAt(0)}
          </div>
          <div className="user-meta-text">
            <strong>{userName}</strong>
            <small>Personal account</small>
          </div>
          <Icon name="chevron-right" size={15} style={{ color: "var(--text-subtle)" }} />
        </button>
      </div>
    </aside>
  );
}
