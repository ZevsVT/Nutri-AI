import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../services/apiClient";
import { canLogProduct, saveScannedProduct, scanBarcode, type BarcodeProduct } from "../../services/barcodeService";
import type { SavedMeal } from "../../services/mealService";
import { NutritionSummary } from "../analyze/ResultState";
import { Button } from "./Button";
import { Modal } from "./Modal";

export function BarcodeScannerModal({ onClose, onSaveMeal, onManual, onExpired }: {
  onClose: () => void;
  onSaveMeal: (meal: SavedMeal) => void;
  onManual: () => void;
  onExpired: () => void;
}) {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  const lookup = useCallback(async (code: string) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBarcode(code);
    setScanning(false);
    setLooking(true);
    setProduct(null);
    setMessage("");
    setError("");
    try {
      const result = await scanBarcode(code, controller.signal);
      if (controller.signal.aborted) return;
      if (!result.product) {
        setMessage("No active product matches this barcode. Scan again or search the food catalog.");
        return;
      }
      setProduct(result.product);
      setQuantity("");
      setUnit(result.product.nutrition?.servingUnit ?? "");
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : "Barcode lookup failed. Try again.");
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setLooking(false);
    }
  }, [onExpired]);

  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let stopDecoder: (() => void) | undefined;
    const preview = video.current;
    const stopTracks = () => stream?.getTracks().forEach((track) => track.stop());

    async function start() {
      if (!preview || !navigator.mediaDevices?.getUserMedia)
        throw new Error("Camera access is unavailable here. Enter the barcode manually.");
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import("@zxing/browser"), import("@zxing/library"),
      ]);
      if (stopped) return;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: "environment" } },
      });
      if (stopped) {
        stopTracks();
        return;
      }
      const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_8, BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.ITF,
      ]]]);
      let decoded = false;
      const controls = await new BrowserMultiFormatReader(hints).decodeFromStream(stream, preview, (result, _error, scanner) => {
        if (stopped || decoded || !result) return;
        decoded = true;
        scanner.stop();
        stopTracks();
        void lookup(result.getText());
      });
      stopDecoder = () => controls.stop();
      if (stopped) stopDecoder();
    }

    void start().catch((failure: unknown) => {
      stopTracks();
      if (stopped) return;
      setScanning(false);
      setError(failure instanceof DOMException
        ? failure.name === "NotAllowedError"
          ? "Camera access was denied. Enter the barcode manually or allow camera access."
          : "Could not open a camera. Enter the barcode manually."
        : failure instanceof Error ? failure.message : "Camera scanning failed. Enter the barcode manually.");
    });

    return () => {
      stopped = true;
      stopDecoder?.();
      stopTracks();
      if (preview) preview.srcObject = null;
    };
  }, [scanning, lookup]);

  async function save() {
    if (!product || saving) return;
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount < 0.001 || amount > 100_000 || !unit.trim()) {
      setError("Enter a positive consumed quantity and its unit.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const meal = await saveScannedProduct(product, amount, unit.trim());
      onSaveMeal(meal);
      onClose();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : "Could not log the product.");
    } finally {
      setSaving(false);
    }
  }

  const close = () => { if (!saving) onClose(); };

  return (
    <Modal isOpen onClose={close} title="Scan a packaged food" wide>
      <fieldset disabled={saving} style={{ border: 0, padding: 0 }}>
        {scanning ? (
          <>
            <video ref={video} autoPlay muted playsInline aria-label="Barcode camera preview" style={{ width: "100%" }} />
            <Button onClick={() => setScanning(false)}>Stop camera</Button>
          </>
        ) : (
          <Button icon="camera" disabled={looking} onClick={() => {
            setError(""); setMessage(""); setProduct(null); setScanning(true);
          }}>Start camera</Button>
        )}
        <form onSubmit={(event) => { event.preventDefault(); void lookup(barcode.trim()); }}>
          <label className="form-label">
            Barcode digits
            <input className="form-input" inputMode="numeric" autoComplete="off" value={barcode} maxLength={64}
              onChange={(event) => {
                setBarcode(event.target.value);
                setProduct(null);
                setError("");
                setMessage("");
              }} />
          </label>
          <Button type="submit" loading={looking} disabled={!barcode.trim()}>Look up barcode</Button>
        </form>
        {looking && <p role="status">Looking up the product…</p>}
        {message && <p role="status">{message}</p>}
        {product && (
          <section className="card">
            <h4>{product.productName}</h4>
            <p>{[product.brand, product.variant].filter(Boolean).join(" · ")}</p>
            <dl>
              <dt>Package size</dt>
              <dd>{product.package.quantity !== null && product.package.unit
                ? `${product.package.quantity} ${product.package.unit}${product.package.unitsPerPack > 1 ? ` across ${product.package.unitsPerPack} units` : ""}`
                : "Unknown"}</dd>
              <dt>Labeled serving</dt>
              <dd>{product.labeledServing ? `${product.labeledServing.quantity} ${product.labeledServing.unit}` : "Unknown"}</dd>
              <dt>Product identity source</dt>
              <dd>{product.source.provider}{product.source.version && ` (${product.source.version})`}</dd>
            </dl>
            {product.nutrition && (
              <>
                <p>Nutrition per {product.nutrition.servingAmount} {product.nutrition.servingUnit} · {product.nutrition.source} ({product.nutrition.version})</p>
                {product.nutritionAvailability === "PARTIAL" && <p>Some nutrient values are unavailable.</p>}
                <NutritionSummary totals={product.nutrition} />
              </>
            )}
            {canLogProduct(product) ? (
              <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
                <label className="form-label">
                  Consumed quantity
                  <input className="form-input" type="number" min="0.001" max="100000" step="0.001" value={quantity}
                    onChange={(event) => setQuantity(event.target.value)} required />
                </label>
                <label className="form-label">
                  Consumed unit
                  <input className="form-input" value={unit} maxLength={32}
                    onChange={(event) => setUnit(event.target.value)} required />
                </label>
                <Button type="submit" variant="primary" loading={saving}>Log this product</Button>
              </form>
            ) : <p>A usable nutrition reference is unavailable for this product. Search for a food you can log.</p>}
          </section>
        )}
        {error && <p role="alert">{error}</p>}
        <Button onClick={onManual}>Search foods manually</Button>
      </fieldset>
    </Modal>
  );
}
