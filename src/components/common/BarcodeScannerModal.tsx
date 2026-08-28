import { useState, useEffect } from "react";
import { Icon } from "../../icons";
import { Modal } from "./Modal";
import { Button } from "./Button";
import type { Meal } from "../../types";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogScannedFood: (meal: Meal) => void;
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onLogScannedFood,
}: BarcodeScannerModalProps) {
  const [scanState, setScanState] = useState<"scanning" | "recognized">("scanning");

  useEffect(() => {
    if (isOpen) {
      setScanState("scanning");
      const timer = setTimeout(() => {
        setScanState("recognized");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleConfirmLog = () => {
    const scannedMeal: Meal = {
      id: `barcode-${Date.now()}`,
      type: "Snack",
      name: "Organic Greek Yogurt & Wild Honey",
      description: "Non-fat strained yogurt · organic raw honey · 170g tub",
      time: "Just now",
      date: "Today, Aug 22",
      art: "meal-art--yogurt",
      image: "/images/yogurt-berries.jpg",
      calories: 140,
      protein: 16,
      carbs: 15,
      fat: 0,
      fiber: 0,
      sodium: 60,
      confidence: 1.0,
      portion: "1 container (170g)",
      tags: ["High Protein", "Barcode Verified"],
      source: "GS1 Barcode / USDA FoodData Central",
    };
    onLogScannedFood(scannedMeal);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Barcode Scanner"
      subtitle="Point your camera at any packaged food item to auto-fetch official nutrition facts."
    >
      {scanState === "scanning" ? (
        <div
          style={{
            position: "relative",
            height: "260px",
            backgroundColor: "#121d17",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            marginBottom: "var(--space-4)",
          }}
        >
          {/* Laser Scanner */}
          <div className="scanner-laser-line" />

          {/* Viewfinder Target */}
          <div
            style={{
              width: "180px",
              height: "120px",
              border: "2px solid rgba(167, 243, 208, 0.8)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 0 0 1000px rgba(0, 0, 0, 0.4)",
              position: "relative",
              display: "grid",
              placeItems: "center",
            }}
          >
            <div style={{ position: "absolute", top: "-10px", left: "-10px", width: "16px", height: "16px", borderTop: "3px solid #34d399", borderLeft: "3px solid #34d399" }} />
            <div style={{ position: "absolute", top: "-10px", right: "-10px", width: "16px", height: "16px", borderTop: "3px solid #34d399", borderRight: "3px solid #34d399" }} />
            <div style={{ position: "absolute", bottom: "-10px", left: "-10px", width: "16px", height: "16px", borderBottom: "3px solid #34d399", borderLeft: "3px solid #34d399" }} />
            <div style={{ position: "absolute", bottom: "-10px", right: "-10px", width: "16px", height: "16px", borderBottom: "3px solid #34d399", borderRight: "3px solid #34d399" }} />
            <span style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.8)", letterSpacing: "0.05em" }}>
              ALIGN BARCODE
            </span>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.75rem",
              color: "#a7f3d0",
            }}
          >
            <Icon name="refresh" size={14} className="animate-spin" />
            <span>Scanning for EAN/UPC barcode...</span>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <div
            style={{
              padding: "var(--space-4)",
              backgroundColor: "var(--brand-primary-subtle)",
              border: "1px solid var(--brand-primary-border)",
              borderRadius: "var(--radius-lg)",
              marginBottom: "var(--space-4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Icon name="check" size={16} style={{ color: "var(--brand-primary)" }} />
              <strong style={{ color: "var(--brand-primary)", fontSize: "0.9375rem" }}>
                Barcode 893500182931 Verified
              </strong>
            </div>
            <h4 style={{ fontSize: "1.125rem", margin: "4px 0 2px" }}>
              Organic Greek Yogurt & Wild Honey
            </h4>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
              Serving: 1 container (170g) · 140 kcal · 16g protein · 15g carbs · 0g fat
            </p>
          </div>

          <div className="result-nutrition-grid" style={{ marginBottom: "var(--space-4)" }}>
            <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-calories-bg)" }}>
              <span>Energy</span>
              <strong>140 kcal</strong>
            </div>
            <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-protein-bg)" }}>
              <span>Protein</span>
              <strong>16 g</strong>
            </div>
            <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-carbs-bg)" }}>
              <span>Carbs</span>
              <strong>15 g</strong>
            </div>
            <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-fat-bg)" }}>
              <span>Fat</span>
              <strong>0 g</strong>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {scanState === "recognized" && (
          <Button variant="primary" icon="plus" onClick={handleConfirmLog}>
            Log Scanned Product
          </Button>
        )}
      </div>
    </Modal>
  );
}
