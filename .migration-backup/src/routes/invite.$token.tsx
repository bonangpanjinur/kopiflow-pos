import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Loader2, Coffee, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  component: AcceptInvitationPage,
});

type Inv = {
  id: string;
  email: string;
  role: string;
  shop_id: string;
  expires_at: string;
};

function AcceptInvitationPage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [inv, setInv] = useState<Inv | null>(null);
  const [shopName, setShopName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("staff_invitations")
        .select("id, email, role, shop_id, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        setError("Undangan tidak ditemukan atau sudah kadaluarsa.");
      } else {
        setInv(data as Inv);
        const { data: s } = await supabase
          .from("businesses")
          .select("name")
          .eq("id", data.shop_id)
          .maybeSingle();
        setShopName(s?.name ?? "");
      }
      setLoading(false);
    })();
  }, [token]);

  async function accept() {
    if (!user || !inv) return;
    setAccepting(true);
    const { error } = await supabase.rpc("accept_staff_invitation", { _token: token });
    if (error) {
      const msg =
        error.message.includes("email_mismatch")
          ? "Email akun Anda tidak cocok dengan email undangan."
          : error.message.includes("invalid_or_expired")
          ? "Undangan tidak valid atau sudah kadaluarsa."
          : error.message;
      toast.error(msg);
      setError(msg);
    } else {
      toast.success(`Selamat bergabung di ${shopName}`);
      navigate({ to: "/app" });
    }
    setAccepting(false);
  }

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Coffee className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold">KopiHub</span>
        </div>

        {error || !inv ? (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">Undangan tidak valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {error ?? "Tautan undangan tidak ditemukan."}
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/">Kembali ke beranda</Link>
            </Button>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">Anda diundang ke {shopName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sebagai <span className="font-medium text-foreground">{inv.role}</span>. Undangan ini ditujukan untuk{" "}
              <span className="font-medium text-foreground">{inv.email}</span>.
            </p>

            {!user ? (
              <div className="mt-5 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Masuk atau daftar dengan email <strong>{inv.email}</strong> untuk menerima undangan.
                </p>
                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <Link to="/login" search={{ redirect: `/invite/${token}` } as never}>
                      Masuk
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to="/signup">Daftar</Link>
                  </Button>
                </div>
              </div>
            ) : user.email?.toLowerCase() !== inv.email.toLowerCase() ? (
              <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                Anda masuk sebagai <strong>{user.email}</strong>, namun undangan ini untuk{" "}
                <strong>{inv.email}</strong>. Silakan keluar lalu masuk dengan akun yang benar.
              </div>
            ) : (
              <Button onClick={accept} disabled={accepting} className="mt-5 w-full">
                {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Terima undangan
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
