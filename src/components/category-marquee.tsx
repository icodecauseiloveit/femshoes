import Link from "next/link";
import { ProductImage } from "./product-image";

type Item = { slug: string; label: string; image?: string };

/**
 * Banda de categorías que se desplaza sola hacia la izquierda, sin fin.
 * Se pausa al pasar el mouse o al enfocar un enlace con el teclado.
 * La lista se repite hasta llenar el ancho y luego se duplica: al llegar a la
 * mitad, la segunda copia ocupa exactamente el lugar de la primera.
 */
export function CategoryMarquee({ items }: { items: Item[] }) {
  if (items.length === 0) return null;
  const reps = Math.max(1, Math.ceil(10 / items.length));
  const half = Array.from({ length: reps }, () => items).flat();
  // ~4,5 s por tarjeta: lento y legible
  const duration = `${half.length * 4.5}s`;

  return (
    <div className="marquee mt-5 overflow-hidden pb-2" aria-label="Categorías">
      <div className="marquee-track flex w-max" style={{ animationDuration: duration }}>
        {[0, 1].map((copy) =>
          half.map((c, i) => {
            // Solo la primera aparición de cada categoría es navegable por teclado y lectores de pantalla
            const duplicate = copy === 1 || i >= items.length;
            return (
              <Link
                key={`${copy}-${i}`}
                href={`/tienda?categoria=${c.slug}`}
                aria-hidden={duplicate || undefined}
                tabIndex={duplicate ? -1 : undefined}
                className="group block w-40 shrink-0 pl-3 md:w-56 md:pl-4"
              >
                <ProductImage src={c.image} alt={duplicate ? "" : c.label} sizes="(min-width: 768px) 224px, 160px" className="transition group-hover:opacity-90" />
                <p className="mt-2 font-display text-xl">{c.label}</p>
              </Link>
            );
          }),
        )}
      </div>
    </div>
  );
}
