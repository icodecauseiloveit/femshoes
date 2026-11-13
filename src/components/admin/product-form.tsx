"use client";

import { useState } from "react";
import { refreshCatalog } from "@/app/actions";
import { allSizes } from "@/lib/config";
import { useAdminCategories } from "./use-categories";
import { slugify } from "@/lib/format";
import { getSupabase, PRODUCT_IMAGES_BUCKET } from "@/lib/supabase";
import {
  CODE_PATTERN,
  newVariantId,
  normalizeCode,
  skuOf,
  toRow,
  uniqueCode,
  variantStock,
  type Product,
  type ProductInput,
  type ProductVariant,
} from "@/lib/types";
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
  sharedImages: [],
  featured: false,
  isNew: true,
  active: true,
};

export function ProductForm({ product, demo, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ProductInput>(() => {
    if (!product) return blank;
    const { id: _id, colors: _c, sizes: _s, images: _i, ...rest } = product;
    const used: string[] = rest.variants.map((v) => v.code ?? "").filter(Boolean);
    const variants = rest.variants.map((v) => {
      // Colores sin código (guardados antes de los códigos): se sugiere uno
      const code = v.code || uniqueCode(v.color, used);
      if (!v.code) used.push(code);
      return { ...v, code, images: [...v.images], sizes: v.sizes.map((x) => ({ ...x })) };
    });
    return { ...rest, variants, sharedImages: [...rest.sharedImages] };
  });
  const { categories } = useAdminCategories();
  // Códigos de color ya guardados: no se pueden cambiar
  const [lockedCodes] = useState(() => new Map((product?.variants ?? []).filter((v) => v.code).map((v) => [v.id, v.code!])));
  const categoryCode = categories.find((c) => c.slug === form.category)?.code;
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

  /** Sube fotos a un color o, con target "shared", a las fotos generales del modelo. */
  async function upload(target: string, files: FileList | null) {
    if (!files?.length) return;
    const supabase = getSupabase();
    if (!supabase || demo) {
      setError("Conecta Supabase para subir fotos.");
      return;
    }
    const variant = form.variants.find((v) => v.id === target);
    setUploading(target);
    setError("");
    const urls: string[] = [];
    const sub = target === "shared" ? "general" : slugify(variant?.color ?? "") || target;
    const folder = `${form.slug || slugify(form.name) || "producto"}/${sub}`;
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
    if (target === "shared") setForm((f) => ({ ...f, sharedImages: [...f.sharedImages, ...urls] }));
    else updateVariant(target, (v) => ({ images: [...v.images, ...urls] }));
    setUploading(null);
  }

  /** Pasa una foto de un color a las generales del modelo, o al revés. */
  function moveImageTo(src: string, from: string, to: string) {
    setForm((f) => {
      const variants = f.variants.map((v) => {
        let images = v.images;
        if (v.id === from) images = images.filter((x) => x !== src);
        if (v.id === to && !images.includes(src)) images = [...images, src];
        return images === v.images ? v : { ...v, images };
      });
      let sharedImages = f.sharedImages;
      if (from === "shared") sharedImages = sharedImages.filter((x) => x !== src);
      if (to === "shared" && !sharedImages.includes(src)) sharedImages = [...sharedImages, src];
      return { ...f, variants, sharedImages };
    });
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
    const badCode = variants.find((v) => !lockedCodes.has(v.id) && !CODE_PATTERN.test(v.code ?? ""));
    if (badCode) return setError(`El código del color ${badCode.color} debe tener de 2 a 4 letras o números.`);
    const codes = variants.map((v) => lockedCodes.get(v.id) ?? v.code);
    const dupCode = codes.find((c, i) => codes.indexOf(c) !== i);
    if (dupCode) return setError(`Hay dos colores con el código ${dupCode}. Cambia uno de ellos.`);
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

      <div className="flex items-center justify-between gap-3 border border-line bg-white px-3 py-2">
        <span className="text-xs text-ink-soft">Código del modelo</span>
        {product?.code ? (
          <span className="font-mono text-sm font-medium tracking-wider" data-testid="product-code">{product.code}</span>
        ) : (
          <span className="text-right text-xs text-muted">
            <span className="font-mono text-sm tracking-wider text-ink-soft">{categoryCode ?? "???"}-####</span>
            <br />
            El número se asigna al guardar
          </span>
        )}
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
            locked={lockedCodes.has(v.id)}
            productCode={product?.code ?? `${categoryCode ?? "???"}-####`}
            onChange={(patch) => updateVariant(v.id, patch)}
            onUpload={(files) => upload(v.id, files)}
            onMoveTo={(src, to) => moveImageTo(src, v.id, to)}
            onMove={(dir) => moveVariant(i, dir)}
            onRemove={() => set("variants", form.variants.filter((x) => x.id !== v.id))}
          />
        ))}
        <button
          type="button"
          onClick={() => set("variants", [...form.variants, { ...blankVariant("#d9b9a0"), code: "" }])}
          className="btn w-full border border-dashed border-ink/40 bg-white text-ink-soft"
        >
          + Agregar otro color
        </button>
      </Section>

      <Section title="Fotos generales del modelo">
        <p className="text-xs text-muted">
          Se muestran con todos los colores, después de las fotos del color elegido: por ejemplo la suela, el tacón, la caja o
          fotos puestas. Si un color no tiene fotos propias, su portada es la primera de aquí.
        </p>
        <PhotoGrid
          images={form.sharedImages}
          uploading={uploading === "shared"}
          onChange={(sharedImages) => set("sharedImages", sharedImages)}
          onUpload={(files) => upload("shared", files)}
          moveTargets={form.variants.map((v) => ({ id: v.id, label: v.color || "(sin nombre)" }))}
          onMoveTo={(src, to) => moveImageTo(src, "shared", to)}
          testId="shared-photos"
        />
      </Section>

      <Section title="Visibilidad">
        <Check label="Visible en la tienda" checked={form.active} onChange={(v) => set("active", v)} />
        <Check label="Destacado en la página de inicio" checked={form.featured} onChange={(v) => set("featured", v)} />
        <Check label="Marcar como nuevo" checked={form.isNew} onChange={(v) => set("isNew", v)} />
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-5xl">
          {error && <p className="mb-2 text-sm text-sale">{error}</p>}
          <button disabled={saving || Boolean(uploading)} className="btn w-full bg-ink text-white">
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
  locked: boolean; // el código ya se guardó y no cambia
  productCode: string;
  onChange: (patch: Partial<ProductVariant>) => void;
  onUpload: (files: FileList | null) => void;
  onMoveTo: (src: string, to: string) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
};

