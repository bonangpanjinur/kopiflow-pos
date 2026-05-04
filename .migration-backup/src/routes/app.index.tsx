import { createFileRoute, Link } from "@tanstack/react-router";
import { LowStockDialog } from "@/components/inventory/low-stock-dialog";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import {
  Coins,
  Receipt,
  TrendingUp,
  ShoppingBag,
  ListOrdered,
  UtensilsCrossed,
  Package,
  Users,
  Loader2,
  ArrowRight,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import { formatIDR } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

type Order = { id: string; total: number; created_at: string };
type Item = { menu_item_id: string | null; name: string; quantity: number };
type DayStat = { date: string; label: string; total: number; count: number };

function Dashboard() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [loading, setLoading] = useState(true);
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [openBills, setOpenBills] = useState(0);
  const [topItems, setTopItems] = useState<{ name: string; qty: number }[]>([]);
  const [recent, setRecent] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<{ id: string; name: string; current_stock: number; unit: string }[]>([]);
  const [lowOpen, setLowOpen] = useState(false);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [trend, setTrend] = useState<DayStat[]>([]);

  useEffect(() => {
    if (!shop) return;
    (async () => {
      setLoading(true);
      const today = new Date();
      const todayISO = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

      const [ordRes, obRes, lowRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, total, created_at")
          .eq("shop_id", shop.id)
          .eq("status", "completed")
          .eq("business_date", todayISO)
          .order("created_at", { ascending: false }),
        supabase.from("open_bills").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
        supabase
          .from("ingredients")
          .select("id, name, current_stock, min_stock, unit")
          .eq("shop_id", shop.id)
          .eq("is_active", true),
      ]);

      const ords = (ordRes.data ?? []) as Order[];
      setTodayTotal(ords.reduce((s, o) => s + Number(o.total), 0));
      setTodayCount(ords.length);
      setRecent(ords.slice(0, 5));
      setOpenBills(obRes.count ?? 0);
      setLowStock(((lowRes.data ?? []) as Array<{ id: string; name: string; current_stock: number; min_stock: number; unit: string }>)
        .filter((i) => i.min_stock > 0 && i.current_stock <= i.min_stock)
        .slice(0, 5));

      if (ords.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("menu_item_id, name, quantity")
          .in("order_id", ords.map((o) => o.id));
        const map = new Map<string, { name: string; qty: number }>();
        (items as Item[] | null)?.forEach((it) => {
          const k = it.menu_item_id ?? it.name;
          const cur = map.get(k) ?? { name: it.name, qty: 0 };
          cur.qty += it.quantity;
          map.set(k, cur);
        });
        setTopItems([...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5));
      } else {
        setTopItems([]);
      }
      setLoading(false);
    })();
  }, [shop]);

  // Fetch trend data
  useEffect(() => {
    if (!shop) return;
    (async () => {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - trendDays);
      const fromISO = new Date(from.getTime() - from.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

      const { data } = await supabase
        .from("orders")
        .select("total, business_date")
        .eq("shop_id", shop.id)
        .eq("status", "completed")
        .gte("business_date", fromISO)
        .order("business_date");

      const byDate = new Map<string, { total: number; count: number }>();
      // Pre-fill all dates
      for (let d = 0; d < trendDays; d++) {
        const dt = new Date(from);
        dt.setDate(dt.getDate() + d + 1);
        const key = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        byDate.set(key, { total: 0, count: 0 });
      }
      (data ?? []).forEach((o: { total: number; business_date: string }) => {
        const cur = byDate.get(o.business_date) ?? { total: 0, count: 0 };
        cur.total += Number(o.total);
        cur.count += 1;
        byDate.set(o.business_date, cur);
      });
      const result: DayStat[] = [];
      byDate.forEach((v, k) => {
        const dt = new Date(k + "T00:00:00");
        result.push({
          date: k,
          label: dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
          total: v.total,
          count: v.count,
        });
      });
      result.sort((a, b) => a.date.localeCompare(b.date));
      setTrend(result);
    })();
  }, [shop, trendDays]);

  // Period comparison
  const comparison = useMemo(() => {
    if (trend.length === 0) return null;
    const half = Math.floor(trend.length / 2);
    const recent = trend.slice(half);
    const prev = trend.slice(0, half);
    const recentTotal = recent.reduce((s, d) => s + d.total, 0);
    const prevTotal = prev.reduce((s, d) => s + d.total, 0);
    const pct = prevTotal > 0 ? ((recentTotal - prevTotal) / prevTotal) * 100 : 0;
    return { recentTotal, prevTotal, pct };
  }, [trend]);

  if (shopLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const aov = todayCount > 0 ? todayTotal / todayCount : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ringkasan hari ini · {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Coins} label="Omzet hari ini" value={formatIDR(todayTotal)} />
        <Kpi icon={Receipt} label="Transaksi" value={String(todayCount)} />
        <Kpi icon={TrendingUp} label="Rata-rata / order" value={formatIDR(aov)} />
        <Kpi icon={ShoppingBag} label="Open bills" value={String(openBills)} />
      </div>

      {/* Sales Trend Chart */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Tren Penjualan</h3>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setTrendDays(7)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${trendDays === 7 ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground hover:bg-accent/80"}`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setTrendDays(30)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${trendDays === 30 ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground hover:bg-accent/80"}`}
            >
              30 Hari
            </button>
          </div>
        </div>
        {comparison && (
          <div className="mb-3 flex flex-wrap gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Paruh akhir:</span>{" "}
              <span className="font-semibold">{formatIDR(comparison.recentTotal)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Paruh awal:</span>{" "}
              <span className="font-semibold">{formatIDR(comparison.prevTotal)}</span>
            </div>
            <div>
              <span className={`font-semibold ${comparison.pct >= 0 ? "text-green-600" : "text-red-500"}`}>
                {comparison.pct >= 0 ? "↑" : "↓"} {Math.abs(comparison.pct).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={trendDays === 30 ? 4 : 0} />
              <YAxis tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : String(v)} tick={{ fontSize: 10 }} width={50} />
              <Tooltip formatter={(v: number) => formatIDR(v)} labelFormatter={(l) => `Tanggal: ${l}`} />
              <Bar dataKey="total" name="Omzet" fill="var(--color-primary, hsl(var(--primary)))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {shop && (
        <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Etalase publik aktif</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Bagikan link ke pelanggan untuk pesan online (pickup/delivery).
              </div>
              <code className="mt-1 inline-block max-w-full truncate rounded bg-background px-2 py-0.5 text-xs">
                {typeof window !== "undefined" ? window.location.origin : ""}/s/{shop.slug}
              </code>
            </div>
            <a
              href={`/s/${shop.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Buka etalase <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {lowStock.length > 0 && shop && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <div className="font-semibold text-sm">Bahan menipis</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {lowStock.map((l) => `${l.name} (${l.current_stock} ${l.unit})`).join(" · ")}
              </div>
            </div>
            <button onClick={() => setLowOpen(true)} className="text-sm font-medium text-primary hover:underline whitespace-nowrap">
              Lihat & Pesan →
            </button>
          </div>
        </div>
      )}
      {shop && <LowStockDialog open={lowOpen} onOpenChange={setLowOpen} shopId={shop.id} />}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Menu terlaris hari ini" linkTo="/app/reports" linkLabel="Lihat laporan">
          {topItems.length === 0 ? (
            <Empty text="Belum ada penjualan" />
          ) : (
            <ul className="divide-y divide-border">
              {topItems.map((t, i) => (
                <li key={i} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium">
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold">
                      {i + 1}
                    </span>
                    {t.name}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">{t.qty}× terjual</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Order terakhir" linkTo="/app/orders" linkLabel="Semua order">
          {recent.length === 0 ? (
            <Empty text="Belum ada transaksi hari ini" />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {new Date(o.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{formatIDR(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">PINTASAN</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Shortcut to="/app/pos" icon={ShoppingBag} label="Buka POS" />
          <Shortcut to="/app/menu" icon={UtensilsCrossed} label="Kelola Menu" />
          <Shortcut to="/app/inventory" icon={Package} label="Inventori" />
          <Shortcut to="/app/employees" icon={Users} label="Pegawai" />
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-pos">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

function Panel({ title, linkTo, linkLabel, children }: { title: string; linkTo: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Link to={linkTo} className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
          {linkLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {children}
    </div>
  );
}

function Shortcut({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium">{label}</span>
      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-24 items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ListOrdered className="h-4 w-4" /> {text}
      </div>
    </div>
  );
}
