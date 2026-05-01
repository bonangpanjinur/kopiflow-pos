import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, QrCode, Banknote, Loader2 } from "lucide-react";
import { formatIDR } from "@/lib/format";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  onConfirm: (method: string, amount: number) => Promise<void>;
}

export function PaymentDialog({ open, onOpenChange, total, onConfirm }: PaymentDialogProps) {
  const [method, setMethod] = useState<"cash" | "qris">("cash");
  const [cashAmount, setCashAmount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setMethod("cash");
      setCashAmount("");
      setLoading(false);
    }
  }, [open]);

  const amount = Number(cashAmount || 0);
  const change = amount - total;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(method, method === "cash" ? amount : total);
    } finally {
      setLoading(false);
    }
  };

  const quickCash = [total, 20000, 50000, 100000].filter(v => v >= total);
  // Add some rounded values
  const next10k = Math.ceil(total / 10000) * 10000;
  const next50k = Math.ceil(total / 50000) * 50000;
  const suggestions = Array.from(new Set([...quickCash, next10k, next50k])).sort((a, b) => a - b).slice(0, 4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Total Tagihan</div>
            <div className="text-3xl font-bold text-primary">{formatIDR(total)}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={method === "cash" ? "default" : "outline"}
              className="h-20 flex-col gap-2"
              onClick={() => setMethod("cash")}
            >
              <Banknote className="h-6 w-6" />
              Tunai
            </Button>
            <Button
              variant={method === "qris" ? "default" : "outline"}
              className="h-20 flex-col gap-2"
              onClick={() => setMethod("qris")}
            >
              <QrCode className="h-6 w-6" />
              QRIS
            </Button>
          </div>

          {method === "cash" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <Label>Uang Diterima</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                  <Input
                    type="number"
                    className="pl-10 text-lg font-semibold"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {suggestions.map((v) => (
                  <Button
                    key={v}
                    variant="outline"
                    size="sm"
                    onClick={() => setCashAmount(v.toString())}
                  >
                    {formatIDR(v)}
                  </Button>
                ))}
              </div>

              {amount >= total && (
                <div className="rounded-lg bg-primary/5 p-3 text-center border border-primary/10">
                  <div className="text-xs text-muted-foreground">Kembalian</div>
                  <div className="text-xl font-bold text-primary">{formatIDR(change)}</div>
                </div>
              )}
            </div>
          )}

          {method === "qris" && (
            <div className="flex flex-col items-center justify-center py-4 space-y-3 animate-in fade-in zoom-in-95">
              <div className="rounded-xl border-2 border-dashed p-8">
                <QrCode className="h-24 w-24 text-muted-foreground opacity-20" />
              </div>
              <p className="text-sm text-muted-foreground text-center px-8">
                Scan QRIS pada terminal atau tunjukkan QR statis kepada pelanggan.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            className="w-full h-12 text-lg"
            disabled={loading || (method === "cash" && amount < total)}
            onClick={handleConfirm}
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
            Selesaikan Pesanan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
