import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Printer as PrinterIcon, 
  Trash2, 
  Loader2, 
  Settings2,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/app/printers")({
  component: PrintersPage,
});

type Printer = {
  id: string;
  name: string;
  type: string;
  connection_type: string;
  address: string | null;
  paper_size: string;
  is_active: boolean;
};

function PrintersPage() {
  const { shop, outlet, loading: shopLoading } = useCurrentShop();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Printer | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!outlet) return;
    setLoading(true);
    const { data } = await supabase
      .from("printers")
      .select("*")
      .eq("outlet_id", outlet.id)
      .order("created_at", { ascending: true });
    setPrinters((data ?? []) as Printer[]);
    setLoading(false);
  }

  useEffect(() => {
    if (outlet) load();
  }, [outlet]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shop || !outlet) return;
    
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name") as string,
      type: formData.get("type") as string,
      connection_type: formData.get("connection_type") as string,
      address: formData.get("address") as string,
      paper_size: formData.get("paper_size") as string,
      is_active: true,
      shop_id: shop.id,
      outlet_id: outlet.id,
    };

    const { error } = editing 
      ? await supabase.from("printers").update(payload).eq("id", editing.id)
      : await supabase.from("printers").insert([payload]);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editing ? "Printer diperbarui" : "Printer ditambahkan");
      setDialogOpen(false);
      setEditing(null);
      load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus printer ini?")) return;
    const { error } = await supabase.from("printers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Printer dihapus");
      load();
    }
  }

  if (shopLoading) return <div className="p-8 text-center"><Loader2 className="mx-auto animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Printer</h1>
          <p className="text-muted-foreground">Kelola printer untuk kasir, dapur, dan bar</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Printer
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin" /></div>
      ) : printers.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <PrinterIcon className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
          <h3 className="text-lg font-medium">Belum ada printer</h3>
          <p className="text-sm text-muted-foreground mb-6">Tambahkan printer untuk mulai mencetak struk atau pesanan dapur</p>
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Printer Pertama
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {printers.map(p => (
            <div key={p.id} className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PrinterIcon className="h-5 w-5" />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <h3 className="font-bold text-lg">{p.name}</h3>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Tipe:</span>
                  <span className="font-medium text-foreground capitalize">{p.type}</span>
                </div>
                <div className="flex justify-between">
                  <span>Koneksi:</span>
                  <span className="font-medium text-foreground capitalize">{p.connection_type}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ukuran Kertas:</span>
                  <span className="font-medium text-foreground">{p.paper_size}mm</span>
                </div>
                {p.address && (
                  <div className="flex justify-between">
                    <span>Alamat:</span>
                    <span className="font-medium text-foreground">{p.address}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t flex items-center gap-2">
                {p.is_active ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                    <CheckCircle2 className="h-3 w-3" /> Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <XCircle className="h-3 w-3" /> Nonaktif
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Printer" : "Tambah Printer"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Printer</Label>
                <Input id="name" name="name" defaultValue={editing?.name} placeholder="Misal: Printer Kasir, Printer Dapur" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipe</Label>
                  <Select name="type" defaultValue={editing?.type || "thermal"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thermal">Thermal</SelectItem>
                      <SelectItem value="inkjet">Inkjet / Laser</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paper_size">Ukuran Kertas</Label>
                  <Select name="paper_size" defaultValue={editing?.paper_size || "58"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58">58mm</SelectItem>
                      <SelectItem value="80">80mm</SelectItem>
                      <SelectItem value="A4">A4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="connection_type">Jenis Koneksi</Label>
                <Select name="connection_type" defaultValue={editing?.connection_type || "browser"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="browser">Browser Print (Sistem)</SelectItem>
                    <SelectItem value="network">Network / IP</SelectItem>
                    <SelectItem value="bluetooth">Bluetooth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Alamat / IP (Opsional)</Label>
                <Input id="address" name="address" defaultValue={editing?.address || ""} placeholder="192.168.1.100" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editing ? "Simpan Perubahan" : "Tambah Printer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
