import { useEffect, useState } from "react";
import { Icon } from "../../icons";

export function ProcessingState({ previewImage }: { previewImage: string | null }) {
  const bgImg = previewImage || "/images/pho-bo.jpg";
  const [progressPct, setProgressPct] = useState(25);

  useEffect(() => {
    const timer1 = setTimeout(() => setProgressPct(60), 400);
    const timer2 = setTimeout(() => setProgressPct(95), 850);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="scanner-container-card" aria-busy="true" aria-live="polite">
      <div
        className="scanner-image-view"
        style={{ backgroundImage: `url(${bgImg})` }}
      >
        <div className="scanner-laser-line" />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            border: "2px solid rgba(167, 243, 208, 0.7)",
            animation: "sonar-wave 2s infinite ease-out",
            pointerEvents: "none",
          }}
        />
        <div className="scanner-overlay-badge">
          <Icon name="sparkles" size={13} />
          <span>Multi-Layer Vision Scanning · {progressPct}%</span>
        </div>
      </div>

      <div className="scanner-content-pane">
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            border: "3px solid var(--border-default)",
            borderTopColor: "var(--brand-primary)",
            marginBottom: "var(--space-4)",
          }}
          className="animate-spin"
        />
        <p className="section-kicker">AI Computer Vision in Progress</p>
        <h3 style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)" }}>
          Segmenting foods & portion weights
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", lineHeight: 1.5, marginBottom: "var(--space-4)" }}>
          Segmenting protein, carbohydrates, and vegetables, estimating physical volumes, and querying trusted nutrition databases.
        </p>

        {/* Progress Bar */}
        <div style={{ height: "6px", backgroundColor: "var(--bg-surface-subtle)", borderRadius: "var(--radius-pill)", overflow: "hidden", marginBottom: "var(--space-4)" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, backgroundColor: "var(--brand-accent)", transition: "width 0.4s ease" }} />
        </div>

        <div className="scanner-status-list">
          <div className="scanner-status-item">
            <Icon name="check" size={15} />
            <span>Image normalization complete</span>
          </div>
          <div className="scanner-status-item">
            <Icon name="check" size={15} />
            <span>Identified 4 food segments & bounding coordinates</span>
          </div>
          <div className="scanner-status-item scanner-status-item--pending">
            <Icon name="refresh" size={14} className="animate-spin" />
            <span>Resolving Vietnamese nutrition taxonomy...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