/** Bloque de un color: nombre y tono, fotos y tallas con existencias. */
function VariantEditor({ variant: v, index, total, others, uploading, locked, productCode, onChange, onUpload, onMoveTo, onMove, onRemove }: VariantEditorProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  // El código se sugiere a partir del nombre hasta que se escribe uno a mano
  const [codeTouched, setCodeTouched] = useState(Boolean(v.code));
  const usedCodes = others.map((o) => o.code ?? "").filter(Boolean);
  const exampleSize = v.sizes[0]?.size ?? "37";

  function setName(color: string) {
    if (locked || codeTouched) onChange({ color });
    else onChange({ color, code: color.trim() ? uniqueCode(color, usedCodes) : "" });
  }
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

  return (
    <div className="space-y-4 border border-line bg-white p-3" data-testid="variant">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={v.hex}
          onChange={(e) => onChange({ hex: e.target.value })}
          className="h-12 w-12 shrink-0 cursor-pointer border border-line-strong bg-white p-1"
          aria-label="Tono del color"
        />
        <input
          placeholder={`Nombre del color ${index + 1} (ej.: Negro)`}
          value={v.color}
          onChange={(e) => setName(e.target.value)}
          className="field"
          aria-label={`Nombre del color ${index + 1}`}
        />
        <input
          value={v.code ?? ""}
          readOnly={locked}
          onChange={(e) => {
            setCodeTouched(true);
            onChange({ code: normalizeCode(e.target.value) });
          }}
          placeholder="COD"
          maxLength={4}
          title={locked ? "El código ya se guardó y no cambia" : "Código del color (2 a 4 letras o números)"}
          aria-label={`Código del color ${index + 1}`}
          className={`field w-20 shrink-0 px-2 text-center font-mono uppercase tracking-wider ${locked ? "bg-mist text-ink-soft" : ""}`}
        />
      </div>
      <p className="-mt-2 text-xs text-muted">
        Código de un par: <span className="font-mono text-ink-soft">{skuOf(productCode, v.code || "???", exampleSize)}</span>
        {locked && " · fijo"}
      </p>
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
        <PhotoGrid
          images={v.images}
          uploading={uploading}
          onChange={(images) => onChange({ images })}
          onUpload={onUpload}
          moveTargets={[{ id: "shared", label: "Fotos generales" }, ...others.map((o) => ({ id: o.id, label: o.color || "(sin nombre)" }))]}
          onMoveTo={(src, to) => onMoveTo(src, to)}
          coverLabel="Portada"
        />
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
              className="max-w-[55%] border border-line-strong bg-white px-2 py-1 text-xs"
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
                    className="mt-1 w-full border border-line-strong py-1 text-center"
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

/** Cuadrícula de fotos: ordenar, quitar, pasar a otro grupo y subir nuevas. */
function PhotoGrid({
  images,
  uploading,
  onChange,
  onUpload,
  moveTargets,
  onMoveTo,
  coverLabel,
  testId,
}: {
  images: string[];
  uploading: boolean;
  onChange: (images: string[]) => void;
  onUpload: (files: FileList | null) => void;
  moveTargets: { id: string; label: string }[];
  onMoveTo: (src: string, to: string) => void;
  coverLabel?: string;
  testId?: string;
}) {
  function move(i: number, dir: -1 | 1) {
    const imgs = [...images];
    const j = i + dir;
    if (j < 0 || j >= imgs.length) return;
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    onChange(imgs);
  }
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" data-testid={testId}>
      {images.map((src, i) => (
        <div key={src} className="relative">
          <ProductImage src={src} alt="" sizes="120px" />
          {i === 0 && coverLabel && <span className="eyebrow absolute left-1 top-1 bg-white px-1 text-[0.55rem]">{coverLabel}</span>}
          <div className="mt-1 flex justify-between text-xs">
            <button type="button" onClick={() => move(i, -1)} className="px-1" aria-label="Mover foto a la izquierda">←</button>
            <button type="button" onClick={() => onChange(images.filter((x) => x !== src))} className="text-sale">Quitar</button>
            <button type="button" onClick={() => move(i, 1)} className="px-1" aria-label="Mover foto a la derecha">→</button>
          </div>
          {moveTargets.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && onMoveTo(src, e.target.value)}
              aria-label={`Pasar foto ${i + 1} a otro grupo`}
              className="mt-1 w-full border border-line-strong bg-white px-1 py-1 text-[0.7rem] text-ink-soft"
            >
              <option value="">Pasar a…</option>
              {moveTargets.map((t) => (
                <option key={t.id} value={t.id}>{t.id === "shared" ? t.label : `Color ${t.label}`}</option>
              ))}
            </select>
          )}
        </div>
      ))}
      <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center border border-dashed border-ink/30 text-center text-xs text-muted">
        {uploading ? "Subiendo…" : <>+ Agregar<br />fotos</>}
        <input type="file" accept="image/*" multiple hidden onChange={(e) => onUpload(e.target.files)} />
      </label>
    </div>
  );
}
