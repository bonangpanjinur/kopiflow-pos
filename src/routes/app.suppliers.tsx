import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/suppliers")({ component: SuppliersPage });

type Supplier = {
  id: string; name: string; contact_name: string | null; phone: string | null;
  email: string | null; address: string | null; note: string | null; is_active: boolean;
};

function SuppliersPage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", contact_name: "", phone: "", email: "", address: "", note: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!shop) return;
    setLoading(true);
    const { data, error } = await supabase.from("suppliers").select("*")
      .eq("shop_id", shop.id).eq("is_active", true).order("name");
    if (error) toast.error(error.message);
    setItems((data ?? []) as Supplier[]);
    setLoading(false);
  }
  useEffect(() => { if (shop) load(); /* eslint-disable-next-line */ }, [shop?.id]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", contact_name: "", phone: "", email: "", address: "", note: "" });
    setOpen(true);
  }
  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name, contact_name: s.contact_name ?? "", phone: s.phone ?? "",
      email: s.email ?? "", address: s.address ?? "", note: s.note ?? "",
    });
    setOpen(true);
  }
  async function save() {
    if (!shop || !form.name.trim()) return;
    setSaving(true);
    const payload = {
      shop_id: shop.id, name: form.name.trim(),
      contact_name: form.contact_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      note: form.note.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("suppliers").update(payload).eq("id", editing.id)
      : await supabase.from("suppliers").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(editing ? "Supplier diperbarui" : "Supplier ditambahkan"); setOpen(false); load(); }
    setSaving(false);
  }
  async function remove(s: Supplier) {
    if (!confirm(`Nonaktifkan supplier "${s.name}"?`)) return;
    const { error } = await supabase.from("suppliers").update({ is_active: false }).eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success("Supplier dinonaktifkan"); load(); }
  }

  if (shopLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplier</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola daftar pemasok bahan baku.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Supplier baru</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit supplier" : "Supplier baru"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5"><Label>Nama supplier *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mis. CV Bahan Kopi" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Kontak person</Label>
                  <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Telepon</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Alamat</Label>
                <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Catatan</Label>
                <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
              <Button onClick={save} disabled={saving || !form.name.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Truck className="h-6 w-6" /></div>
          <h2 className="text-lg font-semibold">Belum ada supplier</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">Tambahkan supplier untuk dipakai saat membuat Purchase Order.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2.5 text-left">Nama</th><th className="px-4 py-2.5 text-left">Kontak</th><th className="px-4 py-2.5 text-left">Telepon</th><th className="px-4 py-2.5 text-left">Email</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.contact_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(s)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
