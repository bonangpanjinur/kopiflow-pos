import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import type { SelectedOption } from "@/lib/cart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export type OptionGroup = {
  id: string;
  name: string;
  is_required: boolean;
  max_select: number;
  sort_order: number;
  options: OptionChoice[];
};

export type OptionChoice = {
  id: string;
  name: string;
  price_adjustment: number;
  is_available: boolean;
  sort_order: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  menuItemId: string;
  menuItemName: string;
  shopId: string;
  onConfirm: (selected: SelectedOption[]) => void;
};

export function ModifierPicker({ open, onClose, menuItemId, menuItemName, shopId, onConfirm }: Props) {
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open || !menuItemId) return;
    setLoading(true);
    (async () => {
      const { data: grps } = await supabase
        .from("menu_item_option_groups")
        .select("id, name, is_required, max_select, sort_order")
        .eq("menu_item_id", menuItemId)
        .eq("shop_id", shopId)
        .order("sort_order", { ascending: true });

      if (!grps || grps.length === 0) {
        setGroups([]);
        setLoading(false);
        // No options, confirm immediately
        onConfirm([]);
        onClose();
        return;
      }

      const groupIds = grps.map((g) => g.id);
      const { data: opts } = await supabase
        .from("menu_item_options")
        .select("id, group_id, name, price_adjustment, is_available, sort_order")
        .in("group_id", groupIds)
        .eq("is_available", true)
        .order("sort_order", { ascending: true });

      const optMap = new Map<string, OptionChoice[]>();
      for (const o of opts ?? []) {
        const list = optMap.get(o.group_id) ?? [];
        list.push(o as OptionChoice);
        optMap.set(o.group_id, list);
      }

      const fullGroups: OptionGroup[] = grps.map((g) => ({
        ...g,
        options: optMap.get(g.id) ?? [],
      }));

      setGroups(fullGroups);
      // Initialize defaults
      const init: Record<string, string[]> = {};
      fullGroups.forEach((g) => {
        init[g.id] = [];
      });
      setSelections(init);
      setLoading(false);
    })();
  }, [open, menuItemId, shopId]);

  function toggleOption(groupId: string, optionId: string, maxSelect: number) {
    setSelections((prev) => {
      const curr = prev[groupId] ?? [];
      if (curr.includes(optionId)) {
        return { ...prev, [groupId]: curr.filter((id) => id !== optionId) };
      }
      if (maxSelect === 1) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (curr.length >= maxSelect) return prev;
      return { ...prev, [groupId]: [...curr, optionId] };
    });
  }

  function handleConfirm() {
    // Validate required groups
    for (const g of groups) {
      if (g.is_required && (selections[g.id] ?? []).length === 0) {
        return; // could show error, but button is disabled
      }
    }
    const selected: SelectedOption[] = [];
    for (const g of groups) {
      for (const optId of selections[g.id] ?? []) {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) {
          selected.push({
            group_id: g.id,
            group_name: g.name,
            option_id: opt.id,
            option_name: opt.name,
            price_adjustment: Number(opt.price_adjustment),
          });
        }
      }
    }
    onConfirm(selected);
    onClose();
  }

  const allValid = groups.every(
    (g) => !g.is_required || (selections[g.id] ?? []).length > 0,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Pilih Opsi — {menuItemName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold">{g.name}</span>
                  {g.is_required && (
                    <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Wajib</span>
                  )}
                  {g.max_select > 1 && (
                    <span className="text-[10px] text-muted-foreground">Maks. {g.max_select}</span>
                  )}
                </div>
                {g.max_select === 1 ? (
                  <RadioGroup
                    value={selections[g.id]?.[0] ?? ""}
                    onValueChange={(v) => setSelections((prev) => ({ ...prev, [g.id]: [v] }))}
                  >
                    {g.options.map((opt) => (
                      <div key={opt.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value={opt.id} id={`opt-${opt.id}`} />
                          <Label htmlFor={`opt-${opt.id}`} className="text-sm cursor-pointer">
                            {opt.name}
                          </Label>
                        </div>
                        {opt.price_adjustment !== 0 && (
                          <span className="text-xs text-muted-foreground">
                            {opt.price_adjustment > 0 ? "+" : ""}{formatIDR(opt.price_adjustment)}
                          </span>
                        )}
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-1">
                    {g.options.map((opt) => {
                      const checked = (selections[g.id] ?? []).includes(opt.id);
                      return (
                        <div key={opt.id} className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`opt-${opt.id}`}
                              checked={checked}
                              onCheckedChange={() => toggleOption(g.id, opt.id, g.max_select)}
                            />
                            <Label htmlFor={`opt-${opt.id}`} className="text-sm cursor-pointer">
                              {opt.name}
                            </Label>
                          </div>
                          {opt.price_adjustment !== 0 && (
                            <span className="text-xs text-muted-foreground">
                              {opt.price_adjustment > 0 ? "+" : ""}{formatIDR(opt.price_adjustment)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={handleConfirm} disabled={!allValid || loading}>Konfirmasi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Check if a menu item has option groups (lightweight count check) */
export async function hasModifiers(menuItemId: string, shopId: string): Promise<boolean> {
  const { count } = await supabase
    .from("menu_item_option_groups")
    .select("id", { count: "exact", head: true })
    .eq("menu_item_id", menuItemId)
    .eq("shop_id", shopId);
  return (count ?? 0) > 0;
}
