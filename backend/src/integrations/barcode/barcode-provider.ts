export interface BarcodeLookupResult {
  barcode: string;
  productName?: string;
  brand?: string;
  nutrition?: Record<string, number>;
  source?: { provider: string; version?: string };
}

/** Provider boundary for barcode services; the public API does not depend on a vendor SDK. */
export interface BarcodeProvider {
  lookup(barcode: string): Promise<BarcodeLookupResult | null>;
}

export class NoopBarcodeProvider implements BarcodeProvider {
  async lookup(barcode: string): Promise<BarcodeLookupResult | null> {
    void barcode;
    return null;
  }
}
