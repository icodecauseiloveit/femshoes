"use client";

import { useState } from "react";
import { refreshCatalog } from "@/app/actions";
import { allSizes, categories, type CategorySlug } from "@/lib/config";
import { slugify } from "@/lib/format";
import { getSupabase, PRODUCT_IMAGES_BUCKET } from "@/lib/supabase";
import { toRow, type Product, type ProductColor } from "@/lib/types";
import { ProductImage } from "../product-image";

type Props = {
  product: Product | null;
  demo?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const blank: Omit<Product, "id"> = {
  slug: "",
  name: "",
  category: "tacones",
  description: "",
  material: "",
  price: 0,
  compareAtPrice: null,
  colors: [{ name: "", hex: "#141210" }],
  sizes: [],
  images: [],
  featured: false,
  isNew: true,
  active: true,
};

export function ProductForm({ product, demo, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Omit<Product, "id">>(() => {
    if (!product) return blank;
    const { id: _id, ...rest } = product;
    return rest;
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function stockFor(size: number) {
    return form.sizes.find((s) => s.size === size)?.stock ?? 0;
  }

  function setStock(size: number, stock: number) {
    const others = form.sizes.filter((s) => s.size !== size);
    const next = stock > 0 || form.sizes.some((s) => s.size === size)
      ? [...others, { size, stock: Math.max(0, stock) }]
      : others;
    set("sizes", next.sort((a, b) => a.size - b.size));
  }

  function toggleSize(size: number) {
    if (form.sizes.some((s) => s.size === size)) set("sizes", form.sizes.filter((s) => s.size !== size));
    else setStock(size, 1);
  }

  function setColor(i: number, patch: Partial<ProductColor>) {
    set("colors", form.colors.map((c, n) => (n === i ? { ...c, ...patch } : c)));
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const supabase = getSupabase();
    if (!supabase || demo) {
      setError("Conecta Supabase para subir fotos.");
      return;
    }
    setUploading(true);
    setError("");
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${form.slug || slugify(form.name) || "producto"}/${crypto.randomUUID()}.${ext}`;
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
    set("images", [...form.images, ...urls]);
    setUploading(false);
  }

  function moveImage(i: number, dir: -1 | 1) {
    const imgs = [...form.images];
    const j = i + dir;
    if (j < 0 || j >= imgs.length) return;
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    set("images", imgs);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const data = {
      ...form,
      slug: form.slug || slugify(form.name),
      colors: form.colors.filter((c) => c.name.trim()),
      compareAtPrice: form.compareAtPrice && form.compareAtPrice > form.price ? form.compareAtPrice : null,
    };
    if (data.sizes.length === 0) return setError("Agrega al menos una talla.");
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
          <select value={form.category} onChange={(e) => set("category", e.target.value as CategorySlug)} className="field">
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
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

      <Section title="Fotos">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {form.images.map((src, i) => (
            <div key={src} className="relative">
              <ProductImage src={src} alt="" sizes="120px" />
              {i === 0 && <span className="eyebrow absolute left-1 top-1 bg-white px-1 text-[0.55rem]">Portada</span>}
              <div className="mt-1 flex justify-between text-xs">
                <button type="button" onClick={() => moveImage(i, -1)} className="px-1">←</button>
                <button type="button" onClick={() => set("images", form.images.filter((x) => x !== src))} className="text-sale">Quitar</button>
                <button type="button" onClick={() => moveImage(i, 1)} className="px-1">→</button>
              </div>
            </div>
          ))}
          <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center border border-dashed border-ink/30 text-center text-xs text-muted">
            {uploading ? "Subiendo…" : <>+ Agregar<br />fotos</>}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
          </label>
        </div>
        <p className="text-xs text-muted">Recomendado: fotos verticales 4:5 (por ejemplo 1200×1500 px). La primera es la portada.</p>
      </Section>

      <Section title="Tallas e inventario">
        <p className="text-xs text-muted">Toca una talla para activarla y escribe cuántos pares hay.</p>
        <div className="grid grid-cols-4 gap-2">
          {allSizes.map((size) => {
            const on = form.sizes.some((s) => s.size === size);
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
                    aria-label={`Stock talla ${size}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Colores">
        {form.colors.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="color" value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value })} className="h-12 w-12 shrink-0 cursor-pointer border border-line bg-white p-1" />
            <input placeholder="Nombre del color" value={c.name} onChange={(e) => setColor(i, { name: e.target.value })} className="field" />
            <button type="button" onClick={() => set("colors", form.colors.filter((_, n) => n !== i))} className="px-2 text-sale">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => set("colors", [...form.colors, { name: "", hex: "#d9b9a0" }])} className="text-sm underline underline-offset-4">
          + Agregar color
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
          <button disabled={saving || uploading} className="btn w-full bg-ink text-ivory">
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
