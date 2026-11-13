import Link from "next/link";
import { ArrowIcon, ReturnIcon, ShieldIcon, TruckIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { getCategories, getProducts } from "@/lib/catalog";
import { store } from "@/lib/config";
import { formatCOP } from "@/lib/format";

export default async function HomePage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const featured = products.filter((p) => p.featured).slice(0, 8);
  const newIn = products.filter((p) => p.isNew).slice(0, 8);
  const hero = featured[0] ?? products[0];

  return (
    <>
      {/* Portada */}
      <section className="relative overflow-hidden bg-mist">
        <div className="mx-auto grid max-w-6xl md:grid-cols-2 md:items-center">
          <div className="animate-fade-up order-2 px-5 pb-10 pt-6 md:order-1 md:py-20">
            <p className="eyebrow text-gold">Nueva colección</p>
            <h1 className="mt-3 text-[2.9rem] leading-[0.95] md:text-7xl">
              Pasos que <em className="italic">dejan huella</em>
            </h1>
            <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed text-ink-soft">
              Calzado femenino premium, diseñado para acompañarte con elegancia en cada momento.
            </p>
            <div className="mt-7 flex gap-3">
              <Link href="/tienda" className="btn flex-1 bg-ink text-ivory md:flex-none">
                Comprar ahora
              </Link>
              <Link href="/tienda?filtro=nuevos" className="btn flex-1 border border-ink md:flex-none">
                Novedades
              </Link>
            </div>
          </div>
          {hero && (
            <Link href={`/producto/${hero.slug}`} className="order-1 block md:order-2">
              <ProductImage src={hero.images[0]} alt={hero.name} priority sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[5/4] md:aspect-[4/5]" />
            </Link>
          )}
        </div>
      </section>

      {/* Categorías en carrusel horizontal */}
      <section className="mx-auto max-w-6xl pt-12">
        <div className="flex items-end justify-between px-5">
          <h2 className="text-3xl">Categorías</h2>
          <Link href="/tienda" className="eyebrow flex items-center gap-1 text-ink-soft">
            Ver todo <ArrowIcon width={14} />
          </Link>
        </div>
        <div className="no-scrollbar mt-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2">
          {categories.map((c) => {
            const sample = products.find((p) => p.category === c.slug);
            return (
              <Link
                key={c.slug}
                href={`/tienda?categoria=${c.slug}`}
                className="group w-[40%] shrink-0 snap-start md:w-[19%]"
              >
                <ProductImage src={sample?.images[0]} alt={c.label} sizes="40vw" className="transition group-hover:opacity-90" />
                <p className="mt-2 font-display text-xl">{c.label}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {featured.length > 0 && (
        <ProductRail title="Los favoritos" eyebrow="Selección FemShoes" products={featured} href="/tienda" />
      )}

      {/* Banner editorial */}
      <section className="mx-auto mt-14 max-w-6xl px-5">
        <div className="bg-ink px-6 py-12 text-center text-ivory md:py-16">
          <p className="eyebrow text-nude">Hecho para durar</p>
          <p className="mx-auto mt-4 max-w-md font-display text-3xl leading-tight md:text-4xl">
            Materiales nobles, hormas cómodas y acabados impecables.
          </p>
          <Link href="/tienda?filtro=ofertas" className="btn mt-7 border border-ivory/60 text-ivory hover:bg-ivory hover:text-ink">
            Ver ofertas
          </Link>
        </div>
      </section>

      {newIn.length > 0 && (
        <ProductRail title="Recién llegados" eyebrow="Novedades" products={newIn} href="/tienda?filtro=nuevos" />
      )}

      {/* Beneficios */}
      <section className="mx-auto mt-16 grid max-w-6xl gap-px bg-line md:grid-cols-3">
        <Benefit icon={<TruckIcon />} title="Envíos a toda Colombia" text={store.freeShippingFrom > 0 ? `Gratis desde ${formatCOP(store.freeShippingFrom)}` : "Rápidos y seguros"} />
        <Benefit icon={<ReturnIcon />} title="Cambios de talla" text="Tienes 15 días para cambiar tu talla" />
        <Benefit icon={<ShieldIcon />} title="Compra segura" text="Atención personalizada por WhatsApp" />
      </section>
    </>
  );
}

function ProductRail({
  title,
  eyebrow,
  products,
  href,
}: {
  title: string;
  eyebrow: string;
  products: Awaited<ReturnType<typeof getProducts>>;
  href: string;
}) {
  return (
    <section className="mx-auto mt-14 max-w-6xl">
      <div className="flex items-end justify-between px-5">
        <div>
          <p className="eyebrow text-gold">{eyebrow}</p>
          <h2 className="mt-1 text-3xl">{title}</h2>
        </div>
        <Link href={href} className="eyebrow flex items-center gap-1 text-ink-soft">
          Ver todo <ArrowIcon width={14} />
        </Link>
      </div>
      <div className="no-scrollbar mt-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible">
        {products.map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start md:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Benefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-center gap-4 bg-ivory px-5 py-5">
      <span className="text-gold">{icon}</span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted">{text}</p>
      </div>
    </div>
  );
}
