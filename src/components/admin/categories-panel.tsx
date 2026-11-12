"use client";

import { useEffect, useState } from "react";
import { refreshCatalog } from "@/app/actions";
import type { Category } from "@/lib/config";
import { slugify } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { CODE_PATTERN, normalizeCode, uniqueCode } from "@/lib/types";
import { useAdminCategories } from "./use-categories";

export function CategoriesPanel() {
  const supabase = getSupabase();
  const { categories, loading, error: loadError, reload } = useAdminCategories();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newCode, setNewCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const usedCodes = categories.map((c) => c.code ?? "").filter(Boolean);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("products")
      .select("category")
      .then(({ data }) => {
        const c: Record<string, number> = {};
        for (const r of data ?? []) c[r.category] = (c[r.category] ?? 0) + 1;
        setCounts(c);
      });
  }, [supabase, categories]);

  async function done(message: string) {
    await refreshCatalog();
    await reload();
    setError("");
    setNotice(message);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const label = newLabel.trim();
    const slug = slugify(label);
    if (!label || !slug) return setError("Escribe un nombre válido.");
    if (categories.some((c) => c.slug === slug)) return setError(`Ya existe una categoría "${label}".`);
    const code = newCode || uniqueCode(label, usedCodes);
    if (!CODE_PATTERN.test(code)) return setError("El código debe tener de 2 a 4 letras o números.");
    if (usedCodes.includes(code)) return setError(`El código ${code} ya lo usa otra categoría.`);
    setBusy(true);
    const sortOrder = Math.max(0, ...categories.map((c) => c.sortOrder)) + 1;
    const { error } = await supabase.from("categories").insert({ slug, label, code, sort_order: sortOrder });
    setBusy(false);
    if (error) return setError(error.code === "23505" ? `El código ${code} ya lo usa otra categoría.` : error.message);
    setNewLabel("");
    setNewCode("");
    setCodeTouched(false);
    done(`Se creó la categoría "${label}".`);
  }

  async function rename(c: Category, label: string) {
    if (!supabase || !label.trim() || label.trim() === c.label) return;
    const { error } = await supabase.from("categories").update({ label: label.trim() }).eq("slug", c.slug);
    if (error) return setError(error.message);
    done(`"${c.label}" ahora se llama "${label.trim()}".`);
  }

  async function changeCode(c: Category, value: string) {
    if (!supabase) return;
    const code = normalizeCode(value);
    if (code === c.code) return;
    if (!CODE_PATTERN.test(code)) return setError("El código debe tener de 2 a 4 letras o números.");
    const { error } = await supabase.from("categories").update({ code }).eq("slug", c.slug);
    if (error) return setError(error.code === "23505" ? `El código ${code} ya lo usa otra categoría.` : error.message);
    done(`El código de "${c.label}" ahora es ${code}. Aplica a los productos nuevos; los existentes conservan el suyo.`);
  }

  async function move(index: number, dir: -1 | 1) {
    if (!supabase) return;
    const j = index + dir;
    if (j < 0 || j >= categories.length) return;
    const list = [...categories];
    [list[index], list[j]] = [list[j], list[index]];
    setBusy(true);
    const results = await Promise.all(
      list.map((c, i) => supabase.from("categories").update({ sort_order: i + 1 }).eq("slug", c.slug)),
    );
    setBusy(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) return setError(failed.error.message);
    done("Orden actualizado.");
  }

  async function toggle(c: Category) {
    if (!supabase) return;
    const { error } = await supabase.from("categories").update({ active: !c.active }).eq("slug", c.slug);
    if (error) return setError(error.message);
    done(c.active ? `"${c.label}" quedó oculta en la tienda.` : `"${c.label}" vuelve a mostrarse en la tienda.`);
  }

  async function remove(c: Category) {
    if (!supabase) return;
    if ((counts[c.slug] ?? 0) > 0) {
      return setError(`No se puede eliminar "${c.label}" porque tiene productos. Muévelos a otra categoría u oculta la categoría.`);
    }
    if (!confirm(`¿Eliminar la categoría "${c.label}"?`)) return;
    const { error } = await supabase.from("categories").delete().eq("slug", c.slug);
    if (error) {
      return setError(
        error.code === "23503" ? `No se puede eliminar "${c.label}" porque tiene productos.` : error.message,
      );
    }
    done(`Se eliminó la categoría "${c.label}".`);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl">
        Categorías <span className="text-lg text-muted">({categories.length})</span>
      </h1>

      {!supabase && (
        <p className="border border-gold/40 bg-sand p-3 text-sm">Modo de ejemplo: conecta Supabase para editar las categorías.</p>
      )}

      <form onSubmit={add} className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => {
            setNewLabel(e.target.value);
            if (!codeTouched) setNewCode(e.target.value.trim() ? uniqueCode(e.target.value, usedCodes) : "");
          }}
          placeholder="Nueva categoría (ej.: Mocasines)"
          className="field"
          disabled={!supabase}
        />
        <input
          value={newCode}
          onChange={(e) => {
            setCodeTouched(true);
            setNewCode(normalizeCode(e.target.value));
          }}
          placeholder="COD"
          maxLength={4}
          aria-label="Código de la nueva categoría"
          title="Código para los productos (2 a 4 letras o números)"
          className="field w-20 shrink-0 px-2 text-center font-mono uppercase tracking-wider"
          disabled={!supabase}
        />
        <button disabled={!supabase || busy || !newLabel.trim()} className="btn min-h-12 shrink-0 bg-ink px-4 text-ivory">
          Agregar
        </button>
      </form>

      {notice && <p className="border border-gold/40 bg-sand p-3 text-sm">{notice}</p>}
      {(error || loadError) && (
        <p className="border border-sale/40 bg-sale/5 p-3 text-sm text-sale">{error || loadError}</p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando categorías…</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {categories.map((c, i) => (
            <li key={c.slug} className={`flex flex-wrap items-center gap-2 py-3 ${c.active ? "" : "opacity-60"}`}>
              <div className="flex flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label={`Subir ${c.label}`} className="px-2 text-xs disabled:opacity-20">▲</button>
                <button type="button" onClick={() => move(i, 1)} disabled={busy || i === categories.length - 1} aria-label={`Bajar ${c.label}`} className="px-2 text-xs disabled:opacity-20">▼</button>
              </div>
              <div className="min-w-0 flex-1">
                <input
                  defaultValue={c.label}
                  key={c.label}
                  disabled={!supabase}
                  onBlur={(e) => rename(c, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  aria-label={`Nombre de ${c.label}`}
                  className="w-full border border-transparent bg-transparent px-1 py-1 text-sm font-medium hover:border-line focus:border-ink focus:bg-white focus:outline-none"
                />
                <p className="px-1 text-xs text-muted">
                  /tienda?categoria={c.slug} · {counts[c.slug] ?? 0} {(counts[c.slug] ?? 0) === 1 ? "producto" : "productos"}
                  {!c.active && " · Oculta"}
                </p>
              </div>
              <input
                defaultValue={c.code ?? ""}
                key={c.code}
                disabled={!supabase}
                maxLength={4}
                onChange={(e) => (e.target.value = normalizeCode(e.target.value))}
                onBlur={(e) => changeCode(c, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                aria-label={`Código de ${c.label}`}
                title="Código de la categoría para los productos nuevos"
                className="w-16 border border-line bg-white px-1 py-1 text-center font-mono text-xs uppercase tracking-wider focus:border-ink focus:outline-none"
              />
              <button type="button" onClick={() => toggle(c)} disabled={!supabase} className="text-xs text-ink-soft underline underline-offset-4">
                {c.active ? "Ocultar" : "Mostrar"}
              </button>
              <button type="button" onClick={() => remove(c)} disabled={!supabase} className="text-xs text-sale underline underline-offset-4">
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        Toca un nombre para renombrarlo. El orden de esta lista es el orden en que aparecen en la tienda. El enlace de cada categoría no cambia al renombrarla.
        El código (ej.: TAC) es el inicio del código de los productos nuevos de esa categoría; los productos que ya existen conservan el suyo.
      </p>
    </div>
  );
}
