import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getReceiptPaper,
  setReceiptPaper,
  applyReceiptPaper,
  type ReceiptPaper,
} from "@/lib/receipt-printer";

/** Inline picker (58mm / 80mm) that persists per-device via localStorage
 * and immediately applies the choice to <body> so on-screen preview and
 * subsequent prints both reflect it. */
export function ReceiptPaperPicker({ className }: { className?: string }) {
  const [paper, setPaper] = useState<ReceiptPaper>("58");

  useEffect(() => {
    const v = getReceiptPaper();
    setPaper(v);
    applyReceiptPaper(v);
  }, []);

  function pick(v: ReceiptPaper) {
    setPaper(v);
    setReceiptPaper(v);
  }

  return (
    <div className={"inline-flex rounded-md border bg-background p-0.5 " + (className ?? "")}>
      <Button
        type="button"
        size="sm"
        variant={paper === "58" ? "default" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => pick("58")}
        aria-pressed={paper === "58"}
      >
        58 mm
      </Button>
      <Button
        type="button"
        size="sm"
        variant={paper === "80" ? "default" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => pick("80")}
        aria-pressed={paper === "80"}
      >
        80 mm
      </Button>
    </div>
  );
}
