import { forwardRef } from "react";
import { formatIDR } from "@/lib/format";
import type { CartItem } from "@/lib/cart";

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
};

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
  },
  ref,
) {
  return (
    <div ref={ref} className="receipt-58">
      <div className="r-center r-bold">{shopName}</div>
      <div className="r-center">{outletName}</div>
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
      <div className="r-row r-bold">
        <span>TOTAL</span>
        <span>{formatIDR(total)}</span>
      </div>
      <div className="r-divider" />
      <div className="r-row">
        <span>Bayar ({paymentMethod === "cash" ? "Tunai" : "QRIS"})</span>
        <span>{formatIDR(amountTendered ?? total)}</span>
      </div>
      {paymentMethod === "cash" && (changeDue ?? 0) > 0 && (
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
