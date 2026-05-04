import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";

type OptionGroup = {
  id: string;
  name: string;
  is_required: boolean;
  max_select: number;
  sort_order: number;
};

type OptionChoice = {
  id: string;
  group_id: string;
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
};

export function ModifierManager({ open, onClose, menuItemId, menuItemName, shopId }: Props) {
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [options, setOptions] = useState<OptionChoice[]>([]);
  const [loading, setLoading] = useState(true);

  // New group form
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [newGroupMax, setNewGroupMax] = useState("1");

  // New option form
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [newOptName, setNewOptName] = useState("");
  const [newOptPrice, setNewOptPrice] = useState("0");

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open, menuItemId]);

  async function loadData() {
    setLoading(true);
    const [g, o] = await Promise.all([
      supabase
        .from("menu_item_option_groups")
        .select("id, name, is_required, max_select, sort_order")
        .eq("menu_item_id", menuItemId)
        .eq("shop_id", shopId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_item_options")
        .select("id, group_id, name, price_adjustment, is_available, sort_order")
        .eq("shop_id", shopId)
        .order("sort_order", { ascending: true }),
    ]);
    setGroups((g.data ?? []) as OptionGroup[]);
    // Filter options to only relevant groups
    const groupIds = new Set((g.data ?? []).map((x: { id: string }) => x.id));
    setOptions(((o.data ?? []) as OptionChoice[]).filter((x) => groupIds.has(x.group_id)));
    setLoading(false);
  }

  async function addGroup() {
    if (!newGroupName.trim()) return;
    const { error } = await supabase.from("menu_item_option_groups").insert({
      menu_item_id: menuItemId,
      shop_id: shopId,
      name: newGroupName.trim(),
      is_required: newGroupRequired,
      max_select: Math.max(1, Number(newGroupMax) || 1),
      sort_order: groups.length,
    });
    if (error) return toast.error(error.message);
    toast.success("Grup opsi ditambahkan");
    setNewGroupName("");
    setNewGroupRequired(false);
    setNewGroupMax("1");
    loadData();
  }

  async function deleteGroup(id: string) {
    if (!confirm("Hapus grup opsi ini beserta semua pilihannya?")) return;
    const { error } = await supabase.from("menu_item_option_groups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Grup dihapus");
    loadData();
  }

  async function addOption() {
    if (!addingToGroup || !newOptName.trim()) return;
    const groupOptions = options.filter((o) => o.group_id === addingToGroup);
    const { error } = await supabase.from("menu_item_options").insert({
      group_id: addingToGroup,
      shop_id: shopId,
      name: newOptName.trim(),
      price_adjustment: Number(newOptPrice) || 0,
      sort_order: groupOptions.length,
    });
    if (error) return toast.error(error.message);
    toast.success("Pilihan ditambahkan");
    setNewOptName("");
    setNewOptPrice("0");
    setAddingToGroup(null);
    loadData();
  }

  async function deleteOption(id: string) {
    const { error } = await supabase.from("menu_item_options").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadData();
  }

  async function toggleOptionAvail(id: string, val: boolean) {
    await supabase.from("menu_item_options").update({ is_available: val }).eq("id", id);
    loadData();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Varian & Modifier — {menuItemName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => {
              const gOpts = options.filter((o) => o.group_id === g.id);
              return (
                <div key={g.id} className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm">{g.name}</span>
                      <div className="flex gap-2 mt-0.5">
                        {g.is_required && (
                          <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Wajib</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">Maks. pilih: {g.max_select}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteGroup(g.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {gOpts.length > 0 && (
                    <div className="space-y-1">
                      {gOpts.map((opt) => (
                        <div key={opt.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={opt.is_available}
                              onCheckedChange={(v) => toggleOptionAvail(opt.id, v)}
                              className="scale-75"
                            />
                            <span className="text-sm">{opt.name}</span>
                            {opt.price_adjustment !== 0 && (
                              <span className="text-xs text-muted-foreground">
                                {opt.price_adjustment > 0 ? "+" : ""}{formatIDR(opt.price_adjustment)}
                              </span>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteOption(opt.id)}>
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingToGroup === g.id ? (
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Nama pilihan</Label>
                        <Input value={newOptName} onChange={(e) => setNewOptName(e.target.value)} placeholder="Mis. Large" />
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs">+/- Harga</Label>
                        <Input type="number" value={newOptPrice} onChange={(e) => setNewOptPrice(e.target.value)} />
                      </div>
                      <Button size="sm" onClick={addOption} disabled={!newOptName.trim()}>OK</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddingToGroup(null)}>×</Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => { setAddingToGroup(g.id); setNewOptName(""); setNewOptPrice("0"); }}>
                      <Plus className="mr-1 h-3 w-3" /> Tambah pilihan
                    </Button>
                  )}
                </div>
              );
            })}

            {/* Add new group */}
            <div className="rounded-lg border border-dashed border-border p-3 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Tambah grup opsi baru</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nama grup</Label>
                  <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Mis. Ukuran" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Maks. pilihan</Label>
                  <Input type="number" min={1} value={newGroupMax} onChange={(e) => setNewGroupMax(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newGroupRequired} onCheckedChange={setNewGroupRequired} />
                <Label className="text-sm">Wajib dipilih</Label>
              </div>
              <Button size="sm" onClick={addGroup} disabled={!newGroupName.trim()}>
                <Plus className="mr-1 h-3 w-3" /> Tambah Grup
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
