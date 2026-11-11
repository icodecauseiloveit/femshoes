"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { store } from "@/lib/config";
import { formatCOP } from "@/lib/format";
import { buildOrderMessage, whatsappUrl, type CustomerData } from "@/lib/whatsapp";
import { CartLine } from "./cart-drawer";
import { useCart } from "./cart-provider";
import { WhatsAppIcon } from "./icons";

const CUSTOMER_KEY = "femshoes-customer-v1";

const empty: CustomerData = {
  name: "",
  phone: "",
  city: "",
  address: "",
  neighborhood: "",
  payment: store.paymentMethods[0],
  notes: "",
};

export function Checkout() {
  const { items, subtotal, ready, clear } = useCart();
  const [customer, setCustomer] = useState<CustomerData>(empty);
  const [sent, setSent] = useState(false);

  // Recordar los datos de la clienta en este teléfono
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CUSTOMER_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setCustomer({ ...empty, ...JSON.parse(saved), notes: "" });
    } catch {}
  }, []);

  function set<K extends keyof CustomerData>(key: K, value: CustomerData[K]) {
    setCustomer((c) => ({ ...c, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { notes: _notes, ...keep } = customer;
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(keep));
    } catch {}
    const url = whatsappUrl(buildOrderMessage(items, customer));
    window.open(url, "_blank", "noopener");
    setSent(true);
    window.scrollTo({ top: 0 });
  }

  if (!ready) return <div className="min-h-[60vh]" />;

  if (sent) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="eyebrow text-gold">¡Gracias!</p>
        <h1 className="mt-3 text-4xl">Tu pedido va en camino a WhatsApp</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Envía el mensaje que se abrió en WhatsApp y te confirmaremos disponibilidad, costo de envío y datos de pago.
          Si no se abrió, toca el botón de abajo.
        </p>
        <a
          href={whatsappUrl(buildOrderMessage(items, customer))}
          target="_blank"
          rel="noopener"
          className="btn mt-7 w-full bg-[#25D366] text-white"
        >
          <WhatsAppIcon width={18} height={18} /> Abrir WhatsApp
        </a>
        <button
          onClick={() => {
            clear();
            setSent(false);
          }}
          className="btn mt-3 w-full border border-ink"
        >
          Ya lo envié · Vaciar bolsa
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-4xl">Tu bolsa está vacía</h1>
        <p className="mt-3 text-sm text-muted">Agrega tus favoritos para hacer tu pedido.</p>
        <Link href="/tienda" className="btn mt-7 bg-ink text-ivory">
          Ver colección
        </Link>
      </div>
    );
  }

  const freeShipping = store.freeShippingFrom > 0 && subtotal >= store.freeShippingFrom;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-10 pt-8 md:grid md:grid-cols-[1fr_380px] md:gap-12">
      <div>
        <h1 className="text-4xl">Finalizar pedido</h1>
        <p className="mt-2 text-sm text-muted">
          Completa tus datos y te enviaremos el pedido por WhatsApp para confirmarlo.
        </p>

        <form id="checkout" onSubmit={submit} className="mt-7 space-y-4">
          <Field label="Nombre completo">
            <input required autoComplete="name" value={customer.name} onChange={(e) => set("name", e.target.value)} className="field" />
          </Field>
          <Field label="Celular">
            <input required type="tel" inputMode="tel" autoComplete="tel" pattern="[0-9+ ]{7,15}" value={customer.phone} onChange={(e) => set("phone", e.target.value)} className="field" placeholder="300 123 4567" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ciudad">
              <input required autoComplete="address-level2" value={customer.city} onChange={(e) => set("city", e.target.value)} className="field" />
            </Field>
            <Field label="Barrio">
              <input value={customer.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} className="field" />
            </Field>
          </div>
          <Field label="Dirección">
            <input required autoComplete="street-address" value={customer.address} onChange={(e) => set("address", e.target.value)} className="field" placeholder="Calle, número, apto o casa" />
          </Field>
          <Field label="Método de pago preferido">
            <select value={customer.payment} onChange={(e) => set("payment", e.target.value)} className="field appearance-none">
              {store.paymentMethods.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Notas (opcional)">
            <textarea rows={2} value={customer.notes} onChange={(e) => set("notes", e.target.value)} className="field resize-none" placeholder="Ej.: es para regalo" />
          </Field>
        </form>
      </div>

      <aside className="mt-10 md:mt-0">
        <div className="bg-sand p-5">
          <h2 className="text-2xl">Resumen</h2>
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <CartLine key={`${item.productId}-${item.size}`} item={item} />
            ))}
          </ul>
          <dl className="space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{formatCOP(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Envío</dt>
              <dd>{freeShipping ? "Gratis" : "Por confirmar"}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-medium">
              <dt>Total</dt>
              <dd>{formatCOP(subtotal)}{!freeShipping && " + envío"}</dd>
            </div>
          </dl>
        </div>
        <button form="checkout" type="submit" className="btn mt-4 w-full bg-[#25D366] text-white hover:opacity-90">
          <WhatsAppIcon width={18} height={18} /> Enviar pedido por WhatsApp
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          No se realiza ningún cobro aquí. Confirmamos tu pedido por WhatsApp.
        </p>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block text-[0.62rem] text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
