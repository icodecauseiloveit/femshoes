import Link from "next/link";
import { categories, store } from "@/lib/config";

export function Footer() {
  return (
    <footer className="mt-20 bg-ink text-ivory/80">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <p className="font-display text-3xl tracking-[0.08em] text-ivory">{store.name.toUpperCase()}</p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed">{store.description}</p>

        <div className="mt-10 grid grid-cols-2 gap-8 text-sm md:grid-cols-3">
          <div>
            <p className="eyebrow mb-4 text-ivory">Comprar</p>
            <ul className="space-y-3">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/tienda?categoria=${c.slug}`} className="hover:text-ivory">{c.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-4 text-ivory">Ayuda</p>
            <ul className="space-y-3">
              <li><Link href="/guia-de-tallas" className="hover:text-ivory">Guía de tallas</Link></li>
              <li><Link href="/envios-y-cambios" className="hover:text-ivory">Envíos y cambios</Link></li>
              <li>
                <a href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noopener" className="hover:text-ivory">
                  WhatsApp {store.whatsappDisplay}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-4 text-ivory">Pagos</p>
            <ul className="space-y-3">
              {store.paymentMethods.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-12 border-t border-ivory/15 pt-6 text-xs text-ivory/50">
          © {store.name} · Envíos a toda {store.country}
        </p>
      </div>
    </footer>
  );
}
