"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { store, type Category } from "@/lib/config";
import { formatCOP } from "@/lib/format";
import { useCart } from "./cart-provider";
import { BagIcon, ChevronIcon, CloseIcon, MenuIcon } from "./icons";

export function Header({ categories }: { categories: Category[] }) {
  const { count, open, ready } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Cerrar el menú al navegar
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);

  return (
    <>
      <div className="eyebrow bg-ink py-2 text-center text-[0.62rem] text-ivory">
        {store.freeShippingFrom > 0
          ? `Envío gratis desde ${formatCOP(store.freeShippingFrom)} · Toda Colombia`
          : `Envíos a toda ${store.country}`}
      </div>
      <header className="sticky top-0 z-40 border-b border-line bg-ivory/95 backdrop-blur">
        <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 md:h-16">
          <div className="flex items-center">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              className="-ml-2 p-2 md:hidden"
            >
              <MenuIcon />
            </button>
            <nav className="hidden gap-6 md:flex">
              <Link href="/tienda" className="eyebrow hover:text-gold">Tienda</Link>
              {categories.slice(0, 3).map((c) => (
                <Link key={c.slug} href={`/tienda?categoria=${c.slug}`} className="eyebrow hover:text-gold">
                  {c.label}
                </Link>
              ))}
            </nav>
          </div>

          <Link href="/" className="font-display text-[1.65rem] leading-none tracking-[0.08em] md:text-3xl">
            {store.name.toUpperCase()}
          </Link>

          <div className="flex justify-end">
            <button onClick={open} aria-label="Abrir carrito" className="relative -mr-2 p-2">
              <BagIcon />
              {ready && count > 0 && (
                <span className="absolute right-0.5 top-0.5 flex size-[18px] items-center justify-center rounded-full bg-ink text-[0.6rem] text-ivory">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="animate-slide-in-left absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-ivory">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <span className="font-display text-2xl tracking-[0.08em]">{store.name.toUpperCase()}</span>
              <button onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" className="-mr-2 p-2">
                <CloseIcon />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-4 py-2">
              <MenuLink href="/tienda" label="Ver todo" />
              {categories.map((c) => (
                <MenuLink key={c.slug} href={`/tienda?categoria=${c.slug}`} label={c.label} />
              ))}
              <MenuLink href="/tienda?filtro=ofertas" label="Ofertas" accent />
              <MenuLink href="/guia-de-tallas" label="Guía de tallas" />
            </nav>
            <div className="border-t border-line p-4 text-sm text-muted">
              ¿Dudas? Escríbenos por WhatsApp
              <a
                href={`https://wa.me/${store.whatsapp}`}
                target="_blank"
                rel="noopener"
                className="mt-1 block text-ink underline underline-offset-4"
              >
                {store.whatsappDisplay}
              </a>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function MenuLink({ href, label, accent }: { href: string; label: string; accent?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between border-b border-line py-4 font-display text-2xl ${accent ? "text-sale" : ""}`}
    >
      {label}
      <ChevronIcon width={18} className="text-muted" />
    </Link>
  );
}
