import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Save, Package, Palette } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/catalog")({ component: AdminCatalog });

type Feature = { key: string; name: string; description: string | null; category: string; is_active: boolean; sort_order: number };
type Theme = { key: string; name: string; description: string | null; preview_image_url: string | null; component_id: string | null; tier_hint: string | null; is_active: boolean; sort_order: number };

function AdminCatalog() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [newFeature, setNewFeature] = useState({ key: "", name: "", description: "", category: "general" });
  const [newTheme, setNewTheme] = useState({ key: "", name: "", description: "", tier_hint: "free", component_id: "" });
  const [showNewFeature, setShowNewFeature] = useState(false);
  const [showNewTheme, setShowNewTheme] = useState(false);

  const loadFeatures = async () => {
    const { data } = await supabase.from("features").select("*").order("sort_order");
    setFeatures((data as Feature[]) ?? []);
  };
  const loadThemes = async () => {
    const { data } = await supabase.from("themes").select("*").order("sort_order");
    setThemes((data as Theme[]) ?? []);
  };
  useEffect(() => { loadFeatures(); loadThemes(); }, []);

  const saveFeature = async (f: Feature) => {
    const { error } = await supabase.from("features").update({
      name: f.name, description: f.description, category: f.category, is_active: f.is_active, sort_order: f.sort_order,
    }).eq("key", f.key);
    if (error) toast.error(error.message); else toast.success("Fitur tersimpan");
    loadFeatures();
  };

  const addFeature = async () => {
    if (!newFeature.key || !newFeature.name) { toast.error("Key & nama wajib diisi"); return; }
    const { error } = await supabase.from("features").insert(newFeature);
    if (error) toast.error(error.message); else { toast.success("Fitur ditambahkan"); setShowNewFeature(false); setNewFeature({ key: "", name: "", description: "", category: "general" }); }
    loadFeatures();
  };

  const deleteFeature = async (key: string) => {
    if (!confirm("Hapus fitur ini?")) return;
    const { error } = await supabase.from("features").delete().eq("key", key);
    if (error) toast.error(error.message); else toast.success("Fitur dihapus");
    loadFeatures();
  };

  const saveTheme = async (t: Theme) => {
    const { error } = await supabase.from("themes").update({
      name: t.name, description: t.description, tier_hint: t.tier_hint, component_id: t.component_id, is_active: t.is_active, sort_order: t.sort_order,
    }).eq("key", t.key);
    if (error) toast.error(error.message); else toast.success("Tema tersimpan");
    loadThemes();
  };

  const addTheme = async () => {
    if (!newTheme.key || !newTheme.name) { toast.error("Key & nama wajib diisi"); return; }
    const { error } = await supabase.from("themes").insert(newTheme);
    if (error) toast.error(error.message); else { toast.success("Tema ditambahkan"); setShowNewTheme(false); setNewTheme({ key: "", name: "", description: "", tier_hint: "free", component_id: "" }); }
    loadThemes();
  };

  const deleteTheme = async (key: string) => {
    if (!confirm("Hapus tema ini?")) return;
    const { error } = await supabase.from("themes").delete().eq("key", key);
    if (error) toast.error(error.message); else toast.success("Tema dihapus");
    loadThemes();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <h1 className="text-2xl font-bold mb-6">Katalog Fitur & Tema</h1>
      <Tabs defaultValue="features">
        <TabsList>
          <TabsTrigger value="features"><Package className="h-4 w-4 mr-1.5" />Fitur</TabsTrigger>
          <TabsTrigger value="themes"><Palette className="h-4 w-4 mr-1.5" />Tema</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Dialog open={showNewFeature} onOpenChange={setShowNewFeature}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Tambah Fitur</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Fitur Baru</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Key (unik)</Label><Input value={newFeature.key} onChange={(e) => setNewFeature({ ...newFeature, key: e.target.value })} placeholder="custom_domain" /></div>
                  <div><Label>Nama</Label><Input value={newFeature.name} onChange={(e) => setNewFeature({ ...newFeature, name: e.target.value })} /></div>
                  <div><Label>Deskripsi</Label><Textarea value={newFeature.description} onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })} /></div>
                  <div><Label>Kategori</Label><Input value={newFeature.category} onChange={(e) => setNewFeature({ ...newFeature, category: e.target.value })} /></div>
                  <Button onClick={addFeature} className="w-full">Simpan</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {features.map((f) => (
            <Card key={f.key} className="p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label>Key</Label><Input value={f.key} disabled /></div>
                <div><Label>Nama</Label><Input value={f.name} onChange={(e) => setFeatures((arr) => arr.map((x) => x.key === f.key ? { ...x, name: e.target.value } : x))} /></div>
                <div><Label>Kategori</Label><Input value={f.category} onChange={(e) => setFeatures((arr) => arr.map((x) => x.key === f.key ? { ...x, category: e.target.value } : x))} /></div>
                <div className="sm:col-span-2"><Label>Deskripsi</Label><Input value={f.description ?? ""} onChange={(e) => setFeatures((arr) => arr.map((x) => x.key === f.key ? { ...x, description: e.target.value } : x))} /></div>
                <div className="flex items-end gap-3">
                  <div><Label>Urutan</Label><Input type="number" className="w-20" value={f.sort_order} onChange={(e) => setFeatures((arr) => arr.map((x) => x.key === f.key ? { ...x, sort_order: Number(e.target.value) } : x))} /></div>
                  <div className="flex items-center gap-1.5"><Switch checked={f.is_active} onCheckedChange={(v) => setFeatures((arr) => arr.map((x) => x.key === f.key ? { ...x, is_active: v } : x))} /><Label className="text-xs">Aktif</Label></div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => saveFeature(f)}><Save className="h-3.5 w-3.5 mr-1" />Simpan</Button>
                <Button size="sm" variant="destructive" onClick={() => deleteFeature(f.key)}><Trash2 className="h-3.5 w-3.5 mr-1" />Hapus</Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="themes" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Dialog open={showNewTheme} onOpenChange={setShowNewTheme}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Tambah Tema</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Tema Baru</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Key (unik)</Label><Input value={newTheme.key} onChange={(e) => setNewTheme({ ...newTheme, key: e.target.value })} placeholder="modern_dark" /></div>
                  <div><Label>Nama</Label><Input value={newTheme.name} onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })} /></div>
                  <div><Label>Deskripsi</Label><Textarea value={newTheme.description ?? ""} onChange={(e) => setNewTheme({ ...newTheme, description: e.target.value })} /></div>
                  <div><Label>Tier Hint</Label><Input value={newTheme.tier_hint} onChange={(e) => setNewTheme({ ...newTheme, tier_hint: e.target.value })} placeholder="free / pro / pro_plus" /></div>
                  <div><Label>Component ID</Label><Input value={newTheme.component_id} onChange={(e) => setNewTheme({ ...newTheme, component_id: e.target.value })} /></div>
                  <Button onClick={addTheme} className="w-full">Simpan</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {themes.map((t) => (
            <Card key={t.key} className="p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label>Key</Label><Input value={t.key} disabled /></div>
                <div><Label>Nama</Label><Input value={t.name} onChange={(e) => setThemes((arr) => arr.map((x) => x.key === t.key ? { ...x, name: e.target.value } : x))} /></div>
                <div><Label>Tier Hint</Label><Input value={t.tier_hint ?? ""} onChange={(e) => setThemes((arr) => arr.map((x) => x.key === t.key ? { ...x, tier_hint: e.target.value } : x))} /></div>
                <div className="sm:col-span-2"><Label>Deskripsi</Label><Input value={t.description ?? ""} onChange={(e) => setThemes((arr) => arr.map((x) => x.key === t.key ? { ...x, description: e.target.value } : x))} /></div>
                <div className="flex items-end gap-3">
                  <div><Label>Urutan</Label><Input type="number" className="w-20" value={t.sort_order} onChange={(e) => setThemes((arr) => arr.map((x) => x.key === t.key ? { ...x, sort_order: Number(e.target.value) } : x))} /></div>
                  <div className="flex items-center gap-1.5"><Switch checked={t.is_active} onCheckedChange={(v) => setThemes((arr) => arr.map((x) => x.key === t.key ? { ...x, is_active: v } : x))} /><Label className="text-xs">Aktif</Label></div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => saveTheme(t)}><Save className="h-3.5 w-3.5 mr-1" />Simpan</Button>
                <Button size="sm" variant="destructive" onClick={() => deleteTheme(t.key)}><Trash2 className="h-3.5 w-3.5 mr-1" />Hapus</Button>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
