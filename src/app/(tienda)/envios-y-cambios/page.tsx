import type { Metadata } from "next";
import { store } from "@/lib/config";
import { formatCOP } from "@/lib/format";

export const metadata: Metadata = { title: "Envíos y cambios" };

export default function ShippingPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="eyebrow text-gold">Ayuda</p>
      <h1 className="mt-2 text-4xl">Envíos y cambios</h1>
      <div className="mt-6 space-y-6 text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="mb-2 text-2xl text-ink">Cómo comprar</h2>
          <p>
            Agrega tus productos a la bolsa, completa tus datos y envía el pedido por WhatsApp. Te confirmamos
            disponibilidad, costo de envío y datos de pago ({store.paymentMethods.join(", ")}).
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-2xl text-ink">Envíos</h2>
          <p>
            Despachamos a toda {store.country} en 1 a 3 días hábiles después de confirmar el pago. El tiempo de
            entrega depende de la ciudad de destino.
            {store.freeShippingFrom > 0 && ` El envío es gratis en compras desde ${formatCOP(store.freeShippingFrom)}.`}
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-2xl text-ink">Cambios</h2>
          <p>
            Tienes 15 días calendario desde que recibes tu pedido para solicitar cambio de talla o de referencia. El
            producto debe estar sin uso, con sus etiquetas y en su empaque original. Escríbenos por WhatsApp al{" "}
            {store.whatsappDisplay} para gestionarlo.
          </p>
        </section>
      </div>
    </div>
  );
}
