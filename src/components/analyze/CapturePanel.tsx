import type { ChangeEvent, RefObject } from "react";
import { Icon } from "../../icons";
import { Button } from "../common/Button";

interface CapturePanelProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onDemoMeal: () => void;
}

export function CapturePanel({
  fileInputRef,
  onFileSelect,
  onDemoMeal,
}: CapturePanelProps) {
  return (
    <div className="capture-layout-grid">
      <div className="upload-dropzone-panel">
        <div
          className="dropzone-inner"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Upload photo of your meal"
        >
          <div className="dropzone-icon-circle">
            <Icon name="camera" size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "4px" }}>
              Upload or snap a photo
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", maxWidth: "320px" }}>
              Drag and drop an image here, or browse from your device.
            </p>
          </div>
          <div className="dropzone-actions" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="primary"
              size="md"
              icon="upload"
              onClick={() => fileInputRef.current?.click()}
            >
              Select Image
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon="sparkles"
              onClick={onDemoMeal}
            >
              Try Phở Bò Demo
            </Button>
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-subtle)", marginTop: "4px" }}>
            Supports JPG, PNG, WebP up to 10MB · Privacy guaranteed
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileSelect}
          className="sr-only"
          aria-hidden="true"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div className="card">
          <div className="card-header" style={{ marginBottom: "var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Icon name="sparkles" size={16} style={{ color: "var(--brand-accent)" }} />
              <h4 style={{ fontSize: "0.9375rem" }}>How NutriAI Vision Works</h4>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "0.8125rem" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "var(--brand-primary-subtle)", color: "var(--brand-primary)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.6875rem", flexShrink: 0 }}>
                1
              </div>
              <p style={{ margin: 0 }}>
                <strong>Multi-item detection</strong> recognizes proteins, carbohydrates, and vegetables.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "var(--brand-primary-subtle)", color: "var(--brand-primary)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.6875rem", flexShrink: 0 }}>
                2
              </div>
              <p style={{ margin: 0 }}>
                <strong>Provenance lookup</strong> references USDA and regional Vietnamese nutrition tables.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "var(--brand-primary-subtle)", color: "var(--brand-primary)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.6875rem", flexShrink: 0 }}>
                3
              </div>
              <p style={{ margin: 0 }}>
                <strong>Interactive correction</strong> lets you verify ingredients and portion weights before saving.
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-4)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            fontSize: "0.8125rem",
          }}
        >
          <Icon name="shield-check" size={22} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
          <div>
            <strong style={{ display: "block", color: "var(--text-primary)" }}>Private & Secure</strong>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
              Images are processed privately and never shared with third parties.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
