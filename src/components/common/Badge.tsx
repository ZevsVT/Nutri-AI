import type { ReactNode } from "react";
import { Icon, type IconName } from "../../icons";

interface BadgeProps {
  variant?: "green" | "peach" | "blue" | "amber" | "subtle";
  icon?: IconName;
  children: ReactNode;
  className?: string;
}

export function Badge({
  variant = "subtle",
  icon,
  children,
  className = "",
}: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className}`.trim()}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  return (
    <span className="confidence-indicator">
      <span className="confidence-dot" />
      <span>{percent}% confidence</span>
    </span>
  );
}
