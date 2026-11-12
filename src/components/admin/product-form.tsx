"use client";

import { useState } from "react";
import { refreshCatalog } from "@/app/actions";
import { allSizes } from "@/lib/config";
import { useAdminCategories } from "./use-categories";
import { slugify } from "@/lib/format";
import { getSupabase, PRODUCT_IMAGES_BUCKET } from "@/lib/supabase";
import { newVariantId, toRow, variantStock, type Product, type ProductInput, type ProductVariant } from "@/lib/types";
import { ProductImage } from "../product-image";

type Props = {
  product: Product | null;
  demo?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const blankVariant = (hex = "#141210"): ProductVariant => ({ id: newVariantId(), color: "", hex, images: [], sizes: [] });

const blank: ProductInput = {
  slug: "",
  name: "",
  category: "",
  description: "",
  material: "",
  price: 0,
  compareAtPrice: null,
  variants: [blankVariant()],
  featured: false,
  isNew: true,
  active: true,
};

export function ProductForm({ product, demo, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ProductInput>(() => {
    if (!product) return blank;
    const { id: _id, colors: _c, sizes: _s, images: _i, ...rest } = product;
    return { ...rest, variants: rest.variants.map((v) => ({ ...v, images: [...v.images], sizes: v.sizes.map((x) => ({ ...x })) })) };
  });
  const { categories } = useAdminCategories();
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null); // id del color que está subiendo fotos
  const [error, setError] = useState("");

  function set<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateVariant(id: string, patch: Partial<ProductVariant> | ((v: ProductVariant) => Partial<ProductVariant>)) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) => (v.id === id ? { ...v, ...(typeof patch === "function" ? patch(v) : patch) } : v)),
    }));
  }

  function moveVariant(i: number, dir: -1 | 1) {
    const list = [...form.variants];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set("variants", list);
  }

  async function upload(variantId: string, files: FileList | null) {
    if (!files?.length) return;
    const supabase = getSupabase();
    if (!supabase || demo) {
      setError("Conecta Supabase para subir fotos.");
      return;
    }
    const variant = form.variants.find((v) => v.id === variantId);
    setUploading(variantId);
    setError("");
    const urls: string[] = [];
    const folder = `${form.slug || slugify(form.name) || "producto"}/${slugify(variant?.color ?? "") || variantId}`;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
      });
      if (error) {
        setError(`Error subiendo ${file.name}: ${error.message}`);
        continue;
      }
      urls.push(supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl);
    }
    updateVariant(variantId, (v) => ({ images: [...v.images, ...urls] }));
    setUploading(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const variants = form.variants.map((v) => ({ ...v, color: v.color.trim() }));
    const data: ProductInput = {
      ...form,
      slug: form.slug || slugify(form.name),
      variants,
      compareAtPrice: form.compareAtPrice && form.compareAtPrice > form.price ? form.compareAtPrice : null,
    };
    if (variants.length === 0) return setError("Agrega al menos un color.");
    const unnamed = variants.findIndex((v) => !v.color);
    if (unnamed >= 0) return setError(`Escribe el nombre del color ${unnamed + 1}.`);
    const names = variants.map((v) => slugify(v.color));
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) return setError(`Hay dos colores con el mismo nombre (${variants[names.indexOf(dup)].color}).`);
    const noSizes = variants.find((v) => v.sizes.length === 0);
    if (noSizes) return setError(`Agrega al menos una talla al color ${noSizes.color}.`);
    if (demo) return setError("Modo de ejemplo: conecta Supabase para guardar cambios.");

    const supabase = getSupabase()!;
    setSaving(true);
    const row = toRow(data);
    const { error } = product
      ? await supabase.from("products").update(row).eq("id", product.id)
      : await supabase.from("products").insert(row);
    setSaving(false);
    if (error) {
      setError(error.code === "23505" ? "Ya existe un producto con ese enlace (slug)." : error.message);
      return;
    }
    await refreshCatalog();
    onSaved();
  }

  return (
    <form onSubmit={save} className="space-y-6 pb-28">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onClose} className="text-sm text-ink-soft">← Volver</button>
        <h1 className="text-2xl">{product ? "Editar producto" : "Nuevo producto"}</h1>
        <span className="w-12" />
      </div>

      <Section title="Información">
        <Label text="Nombre">
          <input
            required
            value={form.name}
            onChange={(e) => {
              set("name", e.target.value);
              if (!slugTouched) set("slug", slugify(e.target.value));
            }}
            className="field"
          />
        </Label>
        <Label text="Enlace (slug)" hint={`/producto/${form.slug || "…"}`}>
          <input
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", slugify(e.target.value));
            }}
            className="field"
          />
        </Label>
        <Label text="Categoría">
          <select required value={form.category} onChange={(e) => set("category", e.target.value)} className="field">
            <option value="" disabled>Elige una categoría</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}{c.active ? "" : " (oculta)"}</option>
            ))}
          </select>
        </Label>
        <Label text="Descripción">
          <textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} className="field" />
        </Label>
        <Label text="Materiales y detalles">
          <input value={form.material} onChange={(e) => set("material", e.target.value)} className="field" placeholder="Cuero · Suela antideslizante" />
        </Label>
      </Section>

      <Section title="Precio (COP)">
        <div className="grid grid-cols-2 gap-3">
          <Label text="Precio">
            <input required type="number" inputMode="numeric" min={0} step={100} value={form.price || ""} onChange={(e) => set("price", Number(e.target.value))} className="field" />
          </Label>
          <Label text="Precio antes (opcional)" hint="Para mostrar descuento">
            <input type="number" inputMode="numeric" min={0} step={100} value={form.compareAtPrice ?? ""} onChange={(e) => set("compareAtPrice", e.target.value ? Number(e.target.value) : null)} className="field" />
          </Label>
        </div>
      </Section>

      <Section title="Colores, fotos y tallas">
        <p className="text-xs text-muted">
          Cada color tiene sus propias fotos y sus pares por talla. El primer color es el que se muestra primero en la tienda.
        </p>
        {form.variants.map((v, i) => (
          <VariantEditor
            key={v.id}
            variant={v}
            index={i}
            total={form.variants.length}
            others={form.variants.filter((x) => x.id !== v.id)}
            uploading={uploading === v.id}
            onChange={(patch) => updateVariant(v.id, patch)}
            onUpload={(files) => upload(v.id, files)}
            onMove={(dir) => moveVariant(i, dir)}
            onRemove={() => set("variants", form.variants.filter((x) => x.id !== v.id))}
          />
        ))}
        <button
          type="button"
          onClick={() => set("variants", [...form.variants, blankVariant("#d9b9a0")])}
          className="btn w-full border border-dashed border-ink/40 bg-white text-ink-soft"
        >
          + Agregar otro color
        </button>
      </Section>

      <Section title="Visibilidad">
        <Check label="Visible en la tienda" checked={form.active} onChange={(v) => set("active", v)} />
        <Check label="Destacado en la página de inicio" checked={form.featured} onChange={(v) => set("featured", v)} />
        <Check label="Marcar como nuevo" checked={form.isNew} onChange={(v) => set("isNew", v)} />
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-5xl">
          {error && <p className="mb-2 text-sm text-sale">{error}</p>}
          <button disabled={saving || Boolean(uploading)} className="btn w-full bg-ink text-ivory">
            {saving ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-line pt-5">
      <legend className="eyebrow pr-2">{title}</legend>
      {children}
    </fieldset>
  );
}

