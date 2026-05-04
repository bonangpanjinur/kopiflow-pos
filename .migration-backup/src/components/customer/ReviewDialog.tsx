import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Item = { menu_item_id: string; name: string };

export function ReviewDialog({
  open,
  onOpenChange,
  orderId,
  shopId,
  userId,
  items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  shopId: string;
  userId: string;
  items: Item[];
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("menu_reviews")
        .select("menu_item_id, rating, comment")
        .eq("order_id", orderId)
        .eq("user_id", userId);
      const r: Record<string, number> = {};
      const c: Record<string, string> = {};
      const ex: Record<string, boolean> = {};
      (data ?? []).forEach((row: any) => {
        r[row.menu_item_id] = row.rating;
        c[row.menu_item_id] = row.comment ?? "";
        ex[row.menu_item_id] = true;
      });
      setRatings(r);
      setComments(c);
      setExisting(ex);
    })();
  }, [open, orderId, userId]);

  const save = async () => {
    const rows = items
      .filter((it) => ratings[it.menu_item_id])
      .map((it) => ({
        shop_id: shopId,
        menu_item_id: it.menu_item_id,
        order_id: orderId,
        user_id: userId,
        rating: ratings[it.menu_item_id],
        comment: comments[it.menu_item_id]?.trim() || null,
      }));
    if (rows.length === 0) {
      toast.error("Berikan minimal 1 rating");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("menu_reviews")
      .upsert(rows, { onConflict: "order_id,menu_item_id,user_id" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Terima kasih atas ulasannya!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Beri ulasan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {items.map((it) => {
            const rating = ratings[it.menu_item_id] ?? 0;
            return (
              <div key={it.menu_item_id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{it.name}</p>
                  {existing[it.menu_item_id] && (
                    <span className="text-[10px] text-muted-foreground">Sudah dinilai</span>
                  )}
                </div>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setRatings((p) => ({ ...p, [it.menu_item_id]: n }))
                      }
                      className="p-1"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          n <= rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <Textarea
                  className="mt-2 text-sm"
                  placeholder="Komentar (opsional)"
                  value={comments[it.menu_item_id] ?? ""}
                  onChange={(e) =>
                    setComments((p) => ({ ...p, [it.menu_item_id]: e.target.value }))
                  }
                  rows={2}
                />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Menyimpan…" : "Kirim ulasan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
