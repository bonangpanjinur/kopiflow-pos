/**
 * Hitung pajak & service charge berdasarkan setting toko.
 * - tax_inclusive=true  → total sudah termasuk pajak (tax dipisah dari subtotal di display).
 * - tax_inclusive=false → pajak ditambahkan di atas subtotal.
 * Service charge selalu ditambahkan di atas subtotal (sebelum pajak), kecuali tax_inclusive.
 */
export type ShopChargeConfig = {
  tax_percent: number;
  service_charge_percent: number;
  tax_inclusive: boolean;
};

export type Charges = {
  subtotal: number;
  service_charge: number;
  tax: number;
  total: number;
};

export function computeCharges(rawSubtotal: number, cfg: ShopChargeConfig): Charges {
  const subtotal = Math.max(0, Math.round(rawSubtotal));
  const taxP = Math.max(0, Number(cfg.tax_percent || 0));
  const svcP = Math.max(0, Number(cfg.service_charge_percent || 0));

  if (cfg.tax_inclusive) {
    // subtotal sudah include pajak; pisahkan untuk display
    const tax = Math.round((subtotal * taxP) / (100 + taxP));
    const service_charge = Math.round(((subtotal - tax) * svcP) / 100);
    return { subtotal, service_charge, tax, total: subtotal + service_charge };
  }

  const service_charge = Math.round((subtotal * svcP) / 100);
  const taxBase = subtotal + service_charge;
  const tax = Math.round((taxBase * taxP) / 100);
  return { subtotal, service_charge, tax, total: subtotal + service_charge + tax };
}
