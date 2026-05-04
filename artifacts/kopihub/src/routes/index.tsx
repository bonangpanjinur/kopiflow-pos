import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Coffee,
  Zap,
  Layers,
  Users,
  Truck,
  BarChart3,
  Check,
  ShoppingBag,
  Smartphone,
  Star,
  ArrowRight,
} from "lucide-react";

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
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Coffee className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">KopiHub</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#fitur" className="hover:text-foreground">Fitur</a>
            <a href="#harga" className="hover:text-foreground">Harga</a>
            <a href="#testi" className="hover:text-foreground">Testimoni</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Masuk</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Mulai gratis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:pt-24 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Live di puluhan coffeeshop di Indonesia
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Jualan kopi makin gampang.
              <br />
              <span className="text-primary">Online & offline, satu app.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              POS super cepat, etalase online dengan link sendiri, kurir milik toko, QRIS,
              loyalty, dan laporan harian — tanpa biaya transaksi.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup">
                <Button size="lg" className="h-12 w-full px-7 text-base sm:w-auto">
                  Daftarkan toko Anda <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="h-12 w-full px-7 text-base sm:w-auto">
                  Saya sudah punya akun
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Gratis selamanya untuk 1 outlet · Tanpa kartu kredit
            </p>
          </div>

          {/* Mock POS preview */}
          <div className="mx-auto mt-14 max-w-5xl">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                <span className="ml-3 truncate text-xs text-muted-foreground">kopihub.app/app/pos</span>
              </div>
              <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-12">
                <div className="md:col-span-8">
                  <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                    {["Espresso", "Manual Brew", "Non-Coffee", "Pastry"].map((c, i) => (
                      <span
                        key={c}
                        className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
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
                    {["Espresso", "Americano", "Latte", "Cappuccino", "Flat White", "Mochaccino"].map(
                      (m) => (
                        <div
                          key={m}
                          className="aspect-square rounded-lg border border-border bg-background p-3 text-left"
                        >
                          <div className="text-sm font-medium">{m}</div>
                          <div className="mt-auto text-xs text-muted-foreground">Rp 28.000</div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background p-3 md:col-span-4">
                  <div className="mb-2 flex gap-1.5 overflow-x-auto">
                    <span className="whitespace-nowrap rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                      Meja 5
                    </span>
                    <span className="whitespace-nowrap rounded-md bg-secondary px-2 py-1 text-xs">
                      Meja 1
                    </span>
                    <span className="whitespace-nowrap rounded-md bg-secondary px-2 py-1 text-xs">
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
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-12 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Fitur</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Semua kebutuhan coffeeshop, satu dashboard.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Dirancang bersama barista dan owner. Bukan sekadar kasir — ini pusat operasi toko Anda.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={Zap}
            title="POS super cepat"
            desc="1 klik = tambah ke cart. Shortcut F2/F3, modifier per-item, diskon manual, multi-cart antar device."
          />
          <Feature
            icon={ShoppingBag}
            title="Etalase online sendiri"
            desc="Link toko Anda: kopihub.app/s/nama-toko. Pelanggan order pickup atau delivery, bayar QRIS atau cash."
          />
          <Feature
            icon={Truck}
            title="Kurir milik toko"
            desc="Kelola kurir sendiri tanpa komisi. Ongkir flat atau per-zona, navigasi via Google Maps."
          />
          <Feature
            icon={Layers}
            title="Open bill & multi-outlet"
            desc="Pegang banyak meja sekaligus. Sync realtime antar device. Satu akun, banyak outlet."
          />
          <Feature
            icon={Users}
            title="Staff & jadwal"
            desc="Undang kasir/barista, atur shift mingguan, absensi clock-in dari HP. Role-based access."
          />
          <Feature
            icon={BarChart3}
            title="Loyalty & promo"
            desc="Sistem poin tukar diskon, kode promo (%/Rp), batas pemakaian, tracking redemption otomatis."
          />
        </div>
      </section>

      {/* Pricing */}
      <section id="harga" className="border-y border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Harga</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Sederhana. Tanpa komisi transaksi.
            </h2>
            <p className="mt-3 text-muted-foreground">Mulai gratis, upgrade kapan saja.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-7">
              <h3 className="text-lg font-semibold">Starter</h3>
              <p className="mt-1 text-sm text-muted-foreground">Untuk toko baru.</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold">Rp 0</span>
                <span className="text-sm text-muted-foreground">/bulan</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm">
                {[
                  "1 outlet, unlimited transaksi",
                  "POS + etalase online",
                  "QRIS statis (tanpa biaya)",
                  "1 kurir, 2 staff",
                  "Laporan harian",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/signup" className="mt-7 block">
                <Button variant="outline" className="w-full">Mulai gratis</Button>
              </Link>
            </div>

            <div className="relative rounded-2xl border-2 border-primary bg-card p-7 shadow-xl shadow-primary/10">
              <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                Populer
              </span>
              <h3 className="text-lg font-semibold">Pro</h3>
              <p className="mt-1 text-sm text-muted-foreground">Untuk toko yang berkembang.</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold">Rp 99rb</span>
                <span className="text-sm text-muted-foreground">/outlet/bulan</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm">
                {[
                  "Multi-outlet, multi-device",
                  "Staff & kurir unlimited",
                  "Loyalty + promo lengkap",
                  "Inventory & resep otomatis",
                  "Export CSV & analitik",
                  "Prioritas support WhatsApp",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/signup" className="mt-7 block">
                <Button className="w-full">Mulai uji coba 14 hari</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testi" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-12 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Testimoni</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Dipakai owner yang ngerti pahit-manisnya.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              name: "Rizky",
              shop: "Kedai Senja, Bandung",
              text: "Sebelum pakai KopiHub, kasir sering antri saat rush hour. Sekarang multi-cart bikin satu barista bisa handle 3 meja sekaligus.",
            },
            {
              name: "Maya",
              shop: "Kopi Tetap Tenang, Jakarta",
              text: "Yang paling membantu itu etalase online + kurir sendiri. Tidak perlu bayar komisi 20% lagi ke aplikasi orange.",
            },
            {
              name: "Bagas",
              shop: "Sebrangan Coffee, Yogya",
              text: "Setting QRIS-nya gampang banget. Pelanggan upload bukti, tinggal klik konfirmasi. Loyalty poin bikin pelanggan rajin balik.",
            },
          ].map((t) => (
            <div key={t.name} className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-3 flex gap-0.5 text-warning">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-foreground">"{t.text}"</p>
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.shop}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-10 text-primary-foreground shadow-2xl sm:p-14">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Siap modernisasi toko Anda?
              </h2>
              <p className="mt-3 text-primary-foreground/80">
                Buat akun, atur menu, share link toko ke pelanggan. Semua dalam 10 menit.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup">
                  <Button size="lg" variant="secondary" className="h-12 w-full px-7 sm:w-auto">
                    Mulai gratis sekarang
                  </Button>
                </Link>
                <a href="https://wa.me/6281234567890" target="_blank" rel="noreferrer">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-full border-primary-foreground/30 bg-transparent px-7 text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto"
                  >
                    Tanya via WhatsApp
                  </Button>
                </a>
              </div>
            </div>
            <div className="hidden justify-end md:flex">
              <Smartphone className="h-32 w-32 text-primary-foreground/30" />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Coffee className="h-3.5 w-3.5" />
            <span>© 2026 KopiHub · Dibuat untuk barista Indonesia ☕</span>
          </div>
          <div className="flex gap-4">
            <a href="mailto:hello@kopihub.app" className="hover:text-foreground">hello@kopihub.app</a>
            <a href="https://wa.me/6281234567890" target="_blank" rel="noreferrer" className="hover:text-foreground">WhatsApp</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
