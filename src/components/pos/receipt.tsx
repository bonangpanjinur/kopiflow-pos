import { forwardRef } from "react";
import { formatIDR } from "@/lib/format";
import type { CartItem } from "@/lib/cart";

export type PaymentSplit = { method: string; amount: number };

type Props = {
  shopName: string;
  outletName: string;
  orderNo: string;
  cashierName: string;
  date: Date;
  items: CartItem[];
  subtotal: number;
  total: number;
  paymentMethod: "cash" | "qris";
  amountTendered?: number;
  changeDue?: number;
  customerName?: string;
  promoCode?: string | null;
  promoDiscount?: number;
  manualDiscount?: number;
  pointsRedeemed?: number;
  pointsRedeemValue?: number;
  pointsEarned?: number;
  tipAmount?: number;
  serviceCharge?: number;
  tax?: number;
  paymentSplit?: PaymentSplit[];
  shopLogoUrl?: string | null;
  shopAddress?: string | null;
  shopPhone?: string | null;
};

function methodLabel(m: string) {
  if (m === "cash") return "Tunai";
  if (m === "qris") return "QRIS";
  if (m === "transfer") return "Transfer";
  return m.toUpperCase();
}

export const Receipt = forwardRef<HTMLDivElement, Props>(function Receipt(
  {
    shopName,
    outletName,
    orderNo,
    cashierName,
    date,
    items,
    subtotal,
    total,
    paymentMethod,
    amountTendered,
    changeDue,
    customerName,
    promoCode,
    promoDiscount = 0,
    manualDiscount = 0,
    pointsRedeemed = 0,
    pointsRedeemValue = 0,
    pointsEarned = 0,
    tipAmount = 0,
    serviceCharge = 0,
    tax = 0,
    paymentSplit = [],
    shopLogoUrl = null,
    shopAddress = null,
    shopPhone = null,
  },
  ref,
) {
  const hasSplit = paymentSplit && paymentSplit.length > 0;
  const safeShopName = (shopName ?? "").trim() || "Toko";
  const safeOutletName = (outletName ?? "").trim();
  const safeAddress = (shopAddress ?? "").trim();
  const safePhone = (shopPhone ?? "").trim();
  const safeLogo = (shopLogoUrl ?? "").trim();
  return (
    <div ref={ref} className="receipt-58">
      {safeLogo && (
        <div className="r-center" style={{ marginBottom: 4 }}>
          <img
            src={safeLogo}
            alt=""
            style={{ maxHeight: 48, maxWidth: "60%", objectFit: "contain", display: "inline-block" }}
            onError={(e) => {
              // Fallback gracefully when logo fails to load — hide image so layout stays intact
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <div className="r-center r-bold">{safeShopName}</div>
      {safeOutletName && <div className="r-center">{safeOutletName}</div>}
      {safeAddress && <div className="r-center r-small">{safeAddress}</div>}
      {safePhone && <div className="r-center r-small">Telp. {safePhone}</div>}
      <div className="r-divider" />
      <div className="r-row">
        <span>No</span>
        <span>#{orderNo}</span>
      </div>
      <div className="r-row">
        <span>Tanggal</span>
        <span>
          {date.toLocaleDateString("id-ID")} {date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div className="r-row">
        <span>Kasir</span>
        <span>{cashierName}</span>
      </div>
      {customerName && (
        <div className="r-row">
          <span>Pelanggan</span>
          <span>{customerName}</span>
        </div>
      )}
      <div className="r-divider" />
      {items.map((it, idx) => (
        <div key={idx} className="r-item">
          <div>{it.name}</div>
          <div className="r-row">
            <span>
              {it.quantity} x {formatIDR(it.unit_price)}
            </span>
            <span>{formatIDR(it.unit_price * it.quantity)}</span>
          </div>
          {it.note && <div className="r-small">  · {it.note}</div>}
        </div>
      ))}
      <div className="r-divider" />
      <div className="r-row">
        <span>Subtotal</span>
        <span>{formatIDR(subtotal)}</span>
      </div>
      {promoDiscount > 0 && (
        <div className="r-row">
          <span>Promo{promoCode ? ` (${promoCode})` : ""}</span>
          <span>-{formatIDR(promoDiscount)}</span>
        </div>
      )}
      {manualDiscount > 0 && (
        <div className="r-row">
          <span>Diskon</span>
          <span>-{formatIDR(manualDiscount)}</span>
        </div>
      )}
      {pointsRedeemed > 0 && pointsRedeemValue > 0 && (
        <div className="r-row">
          <span>Tukar {pointsRedeemed} poin</span>
          <span>-{formatIDR(pointsRedeemValue)}</span>
        </div>
      )}
      {serviceCharge > 0 && (
        <div className="r-row">
          <span>Service</span>
          <span>{formatIDR(serviceCharge)}</span>
        </div>
      )}
      {tax > 0 && (
        <div className="r-row">
          <span>Pajak</span>
          <span>{formatIDR(tax)}</span>
        </div>
      )}
      {tipAmount > 0 && (
        <div className="r-row">
          <span>Tip</span>
          <span>{formatIDR(tipAmount)}</span>
        </div>
      )}
      <div className="r-row r-bold">
        <span>TOTAL</span>
        <span>{formatIDR(total)}</span>
      </div>
      <div className="r-divider" />
      {hasSplit ? (
        <>
          {paymentSplit.map((p, i) => (
            <div key={i} className="r-row">
              <span>Bayar ({methodLabel(p.method)})</span>
              <span>{formatIDR(p.amount)}</span>
            </div>
          ))}
        </>
      ) : (
        <div className="r-row">
          <span>Bayar ({methodLabel(paymentMethod)})</span>
          <span>{formatIDR(amountTendered ?? total)}</span>
        </div>
      )}
      {!hasSplit && paymentMethod === "cash" && (changeDue ?? 0) > 0 && (
        <div className="r-row">
          <span>Kembalian</span>
          <span>{formatIDR(changeDue ?? 0)}</span>
        </div>
      )}
      {pointsEarned > 0 && (
        <>
          <div className="r-divider" />
          <div className="r-center r-small">Anda mendapat {pointsEarned} poin loyalty ⭐</div>
        </>
      )}
      <div className="r-divider" />
      <div className="r-center">Terima kasih!</div>
      <div className="r-center r-small">Powered by KopiHub</div>
    </div>
  );
});
