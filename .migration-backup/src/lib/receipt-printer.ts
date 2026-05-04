// Per-device receipt printer preset (paper size for thermal printer).
// Stored in localStorage so it stays consistent across all receipts on a device.

export type ReceiptPaper = "58" | "80";

const KEY = "kopihub.receiptPaper";

export function getReceiptPaper(): ReceiptPaper {
  if (typeof window === "undefined") return "58";
  const v = window.localStorage.getItem(KEY);
  return v === "80" ? "80" : "58";
}

export function setReceiptPaper(paper: ReceiptPaper) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, paper);
  document.body.dataset.receiptPaper = paper;
}

/** Apply current preset to <body> so CSS rules take effect for both
 * the on-screen preview and the @media print output. */
export function applyReceiptPaper(paper?: ReceiptPaper) {
  if (typeof document === "undefined") return;
  document.body.dataset.receiptPaper = paper ?? getReceiptPaper();
}

/** Print a node using the active receipt-paper preset. Ensures body
 * data attribute is set BEFORE window.print() so @page picks it up. */
export function printReceiptNode(node: HTMLElement | null) {
  if (!node) return;
  applyReceiptPaper();
  node.classList.add("print-area");
  try {
    window.print();
  } finally {
    node.classList.remove("print-area");
  }
}
