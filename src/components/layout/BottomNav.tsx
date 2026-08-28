import { Icon, type IconName } from "../../icons";
import type { View } from "../../types";

const bottomNavItems: { id: View; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Home", icon: "home" },
  { id: "analyze", label: "Analyze", icon: "scan" },
  { id: "diary", label: "Diary", icon: "book" },
  { id: "assistant", label: "AI", icon: "sparkles" },
  { id: "profile", label: "Profile", icon: "user" },
];

export function BottomNav({
  activeView,
  onNavigate,
}: {
  activeView: View;
  onNavigate: (view: View) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {bottomNavItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav-item ${activeView === item.id ? "bottom-nav-item--active" : ""}`}
          onClick={() => onNavigate(item.id)}
          aria-current={activeView === item.id ? "page" : undefined}
        >
          <Icon name={item.icon} size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
