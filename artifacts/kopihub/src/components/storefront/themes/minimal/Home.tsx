import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatIDR } from "@/lib/format";
import type { ThemeHomeProps } from "../types";

export default function MinimalHome({ shop, cats, filtered, activeCat, setActiveCat, q, setQ, status, onAdd, renderItemLink }: ThemeHomeProps) {
  return (
    <div className="space-y-8 font-serif">
      <header className="border-b border-foreground/20 pb-6">
        <h1 className="text-4xl font-bold tracking-tight">{shop.name}</h1>
        {shop.description && <p className="mt-2 text-sm text-muted-foreground">{shop.description}</p>}
        {status && <p className="mt-3 text-xs uppercase tracking-widest">{status.label}</p>}
      </header>

      <Input placeholder="Cari menu" value={q} onChange={(e) => setQ(e.target.value)} className="border-0 border-b rounded-none focus-visible:ring-0 px-0 text-lg" />

      <div className="flex gap-4 overflow-x-auto text-sm uppercase tracking-wide">
        <button onClick={() => setActiveCat("all")} className={activeCat === "all" ? "font-bold underline underline-offset-4" : "text-muted-foreground"}>Semua</button>
        {cats.map((c) => (
          <button key={c.id} onClick={() => setActiveCat(c.id)} className={activeCat === c.id ? "font-bold underline underline-offset-4" : "text-muted-foreground"}>{c.name}</button>
        ))}
      </div>

      <div className="divide-y divide-border">
        {filtered.map((i) => (
          <div key={i.id} className={`flex items-center justify-between py-4 ${!i.is_available ? "opacity-50" : ""}`}>
            <div className="min-w-0 flex-1">
              {renderItemLink(i, (
                <div>
                  <h3 className="text-lg font-semibold">{i.name}</h3>
                  {i.description && <p className="text-xs text-muted-foreground line-clamp-1">{i.description}</p>}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 pl-4">
              <span className="text-base font-medium">{formatIDR(Number(i.price))}</span>
              <Button size="sm" variant="outline" disabled={!i.is_available || (status ? !status.open : false)} onClick={() => onAdd(i)}>Tambah</Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Menu tidak ditemukan</p>}
      </div>
    </div>
  );
}