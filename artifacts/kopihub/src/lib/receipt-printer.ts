// Per-device receipt printer preset (paper size for thermal printer).
// Stored in localStorage so it stays consistent across all receipts on a device.

import { supabase } from "@/integrations/supabase/client";

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
export function printReceiptNode(node: HTMLElement | null, paperSize?: ReceiptPaper) {
  if (!node) return;
  applyReceiptPaper(paperSize);
  node.classList.add("print-area");
  try {
    window.print();
  } finally {
    node.classList.remove("print-area");
  }
}

/** 
 * Multi-Printer Support
 * In a real-world scenario, this might use a local bridge or direct network printing.
 * For this implementation, we simulate routing by determining which printer should handle which item.
 */
export type Printer = {
  id: string;
  name: string;
  type: string;
  connection_type: "browser" | "network" | "bluetooth";
  address?: string;
  paper_size: ReceiptPaper;
};

export async function getOutletPrinters(outletId: string): Promise<Printer[]> {
  const { data, error } = await supabase
    .from("printers")
    .select("*")
    .eq("outlet_id", outletId)
    .eq("is_active", true);
  
  if (error) return [];
  return data as Printer[];
}

/**
 * Routes items to their respective printers based on category settings.
 */
export function routeItemsToPrinters(items: any[], printers: Printer[], categories: any[]) {
  const routing: Record<string, any[]> = {};

  items.forEach(item => {
    const category = categories.find(c => c.id === item.category_id);
    const printerId = category?.printer_id;
    const targetPrinter = printers.find(p => p.id === printerId) || printers.find(p => p.name.toLowerCase().includes("kasir")) || printers[0];
    
    if (targetPrinter) {
      if (!routing[targetPrinter.id]) routing[targetPrinter.id] = [];
      routing[targetPrinter.id].push(item);
    }
  });

  return routing;
}
