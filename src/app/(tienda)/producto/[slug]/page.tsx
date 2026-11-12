import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddToCart } from "@/components/add-to-cart";
import { ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import { getCategories, getProductBySlug, getProducts } from "@/lib/catalog";
import { categoryLabel, store } from "@/lib/config";
import { discountPercent, formatCOP } from "@/lib/format";

export async function generateStaticParams() {
  const products = await getProducts();
  // Con Cache Components debe devolver al menos un parámetro
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: "producto" }];
}

export async function generateMetadata({ params }: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Producto no encontrado" };
  return {
    title: product.name,
    description: product.description,
    openGraph: { title: product.name, description: product.description },
  };
}

export default function ProductPage({ params }: PageProps<"/producto/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductView params={params} />
    </Suspense>
  );
}

async function ProductView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [all, categories] = await Promise.all([getProducts(), getCategories()]);
  const related = all.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  const fill = all.filter((p) => p.category !== product.category && p.id !== product.id);
  const suggestions = [...related, ...fill].slice(0, 4);
  const off = discountPercent(product.price, product.compareAtPrice);

  return (
    <div className="mx-auto max-w-6xl pb-16 md:pb-0">
      <div className="md:grid md:grid-cols-[1.1fr_1fr] md:gap-10 md:px-5 md:pt-8">
        <ProductGallery images={product.images} name={product.name} />

        <div className="px-5 pt-5 md:px-0 md:pt-0">
          <nav className="eyebrow flex gap-2 text-[0.6rem] text-muted">
            <Link href="/tienda">Tienda</Link>/
            <Link href={`/tienda?categoria=${product.category}`}>{categoryLabel(product.category, categories)}</Link>
          </nav>
          <h1 className="mt-2 text-4xl leading-tight md:text-5xl">{product.name}</h1>
          <p className="mt-2 flex items-baseline gap-3 text-lg">
            <span className={off ? "text-sale" : ""}>{formatCOP(product.price)}</span>
            {off > 0 && (
              <>
                <span className="text-sm text-muted line-through">{formatCOP(product.compareAtPrice!)}</span>
                <span className="eyebrow bg-sale px-2 py-0.5 text-[0.6rem] text-white">-{off}%</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-muted">Impuestos incluidos · Envío calculado por WhatsApp</p>

          <AddToCart product={product} />

          <div className="mt-8 divide-y divide-line border-y border-line">
            <Details title="Descripción" open>
              {product.description}
            </Details>
            {product.material && <Details title="Materiales">{product.material}</Details>}
            <Details title="Envíos y cambios">
              Despachamos a toda {store.country} en 1 a 3 días hábiles.
              {store.freeShippingFrom > 0 && ` Envío gratis en compras desde ${formatCOP(store.freeShippingFrom)}.`} Tienes
              15 días para cambios de talla, con el producto sin uso y en su empaque original.
            </Details>
          </div>
        </div>
      </div>

      {suggestions.length > 0 && (
        <section className="mt-16 px-5">
          <h2 className="text-3xl">También te puede gustar</h2>
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-5">
            {suggestions.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Details({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <span className="eyebrow">{title}</span>
        <span className="text-xl leading-none text-muted transition group-open:rotate-45">+</span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{children}</p>
    </details>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse md:grid md:grid-cols-[1.1fr_1fr] md:gap-10 md:px-5 md:pt-8">
      <div className="aspect-[4/5] bg-sand" />
      <div className="space-y-3 px-5 pt-5 md:px-0">
        <div className="h-3 w-24 bg-sand" />
        <div className="h-9 w-2/3 bg-sand" />
        <div className="h-5 w-28 bg-sand" />
      </div>
    </div>
  );
}
