import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Coffee, Zap, Layers, Users, Truck, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Coffee;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-pos transition hover:shadow-pos-lg">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Coffee className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">KopiHub</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Masuk
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Mulai gratis</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            POS-first · Dibangun untuk rush hour
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
            POS & marketplace
            <br />
            <span className="text-primary">untuk coffeeshop modern.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Multi-cart, open bill realtime, kurir milik toko, jadwal & absensi pegawai. Selesaikan
            order dalam 10 detik — dari satu dashboard.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="h-11 px-6">
                Daftarkan toko Anda
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="h-11 px-6">
                Saya sudah punya akun
              </Button>
            </Link>
          </div>
        </div>

        {/* Mock POS preview */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-pos-lg">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
              <span className="ml-3 text-xs text-muted-foreground">kopihub.app/app/pos</span>
            </div>
            <div className="grid grid-cols-12 gap-4 p-5">
              <div className="col-span-8">
                <div className="mb-3 flex gap-2">
                  {["Espresso", "Manual Brew", "Non-Coffee", "Pastry"].map((c, i) => (
                    <span
                      key={c}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                        i === 0
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    "Espresso",
                    "Americano",
                    "Latte",
                    "Cappuccino",
                    "Flat White",
                    "Mochaccino",
                  ].map((m) => (
                    <div
                      key={m}
                      className="aspect-square rounded-lg border border-border bg-background p-3 text-left"
                    >
                      <div className="text-sm font-medium">{m}</div>
                      <div className="mt-auto text-xs text-muted-foreground">Rp 28.000</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-4 rounded-lg border border-border bg-background p-3">
                <div className="mb-2 flex gap-1.5 overflow-x-auto">
                  <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground whitespace-nowrap">
                    Meja 5
                  </span>
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs whitespace-nowrap">
                    Meja 1
                  </span>
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs whitespace-nowrap">
                    Takeaway #3
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Latte ×2</span><span className="font-medium">56.000</span></div>
                  <div className="flex justify-between"><span>Croissant ×1</span><span className="font-medium">22.000</span></div>
                </div>
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total</span>
                    <span>Rp 78.000</span>
                  </div>
                  <button className="mt-3 h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground">
                    Bayar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Semua yang dibutuhkan coffeeshop, dalam satu app.
          </h2>
          <p className="mt-2 text-muted-foreground">
            Dirancang bersama barista, bukan accountant.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={Zap}
            title="POS super cepat"
            desc="1 klik = +1 ke cart. Order ulang < 10 detik. Shortcut keyboard lengkap."
          />
          <Feature
            icon={Layers}
            title="Multi-cart & Open Bill"
            desc="Pegang banyak meja sekaligus. Sync realtime antar device kasir."
          />
          <Feature
            icon={Truck}
            title="Kurir milik toko"
            desc="Kelola kurir sendiri. Ongkir flat atau per-zona, otomatis di struk."
          />
          <Feature
            icon={Users}
            title="Jadwal & absensi"
            desc="Drag-drop shift mingguan. Pegawai clock-in 1 tap dari aplikasi."
          />
          <Feature
            icon={Coffee}
            title="Marketplace publik"
            desc="Etalase toko Anda, pickup & delivery — bayar di tempat."
          />
          <Feature
            icon={BarChart3}
            title="Laporan jelas"
            desc="Penjualan, ongkir, jam kerja. Export CSV kapan saja."
          />
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Coffee className="h-3.5 w-3.5" />
            <span>© 2026 KopiHub</span>
          </div>
          <div>Dibuat untuk barista Indonesia ☕</div>
        </div>
      </footer>
    </div>
  );
}
