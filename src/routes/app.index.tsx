import { createFileRoute } from "@tanstack/react-router";
import { Coffee, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selamat datang di KopiHub. Fondasi siap, saatnya bangun yang lainnya.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Penjualan hari ini", value: "Rp 0" },
          { label: "Order hari ini", value: "0" },
          { label: "Open bills", value: "0" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-pos">
            <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-bold tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">Toko Anda siap!</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          Berikutnya: tambah menu, undang pegawai, lalu mulai terima order. Modul-modul akan dibuka
          satu per satu.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
          <Coffee className="h-3 w-3" /> Fase 1 selesai · Fase 2: Menu Management
        </div>
      </div>
    </div>
  );
}
