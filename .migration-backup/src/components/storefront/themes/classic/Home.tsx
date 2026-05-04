import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, MapPin, Phone, MessageCircle } from "lucide-react";
import { formatIDR } from "@/lib/format";
import type { ThemeHomeProps } from "../types";

export default function ClassicHome({ shop, cats, filtered, activeCat, setActiveCat, q, setQ, status, onAdd, renderItemLink }: ThemeHomeProps) {
  const waLink = shop.whatsapp ? `https://wa.me/${shop.whatsapp.replace(/[^0-9]/g, "")}` : null;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        {status && (
          <div className="mb-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.open ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.open ? "bg-emerald-500" : "bg-red-500"}`} />
              {status.label}
            </span>
          </div>
        )}
        {shop.description && <p className="text-sm text-muted-foreground">{shop.description}</p>}
        <div className="mt-2 grid gap-1.5 text-xs text-muted-foreground">
          {shop.address && <p className="flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {shop.address}</p>}
          {shop.phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" /> {shop.phone}</p>}
        </div>
        {waLink && (
          <a href={waLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
            <MessageCircle className="h-3.5 w-3.5" /> Chat WhatsApp
          </a>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Cari menu…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <div className="sticky top-14 z-10 -mx-4 bg-background/95 px-4 py-1 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setActiveCat("all")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${activeCat === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Semua</button>
          {cats.map((c) => (
            <button key={c.id} onClick={() => setActiveCat(c.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${activeCat === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{c.name}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((i) => {
          const unavailable = !i.is_available;
          return (
            <div key={i.id} className={`flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm ${unavailable ? "opacity-60" : ""}`}>
              {renderItemLink(i, (
                <div className="block h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {i.image_url ? <img src={i.image_url} alt={i.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Tidak ada foto</div>}
                </div>
              ))}
              <div className="flex min-w-0 flex-1 flex-col">
                {renderItemLink(i, (
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-semibold">{i.name}</h3>
                      {unavailable && <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800">Habis</span>}
                    </div>
                    {i.description && <p className="line-clamp-2 text-xs text-muted-foreground">{i.description}</p>}
                  </div>
                ))}
                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold">{formatIDR(Number(i.price))}</span>
                  <Button size="sm" className="h-7 gap-1 px-2" disabled={unavailable || (status ? !status.open : false)} onClick={() => onAdd(i)}>
                    <Plus className="h-3.5 w-3.5" /> Tambah
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Menu tidak ditemukan</p>}
      </div>

      {status && !status.open && (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground">Toko sedang tutup. Anda masih bisa lihat menu, tapi pemesanan online dinonaktifkan sementara.</p>
      )}
    </div>
  );
}