"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { store } from "@/lib/config";
import { formatCOP } from "@/lib/format";
import { createOrder } from "@/app/actions";
import { orderCode } from "@/lib/orders";
import { buildOrderMessage, whatsappUrl, type CustomerData } from "@/lib/whatsapp";
import { CartLine } from "./cart-drawer";
import { lineKey, useCart } from "./cart-provider";
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
  const [sending, setSending] = useState(false);
  const [sentCode, setSentCode] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [marketing, setMarketing] = useState(false);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    try {
      const { notes: _notes, ...keep } = customer;
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(keep));
    } catch {}

    setSending(true);
    setIssues([]);
    // Se abre la pestaña de inmediato (con el toque) para que el navegador no la bloquee
    const tab = window.open("", "_blank");

    const res = await createOrder({
      items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, size: i.size, qty: i.qty })),
      customer,
      marketingConsent: marketing,
    });
    setSending(false);

    if (!res.ok && res.error !== "not-configured" && res.issues) {
      tab?.close();
      setIssues(res.issues);
      return;
    }
    const code = res.ok ? orderCode(res.number) : undefined;
    const url = whatsappUrl(buildOrderMessage(items, customer, code));
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setSentCode(code ?? "");
    setSent(true);
    window.scrollTo({ top: 0 });
  }

  if (!ready) return <div className="min-h-[60vh]" />;

  if (sent) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="eyebrow text-gold">¡Gracias!</p>
        <h1 className="mt-3 text-4xl">Tu pedido va en camino a WhatsApp</h1>
        {sentCode && <p className="mt-3 text-sm">Número de pedido: <strong className="font-medium">{sentCode}</strong></p>}
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Envía el mensaje que se abrió en WhatsApp y te confirmaremos disponibilidad, costo de envío y datos de pago.
          Si no se abrió, toca el botón de abajo.
        </p>
        <a
          href={whatsappUrl(buildOrderMessage(items, customer, sentCode || undefined))}
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
        <Link href="/tienda" className="btn mt-7 bg-ink text-white">
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
        <div className="bg-mist p-5">
          <h2 className="text-2xl">Resumen</h2>
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <CartLine key={lineKey(item)} item={item} />
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
        {issues.length > 0 && (
          <div className="mt-4 border border-sale/40 bg-sale/5 p-3 text-sm text-sale">
            <p className="font-medium">Revisa tu bolsa:</p>
            <ul className="mt-1 list-disc pl-5">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}
        <button form="checkout" type="submit" disabled={sending} className="btn mt-4 w-full bg-[#25D366] text-white hover:opacity-90">
          <WhatsAppIcon width={18} height={18} /> {sending ? "Registrando pedido…" : "Enviar pedido por WhatsApp"}
        </button>
        <label className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-ink-soft">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-ink"
          />
          Quiero recibir por WhatsApp novedades y ofertas de {store.name}.
        </label>
        <p className="mt-3 text-center text-xs text-muted">
          No se realiza ningún cobro aquí. Confirmamos tu pedido por WhatsApp.
        </p>
        <p className="mt-2 text-center text-[0.7rem] text-muted">
          Al enviar tu pedido usamos tus datos para gestionarlo, según nuestra{" "}
          <Link href="/tratamiento-de-datos" className="underline underline-offset-2">política de tratamiento de datos</Link>.
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
