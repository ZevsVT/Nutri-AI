import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "../../icons";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "subtle" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  iconPosition?: "left" | "right";
  iconSize?: number;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconPosition = "left",
  iconSize = 16,
  loading = false,
  fullWidth = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  const variantClass = `btn-${variant}`;
  const fullWidthClass = fullWidth ? "btn-full" : "";

  return (
    <button
      type="button"
      className={`btn ${variantClass} ${sizeClass} ${fullWidthClass} ${className}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Icon name="refresh" size={iconSize} className="animate-spin" />
      ) : icon && iconPosition === "left" ? (
        <Icon name={icon} size={iconSize} />
      ) : null}
      {children}
      {!loading && icon && iconPosition === "right" ? (
        <Icon name={icon} size={iconSize} />
      ) : null}
    </button>
  );
}
