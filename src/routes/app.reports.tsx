import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Loader2, Download, TrendingUp, Receipt, Coins, ShoppingBag, FileSpreadsheet } from "lucide-react";
import { downloadXLSX } from "@/lib/export";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
});

type Range = "today" | "7d" | "30d" | "month";

type Order = {
  id: string;
  business_date: string;
  created_at: string;
  total: number;
  subtotal: number;
  payment_method: string;
  cashier_id: string;
  status: string;
};
type OrderItem = {
  order_id: string;
  menu_item_id: string | null;
  name: string;
  quantity: number;
  subtotal: number;
};
type Cat = { id: string; name: string };
type Menu = { id: string; name: string; category_id: string | null };

const RANGE_LABELS: Record<Range, string> = {
  today: "Hari ini",
  "7d": "7 hari",
  "30d": "30 hari",
  month: "Bulan ini",
};

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, 200 70% 50%))", "hsl(var(--chart-3, 30 80% 55%))", "hsl(var(--chart-4, 280 60% 60%))", "hsl(var(--muted-foreground))"];

function rangeStart(r: Range): Date {
  const now = new Date();
  const d = new Date(now);
  if (r === "today") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (r === "7d") {
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (r === "30d") {
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // month
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function fmtDateISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function ReportsPage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [range, setRange] = useState<Range>("today");
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [cashierNames, setCashierNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!shop) return;
    setLoading(true);
    const start = rangeStart(range);
    const startDate = fmtDateISO(start);

    const [ordRes, mRes, cRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, business_date, created_at, total, subtotal, payment_method, cashier_id, status")
        .eq("shop_id", shop.id)
        .eq("status", "completed")
        .gte("business_date", startDate)
        .order("created_at", { ascending: false }),
      supabase.from("menu_items").select("id, name, category_id").eq("shop_id", shop.id),
      supabase.from("categories").select("id, name").eq("shop_id", shop.id),
    ]);

    const ords = (ordRes.data ?? []) as Order[];
    setOrders(ords);
    setMenus((mRes.data ?? []) as Menu[]);
    setCats((cRes.data ?? []) as Cat[]);

    if (ords.length > 0) {
      const oids = ords.map((o) => o.id);
      const { data: it } = await supabase
        .from("order_items")
        .select("order_id, menu_item_id, name, quantity, subtotal")
        .in("order_id", oids);
      setItems((it ?? []) as OrderItem[]);

      const cashierIds = [...new Set(ords.map((o) => o.cashier_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", cashierIds);
      setCashierNames(new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "—"])));
    } else {
      setItems([]);
      setCashierNames(new Map());
    }
    setLoading(false);
  }

  useEffect(() => {
    if (shop) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id, range]);

  const summary = useMemo(() => {
    const total = orders.reduce((s, o) => s + Number(o.total), 0);
    const count = orders.length;
    const aov = count > 0 ? total / count : 0;
    const itemsCount = items.reduce((s, i) => s + i.quantity, 0);
    return { total, count, aov, itemsCount };
  }, [orders, items]);

  const dailySales = useMemo(() => {
    const map = new Map<string, { date: string; total: number; count: number }>();
    orders.forEach((o) => {
      const k = o.business_date;
      const cur = map.get(k) ?? { date: k, total: 0, count: 0 };
      cur.total += Number(o.total);
      cur.count += 1;
      map.set(k, cur);
    });
    return [...map.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) }));
  }, [orders]);

  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}`, count: 0, total: 0 }));
    orders.forEach((o) => {
      const h = new Date(o.created_at).getHours();
      buckets[h].count += 1;
      buckets[h].total += Number(o.total);
    });
    return buckets;
  }, [orders]);

  const byPayment = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => map.set(o.payment_method, (map.get(o.payment_method) ?? 0) + Number(o.total)));
    return [...map.entries()].map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, [orders]);

  const topMenus = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    items.forEach((it) => {
      const k = it.menu_item_id ?? it.name;
      const cur = map.get(k) ?? { name: it.name, qty: 0, total: 0 };
      cur.qty += it.quantity;
      cur.total += Number(it.subtotal);
      map.set(k, cur);
    });
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [items]);

  const byCategory = useMemo(() => {
    const menuToCat = new Map(menus.map((m) => [m.id, m.category_id]));
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    const map = new Map<string, number>();
    items.forEach((it) => {
      const cid = it.menu_item_id ? menuToCat.get(it.menu_item_id) ?? null : null;
      const label = cid ? catName.get(cid) ?? "—" : "Tanpa kategori";
      map.set(label, (map.get(label) ?? 0) + Number(it.subtotal));
    });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [items, menus, cats]);

  const byCashier = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    orders.forEach((o) => {
      const k = o.cashier_id;
      const cur = map.get(k) ?? { name: cashierNames.get(k) ?? "—", total: 0, count: 0 };
      cur.total += Number(o.total);
      cur.count += 1;
      map.set(k, cur);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [orders, cashierNames]);

  function getExportRows() {
    return orders.map((o) => ({
      Tanggal: o.business_date,
      Jam: new Date(o.created_at).toLocaleTimeString("id-ID"),
      "Order ID": o.id,
      Total: o.total,
      Bayar: o.payment_method.toUpperCase(),
      Kasir: cashierNames.get(o.cashier_id) ?? "",
    }));
  }

  function exportCSV() {
    const rows = getExportRows();
    const headers = ["Tanggal", "Jam", "Order ID", "Total", "Bayar", "Kasir"];
    const csv = [
      headers.join(","),
      ...rows.map((r) => [r.Tanggal, r.Jam, r["Order ID"], r.Total, r.Bayar, r.Kasir].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kopiflow-orders-${range}-${fmtDateISO(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportXLSX() {
    const rows = getExportRows();
    downloadXLSX(`kopiflow-orders-${range}-${fmtDateISO(new Date())}.xlsx`, rows);
  }

  if (shopLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan penjualan, menu favorit, jam ramai, dan kinerja kasir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {RANGE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV} disabled={orders.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" onClick={exportXLSX} disabled={orders.length === 0}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={Coins} label="Omzet" value={formatIDR(summary.total)} />
            <KpiCard icon={Receipt} label="Transaksi" value={String(summary.count)} />
            <KpiCard icon={TrendingUp} label="Rata-rata / order" value={formatIDR(summary.aov)} />
            <KpiCard icon={ShoppingBag} label="Item terjual" value={String(summary.itemsCount)} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <ChartCard title="Penjualan harian" className="lg:col-span-2">
              {dailySales.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={dailySales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : `${v/1000}rb`} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatIDR(v)} />
                    <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Metode pembayaran">
              {byPayment.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={byPayment} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(d) => d.name}>
                      {byPayment.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatIDR(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Jam ramai (jumlah transaksi)">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} labelFormatter={(l) => `Jam ${l}:00`} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Penjualan per kategori">
              {byCategory.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byCategory} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : `${v/1000}rb`} />
                    <YAxis type="category" dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" width={80} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatIDR(v)} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="10 menu terlaris">
              {topMenus.length === 0 ? (
                <Empty />
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Menu</th>
                      <th className="px-2 py-1.5 text-right">Qty</th>
                      <th className="px-2 py-1.5 text-right">Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topMenus.map((m, i) => (
                      <tr key={i}>
                        <td className="px-2 py-2 font-medium">{m.name}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{m.qty}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatIDR(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ChartCard>

            <ChartCard title="Kinerja kasir">
              {byCashier.length === 0 ? (
                <Empty />
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Kasir</th>
                      <th className="px-2 py-1.5 text-right">Order</th>
                      <th className="px-2 py-1.5 text-right">Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {byCashier.map((c, i) => (
                      <tr key={i}>
                        <td className="px-2 py-2 font-medium">{c.name}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{c.count}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatIDR(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <div className="mb-3 text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      Tidak ada data pada rentang ini
    </div>
  );
}
