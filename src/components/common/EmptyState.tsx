import { Icon, type IconName } from "../../icons";
import { Button } from "./Button";

export function EmptyState({
  icon = "search",
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "var(--space-10) var(--space-6)",
        backgroundColor: "var(--bg-surface)",
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--radius-xl)",
        gap: "var(--space-3)",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          display: "grid",
          placeItems: "center",
          backgroundColor: "var(--brand-primary-subtle)",
          color: "var(--brand-primary)",
          borderRadius: "var(--radius-md)",
          marginBottom: "var(--space-2)",
        }}
      >
        <Icon name={icon} size={22} />
      </div>
      <h4 style={{ fontSize: "1.125rem", color: "var(--text-primary)" }}>{title}</h4>
      <p style={{ maxWidth: "340px", fontSize: "0.875rem", color: "var(--text-muted)" }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="subtle" size="sm" onClick={onAction} style={{ marginTop: "var(--space-2)" }}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
