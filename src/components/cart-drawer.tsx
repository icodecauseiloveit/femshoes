"use client";

import Link from "next/link";
import { useEffect } from "react";
import { store } from "@/lib/config";
import { formatCOP } from "@/lib/format";
import { colorSlug } from "@/lib/types";
import { lineKey, useCart, type CartItem } from "./cart-provider";
import { CloseIcon, MinusIcon, PlusIcon } from "./icons";
import { ProductImage } from "./product-image";

export function CartDrawer() {
  const { items, isOpen, close, subtotal } = useCart();

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const missing = store.freeShippingFrom - subtotal;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Carrito">
      <button aria-label="Cerrar carrito" className="absolute inset-0 bg-ink/40" onClick={close} />
      <aside className="animate-slide-in absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white">
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <h2 className="text-2xl">Tu bolsa</h2>
          <button onClick={close} aria-label="Cerrar carrito" className="-mr-2 p-2">
            <CloseIcon />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
            <p className="font-display text-2xl">Tu bolsa está vacía</p>
            <p className="text-sm text-muted">Descubre nuestra colección y encuentra tu próximo par favorito.</p>
            <Link href="/tienda" onClick={close} className="btn bg-ink text-white">
              Ver colección
            </Link>
          </div>
        ) : (
          <>
            {store.freeShippingFrom > 0 && (
              <div className="border-b border-line px-4 py-3 text-center text-xs text-ink-soft">
                {missing > 0 ? (
                  <>Te faltan <strong className="font-medium">{formatCOP(missing)}</strong> para el envío gratis</>
                ) : (
                  <>¡Tu pedido tiene <strong className="font-medium">envío gratis</strong>!</>
                )}
                <div className="mt-2 h-0.5 bg-line">
                  <div
                    className="h-full bg-gold transition-all"
                    style={{ width: `${Math.min(100, (subtotal / store.freeShippingFrom) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-4">
              {items.map((item) => (
                <CartLine key={lineKey(item)} item={item} onNavigate={close} />
              ))}
            </ul>
            <div className="space-y-3 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex justify-between">
                <span className="text-sm text-ink-soft">Subtotal</span>
                <span className="font-medium">{formatCOP(subtotal)}</span>
              </div>
              <p className="text-xs text-muted">El costo de envío se confirma por WhatsApp.</p>
              <Link href="/carrito" onClick={close} className="btn w-full bg-ink text-white">
                Finalizar pedido
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function CartLine({ item, onNavigate }: { item: CartItem; onNavigate?: () => void }) {
  const { setQty, remove } = useCart();
  const key = lineKey(item);
  return (
    <li className="flex gap-4 py-4">
      <Link href={`/producto/${item.slug}${item.color ? `?color=${colorSlug(item.color)}` : ""}`} onClick={onNavigate} className="w-20 shrink-0">
        <ProductImage src={item.image} alt={item.name} sizes="80px" />
      </Link>
      <div className="flex flex-1 flex-col">
        <div className="flex justify-between gap-2">
          <p className="text-sm leading-snug">{item.name}</p>
          <p className="text-sm">{formatCOP(item.price * item.qty)}</p>
        </div>
        <p className="mt-1 text-xs text-muted">
          {item.color && `${item.color} · `}Talla {item.size}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center border border-line-strong">
            <button
              onClick={() => setQty(key, item.qty - 1)}
              aria-label="Restar uno"
              className="p-2"
            >
              <MinusIcon width={14} height={14} />
            </button>
            <span className="w-6 text-center text-sm">{item.qty}</span>
            <button
              onClick={() => setQty(key, item.qty + 1)}
              disabled={item.qty >= item.maxQty}
              aria-label="Sumar uno"
              className="p-2 disabled:opacity-30"
            >
              <PlusIcon width={14} height={14} />
            </button>
          </div>
          <button
            onClick={() => remove(key)}
            className="text-xs text-muted underline underline-offset-4"
          >
            Eliminar
          </button>
        </div>
      </div>
    </li>
  );
}
