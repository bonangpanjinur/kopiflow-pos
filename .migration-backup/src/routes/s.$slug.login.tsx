import { createFileRoute, useParams, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/s/$slug/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "",
  }),
  component: ShopLogin,
});

function ShopLogin() {
  const { slug } = useParams({ from: "/s/$slug/login" });
  const { redirect } = useSearch({ from: "/s/$slug/login" });
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      navigate({ to: redirect || `/s/${slug}`, replace: true });
    }
  }, [user, navigate, redirect, slug]);

  async function handleEmail() {
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name },
          },
        });
        if (error) throw error;
        toast.success("Akun dibuat. Cek email untuk verifikasi.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + `/s/${slug}` + (redirect ? `?r=${encodeURIComponent(redirect)}` : ""),
      });
      if (result.error) {
        toast.error("Gagal masuk dengan Google");
        return;
      }
      if (result.redirected) return;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 py-4">
      <Link
        to="/s/$slug"
        params={{ slug }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>
      <h1 className="text-xl font-semibold">{mode === "login" ? "Masuk" : "Daftar"}</h1>
      <p className="text-sm text-muted-foreground">
        {mode === "login" ? "Masuk untuk melacak pesanan Anda." : "Buat akun untuk pesan online."}
      </p>

      <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
        Lanjutkan dengan Google
      </Button>

      <div className="relative my-2 text-center text-xs text-muted-foreground">
        <span className="bg-background px-2">atau</span>
        <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-border" />
      </div>

      {mode === "signup" && (
        <div className="space-y-1">
          <Label className="text-xs">Nama</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Password</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      <Button className="w-full" onClick={handleEmail} disabled={busy}>
        {busy ? "..." : mode === "login" ? "Masuk" : "Daftar"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {mode === "login" ? (
          <>
            Belum punya akun?{" "}
            <button className="font-medium text-primary" onClick={() => setMode("signup")}>
              Daftar
            </button>
          </>
        ) : (
          <>
            Sudah punya akun?{" "}
            <button className="font-medium text-primary" onClick={() => setMode("login")}>
              Masuk
            </button>
          </>
        )}
      </p>
    </div>
  );
}
