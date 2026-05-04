import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Megaphone, Loader2, Clock, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/broadcast")({ component: AdminBroadcast });

function AdminBroadcast() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("info");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; title: string; body: string; severity: string; created_at: string }>>([]);

  const loadHistory = async () => {
    const { data } = await supabase.from("owner_notifications").select("id, title, body, severity, created_at").is("shop_id", null).order("created_at", { ascending: false }).limit(50);
    setHistory((data ?? []) as Array<{ id: string; title: string; body: string; severity: string; created_at: string }>);
  };

  useEffect(() => { loadHistory(); }, []);

  const send = async () => {
    if (!title.trim()) { toast.error("Judul wajib diisi"); return; }
    setSending(true);
    try {
      // Get target shops based on audience
      let shopQuery = supabase.from("coffee_shops").select("id");
      if (audience !== "all") {
        shopQuery = shopQuery.eq("plan", audience);
      }
      const { data: shops } = await shopQuery;
      if (!shops || shops.length === 0) { toast.error("Tidak ada toko ditemukan"); setSending(false); return; }

      const notifications = shops.map((s) => ({
        shop_id: s.id,
        type: "broadcast",
        title: title.trim(),
        body: body.trim(),
        severity,
        link: link.trim() || null,
        dedupe_key: `broadcast_${Date.now()}`,
      }));

      const { error } = await supabase.from("owner_notifications").insert(notifications);
      if (error) throw error;

      // Log to system_audit
      await supabase.from("system_audit").insert({
        event_type: "broadcast_sent",
        actor_id: user?.id,
        payload: { audience, title: title.trim(), recipient_count: shops.length },
      });

      toast.success(`Broadcast terkirim ke ${shops.length} toko`);
      setTitle(""); setBody(""); setLink("");
      loadHistory();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="flex items-center gap-2 mb-6">
        <Megaphone className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Broadcast ke Owner</h1>
      </div>

      <Card className="p-5 space-y-4 mb-8">
        <div><Label>Judul</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pengumuman penting..." /></div>
        <div><Label>Isi Pesan</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Tulis pesan broadcast..." /></div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Audiens</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Toko</SelectItem>
                <SelectItem value="free">Plan Free</SelectItem>
                <SelectItem value="pro">Plan Pro</SelectItem>
                <SelectItem value="pro_plus">Plan Pro Plus</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Link (opsional)</Label><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/app/billing" /></div>
        </div>
        <Button onClick={send} disabled={sending} className="w-full">
          {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
          Kirim Broadcast
        </Button>
      </Card>

      <h2 className="font-semibold mb-3">Riwayat Broadcast</h2>
      <div className="space-y-2">
        {history.length === 0 && <p className="text-sm text-muted-foreground">Belum ada broadcast.</p>}
        {history.map((h) => (
          <Card key={h.id} className="p-3 flex items-start gap-3">
            {h.severity === "error" ? <Clock className="h-4 w-4 text-destructive mt-0.5 shrink-0" /> : <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{h.title}</p>
              {h.body && <p className="text-xs text-muted-foreground line-clamp-2">{h.body}</p>}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{new Date(h.created_at).toLocaleDateString("id-ID")}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
