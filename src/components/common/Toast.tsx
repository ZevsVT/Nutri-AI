import { useEffect } from "react";
import { Icon } from "../../icons";

interface ToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, onClose, duration = 3500 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      <div className="toast-icon-wrap">
        <Icon name="check" size={14} strokeWidth={2.5} />
      </div>
      <span>{message}</span>
    </div>
  );
}
