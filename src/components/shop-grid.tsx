"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { allSizes, categories, categoryLabel } from "@/lib/config";
import type { Product } from "@/lib/types";
import { CloseIcon } from "./icons";
import { ProductCard } from "./product-card";

const sorts = [
  { value: "destacados", label: "Destacados" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
] as const;

const quickFilters = [
  { value: "nuevos", label: "Nuevos" },
  { value: "ofertas", label: "Ofertas" },
];

export function ShopGrid({ products }: { products: Product[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const category = params.get("categoria") ?? "";
  const filter = params.get("filtro") ?? "";
  const size = Number(params.get("talla")) || 0;
  const sort = params.get("orden") ?? "destacados";

  function update(key: string, value: string) {
    updateMany({ [key]: value });
  }

  function updateMany(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const list = useMemo(() => {
    let r = products.filter((p) => {
      if (category && p.category !== category) return false;
      if (filter === "nuevos" && !p.isNew) return false;
      if (filter === "ofertas" && !(p.compareAtPrice && p.compareAtPrice > p.price)) return false;
      if (size && !p.sizes.some((s) => s.size === size && s.stock > 0)) return false;
      return true;
    });
    if (sort === "precio-asc") r = [...r].sort((a, b) => a.price - b.price);
    if (sort === "precio-desc") r = [...r].sort((a, b) => b.price - a.price);
    if (sort === "destacados") r = [...r].sort((a, b) => Number(b.featured) - Number(a.featured));
    return r;
  }, [products, category, filter, size, sort]);

  const title = category
    ? categoryLabel(category)
    : filter === "nuevos"
      ? "Novedades"
      : filter === "ofertas"
        ? "Ofertas"
        : "Toda la colección";
  const activeCount = (size ? 1 : 0) + (sort !== "destacados" ? 1 : 0);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="px-5 pb-4 pt-8">
        <h1 className="text-4xl md:text-5xl">{title}</h1>
        <p className="mt-1 text-sm text-muted">
          {list.length} {list.length === 1 ? "producto" : "productos"}
        </p>
      </div>

      {/* Chips de categoría (deslizables en móvil) */}
      <div className="sticky top-14 z-20 border-y border-line bg-ivory/95 backdrop-blur md:top-16">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3">
          <Chip active={!category && !filter} onClick={() => router.replace(pathname, { scroll: false })}>
            Todo
          </Chip>
          {categories.map((c) => (
            <Chip key={c.slug} active={category === c.slug} onClick={() => update("categoria", category === c.slug ? "" : c.slug)}>
              {c.label}
            </Chip>
          ))}
          {quickFilters.map((f) => (
            <Chip key={f.value} active={filter === f.value} onClick={() => update("filtro", filter === f.value ? "" : f.value)}>
              {f.label}
            </Chip>
          ))}
        </div>
        <div className="flex border-t border-line">
          <button onClick={() => setSheetOpen(true)} className="eyebrow flex-1 py-3 text-[0.65rem]">
            Filtrar y ordenar{activeCount > 0 && ` (${activeCount})`}
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="px-5 py-20 text-center">
          <p className="font-display text-2xl">No encontramos productos</p>
          <p className="mt-2 text-sm text-muted">Prueba con otra talla o categoría.</p>
          <button onClick={() => router.replace(pathname)} className="btn mt-6 border border-ink">
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 px-5 pt-5 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
          {list.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}

      {sheetOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Filtros">
          <button aria-label="Cerrar filtros" className="absolute inset-0 bg-ink/40" onClick={() => setSheetOpen(false)} />
          <div className="animate-fade-up absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-ivory pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-x-auto md:right-0 md:top-0 md:max-h-none md:w-96">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-2xl">Filtrar y ordenar</h2>
              <button onClick={() => setSheetOpen(false)} aria-label="Cerrar" className="-mr-2 p-2">
                <CloseIcon />
              </button>
            </div>
            <div className="space-y-7 px-5 py-6">
              <div>
                <p className="eyebrow mb-3">Talla disponible</p>
                <div className="grid grid-cols-4 gap-2">
                  {allSizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => update("talla", size === s ? "" : String(s))}
                      className={`h-11 border text-sm transition ${size === s ? "border-ink bg-ink text-ivory" : "border-line bg-white"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="eyebrow mb-3">Ordenar por</p>
                <div className="space-y-2">
                  {sorts.map((o) => (
                    <label key={o.value} className="flex cursor-pointer items-center gap-3 py-1 text-sm">
                      <input
                        type="radio"
                        name="orden"
                        checked={sort === o.value}
                        onChange={() => update("orden", o.value === "destacados" ? "" : o.value)}
                        className="size-4 accent-ink"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 border-t border-line px-5 pt-4">
              <button
                onClick={() => updateMany({ talla: "", orden: "" })}
                className="btn flex-1 border border-ink"
              >
                Limpiar
              </button>
              <button onClick={() => setSheetOpen(false)} className="btn flex-1 bg-ink text-ivory">
                Ver {list.length}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-[0.8rem] transition ${
        active ? "border-ink bg-ink text-ivory" : "border-line bg-white text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}