function Label({ text, hint, children }: { text: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs text-ink-soft">
        {text}
        {hint && <span className="text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-ink" />
      {label}
    </label>
  );
}

type VariantEditorProps = {
  variant: ProductVariant;
  index: number;
  total: number;
  others: ProductVariant[];
  uploading: boolean;
  onChange: (patch: Partial<ProductVariant>) => void;
  onUpload: (files: FileList | null) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
};

/** Bloque de un color: nombre y tono, fotos y tallas con existencias. */
function VariantEditor({ variant: v, index, total, others, uploading, onChange, onUpload, onMove, onRemove }: VariantEditorProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const stockFor = (size: number) => v.sizes.find((s) => s.size === size)?.stock ?? 0;
  const pairs = variantStock(v);

  function setStock(size: number, stock: number) {
    const others = v.sizes.filter((s) => s.size !== size);
    onChange({ sizes: [...others, { size, stock: Math.max(0, Math.floor(stock) || 0) }].sort((a, b) => a.size - b.size) });
  }

  function toggleSize(size: number) {
    if (v.sizes.some((s) => s.size === size)) onChange({ sizes: v.sizes.filter((s) => s.size !== size) });
    else setStock(size, 1);
  }

  function moveImage(i: number, dir: -1 | 1) {
    const imgs = [...v.images];
    const j = i + dir;
    if (j < 0 || j >= imgs.length) return;
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    onChange({ images: imgs });
  }

  return (
    <div className="space-y-4 border border-line bg-white p-3" data-testid="variant">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={v.hex}
          onChange={(e) => onChange({ hex: e.target.value })}
          className="h-12 w-12 shrink-0 cursor-pointer border border-line bg-white p-1"
          aria-label="Tono del color"
        />
        <input
          placeholder={`Nombre del color ${index + 1} (ej.: Negro)`}
          value={v.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="field"
          aria-label={`Nombre del color ${index + 1}`}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {index === 0 ? "Color principal · " : ""}
          {pairs} {pairs === 1 ? "par" : "pares"}
        </span>
        <span className="flex items-center gap-3">
          {total > 1 && (
            <>
              <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="disabled:opacity-30" aria-label="Subir color">↑</button>
              <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="disabled:opacity-30" aria-label="Bajar color">↓</button>
              {confirmRemove ? (
                <>
                  <button type="button" onClick={onRemove} className="font-medium text-sale">Sí, quitar</button>
                  <button type="button" onClick={() => setConfirmRemove(false)}>No</button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmRemove(true)} className="text-sale">Quitar color</button>
              )}
            </>
          )}
        </span>
      </div>

      <div>
        <p className="mb-2 text-xs text-ink-soft">Fotos de este color</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {v.images.map((src, i) => (
            <div key={src} className="relative">
              <ProductImage src={src} alt="" sizes="120px" />
              {i === 0 && <span className="eyebrow absolute left-1 top-1 bg-white px-1 text-[0.55rem]">Portada</span>}
              <div className="mt-1 flex justify-between text-xs">
                <button type="button" onClick={() => moveImage(i, -1)} className="px-1" aria-label="Mover foto a la izquierda">←</button>
                <button type="button" onClick={() => onChange({ images: v.images.filter((x) => x !== src) })} className="text-sale">Quitar</button>
                <button type="button" onClick={() => moveImage(i, 1)} className="px-1" aria-label="Mover foto a la derecha">→</button>
              </div>
            </div>
          ))}
          <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center border border-dashed border-ink/30 text-center text-xs text-muted">
            {uploading ? "Subiendo…" : <>+ Agregar<br />fotos</>}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => onUpload(e.target.files)} />
          </label>
        </div>
        <p className="mt-1 text-xs text-muted">Fotos verticales 4:5 (ej.: 1200×1500 px). La primera es la portada de este color.</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs text-ink-soft">Tallas y pares disponibles</p>
          {others.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const src = others.find((o) => o.id === e.target.value);
                if (src) onChange({ sizes: src.sizes.map((s) => ({ ...s })) });
              }}
              className="max-w-[55%] border border-line bg-white px-2 py-1 text-xs"
              aria-label="Copiar tallas de otro color"
            >
              <option value="">Copiar tallas de…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>{o.color || "(sin nombre)"}</option>
              ))}
            </select>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {allSizes.map((size) => {
            const on = v.sizes.some((s) => s.size === size);
            return (
              <div key={size} className={`border p-2 text-center ${on ? "border-ink" : "border-line"}`}>
                <button type="button" onClick={() => toggleSize(size)} className={`w-full text-sm ${on ? "font-medium" : "text-muted"}`}>
                  {size}
                </button>
                {on && (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={stockFor(size)}
                    onChange={(e) => setStock(size, Number(e.target.value))}
                    className="mt-1 w-full border border-line py-1 text-center"
                    aria-label={`Pares ${v.color || `color ${index + 1}`} talla ${size}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
