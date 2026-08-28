export function Tabs<T extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  activeTab: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs-container" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`tab-btn ${activeTab === tab.id ? "tab-btn--active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              style={{
                marginLeft: "6px",
                fontSize: "0.6875rem",
                padding: "1px 5px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: activeTab === tab.id ? "var(--bg-surface-subtle)" : "transparent",
              }}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
