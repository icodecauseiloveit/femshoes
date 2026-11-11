import Link from "next/link";
import { discountPercent, formatCOP } from "@/lib/format";
import { totalStock, type Product } from "@/lib/types";
import { ProductImage } from "./product-image";

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const off = discountPercent(product.price, product.compareAtPrice);
  const soldOut = totalStock(product) === 0;

  return (
    <Link href={`/producto/${product.slug}`} className="group block">
      <div className="relative">
        <ProductImage
          src={product.images[0]}
          alt={product.name}
          priority={priority}
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="transition duration-500 group-hover:opacity-90"
        />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {product.isNew && (
            <span className="eyebrow bg-ivory/90 px-2 py-1 text-[0.6rem]">Nuevo</span>
          )}
          {off > 0 && (
            <span className="eyebrow bg-sale px-2 py-1 text-[0.6rem] text-white">-{off}%</span>
          )}
        </div>
        {soldOut && (
          <span className="eyebrow absolute inset-x-0 bottom-0 bg-ink/80 py-2 text-center text-[0.6rem] text-white">
            Agotado
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1 px-0.5">
        <h3 className="font-sans text-[0.92rem] font-normal leading-snug tracking-normal">
          {product.name}
        </h3>
        <p className="flex items-baseline gap-2 text-sm">
          <span className={off > 0 ? "text-sale" : ""}>{formatCOP(product.price)}</span>
          {off > 0 && (
            <span className="text-xs text-muted line-through">
              {formatCOP(product.compareAtPrice!)}
            </span>
          )}
        </p>
        {product.colors.length > 0 && (
          <div className="flex gap-1.5 pt-1">
            {product.colors.map((c) => (
              <span
                key={c.name}
                title={c.name}
                className="size-3 rounded-full ring-1 ring-black/10"
                style={{ background: c.hex }}
              />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
