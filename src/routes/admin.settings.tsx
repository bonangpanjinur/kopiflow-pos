import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

type Settings = { bank_name: string | null; account_no: string | null; account_name: string | null; instructions: string | null; qris_image_url: string | null };

function AdminSettings() {
  const [s, setS] = useState<Settings>({ bank_name: "", account_no: "", account_name: "", instructions: "", qris_image_url: "" });
  useEffect(() => {
    supabase.from("billing_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => { if (data) setS(data as Settings); });
  }, []);
  const save = async () => {
    const { error } = await supabase.from("billing_settings").update({ ...s, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(error.message); else toast.success("Tersimpan");
  };
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <h1 className="text-2xl font-bold mb-4">Pengaturan Pembayaran</h1>
      <Card className="p-5 space-y-3">
        <div><Label>Nama Bank</Label><Input value={s.bank_name ?? ""} onChange={(e) => setS({ ...s, bank_name: e.target.value })} /></div>
        <div><Label>No. Rekening</Label><Input value={s.account_no ?? ""} onChange={(e) => setS({ ...s, account_no: e.target.value })} /></div>
        <div><Label>Atas Nama</Label><Input value={s.account_name ?? ""} onChange={(e) => setS({ ...s, account_name: e.target.value })} /></div>
        <div><Label>URL QRIS (opsional)</Label><Input value={s.qris_image_url ?? ""} onChange={(e) => setS({ ...s, qris_image_url: e.target.value })} /></div>
        <div><Label>Instruksi Pembayaran</Label><Textarea rows={4} value={s.instructions ?? ""} onChange={(e) => setS({ ...s, instructions: e.target.value })} /></div>
        <Button onClick={save}>Simpan</Button>
      </Card>
    </div>
  );
}
