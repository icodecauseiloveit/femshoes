"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getCustomer, listCustomers, updateCustomer, type CustomerDetail } from "@/app/admin/customers-actions";
import {
  documentTypes,
  formatPhone,
  INACTIVE_DAYS,
  suggestedTags,
  whatsappLink,
  type CustomerSummary,
} from "@/lib/customers";
import { formatCOP } from "@/lib/format";
import { orderCode, statusLabel } from "@/lib/orders";
import { getSupabase } from "@/lib/supabase";
import { WhatsAppIcon } from "../icons";
import { OrderBilling, PaymentBadge } from "./order-billing";

async function token() {
  const { data } = await getSupabase()!.auth.getSession();
  return data.session?.access_token ?? "";
}

const shortDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "—";

const ago = (days: number | null) =>
  days === null ? "Sin compras" : days === 0 ? "Hoy" : days === 1 ? "Hace 1 día" : `Hace ${days} días`;

type Segment = "todas" | "nuevas" | "recurrentes" | "inactivas" | "saldo" | "mercadeo";
const segments: { id: Segment; label: string; test: (c: CustomerSummary) => boolean }[] = [
  { id: "todas", label: "Todas", test: () => true },
  { id: "nuevas", label: "Nuevas", test: (c) => c.stats.firstOrderAt !== null && Date.now() - new Date(c.stats.firstOrderAt).getTime() <= 30 * 86_400_000 },
  { id: "recurrentes", label: "Recurrentes", test: (c) => c.stats.purchases >= 2 },
  { id: "inactivas", label: `Inactivas (+${INACTIVE_DAYS} días)`, test: (c) => (c.stats.daysSinceLast ?? 0) > INACTIVE_DAYS },
  { id: "saldo", label: "Con saldo", test: (c) => c.stats.balance > 0 },
  { id: "mercadeo", label: "Aceptan novedades", test: (c) => Boolean(c.marketingConsentAt) },
];

type Sort = "reciente" | "compras" | "saldo" | "nombre";
const sorts: { id: Sort; label: string; fn: (a: CustomerSummary, b: CustomerSummary) => number }[] = [
  { id: "reciente", label: "Última compra", fn: (a, b) => (b.stats.lastOrderAt ?? "").localeCompare(a.stats.lastOrderAt ?? "") },
  { id: "compras", label: "Mayor compra", fn: (a, b) => b.stats.purchased - a.stats.purchased },
  { id: "saldo", label: "Mayor saldo", fn: (a, b) => b.stats.balance - a.stats.balance },
  { id: "nombre", label: "Nombre", fn: (a, b) => a.name.localeCompare(b.name, "es") },
];

export function CustomersPanel({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }) {
  const [list, setList] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<Segment>("todas");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<Sort>("reciente");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listCustomers(await token());
    if (res.ok) {
      setList(res.data);
      setError("");
    } else setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const tags = useMemo(() => [...new Set(list.flatMap((c) => c.tags))].sort(), [list]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    const seg = segments.find((s) => s.id === segment)!;
    return list
      .filter((c) => seg.test(c))
      .filter((c) => !tag || c.tags.includes(tag))
      .filter(
        (c) =>
          !term ||
          c.name.toLowerCase().includes(term) ||
          c.city.toLowerCase().includes(term) ||
          c.documentNumber.toLowerCase().includes(term) ||
          (digits.length >= 3 && c.phone.includes(digits)),
      )
      .sort(sorts.find((s) => s.id === sort)!.fn);
  }, [list, q, segment, tag, sort]);

  if (openId) return <CustomerView id={openId} onBack={() => (onOpen(null), load())} />;

  const totals = shown.reduce((t, c) => ({ purchased: t.purchased + c.stats.purchased, balance: t.balance + c.stats.balance }), { purchased: 0, balance: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">
          Clientas <span className="text-lg text-muted">({list.length})</span>
        </h1>
        <button onClick={() => exportCsv(shown)} disabled={shown.length === 0} className="btn min-h-9 border border-ink px-3 text-[0.7rem]">
          Exportar Excel
        </button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, celular, documento o ciudad…" className="field" />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {segments.map((s) => (
          <button
            key={s.id}
            onClick={() => setSegment(s.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[0.78rem] ${segment === s.id ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink-soft"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {tags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filtrar por etiqueta" className="border border-line-strong bg-white px-2 py-1.5">
            <option value="">Todas las etiquetas</option>
            {tags.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar clientas" className="border border-line-strong bg-white px-2 py-1.5">
          {sorts.map((s) => <option key={s.id} value={s.id}>Ordenar: {s.label}</option>)}
        </select>
      </div>
      {!loading && (
        <p className="text-xs text-muted">
          {shown.length} {shown.length === 1 ? "clienta" : "clientas"} · Compras {formatCOP(totals.purchased)} · Saldo por cobrar{" "}
          <span className={totals.balance > 0 ? "text-sale" : ""}>{formatCOP(totals.balance)}</span>
        </p>
      )}
      {error && <p className="border border-sale/40 bg-sale/5 p-3 text-sm text-sale">{error}</p>}
      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando clientas…</p>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No hay clientas con estos filtros.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {shown.map((c) => (
            <li key={c.id}>
              <button onClick={() => onOpen(c.id)} className="flex w-full items-start justify-between gap-3 py-3 text-left">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name || "(Sin nombre)"}</span>
                  <span className="block text-xs text-muted">{formatPhone(c.phone)}{c.city && ` · ${c.city}`}</span>
                  {c.tags.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {c.tags.map((t) => <span key={t} className="eyebrow bg-mist px-1.5 py-0.5 text-[0.55rem]">{t}</span>)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right text-xs">
                  <span className="block text-sm">{formatCOP(c.stats.purchased)}</span>
                  <span className="block text-muted">
                    {c.stats.purchases} {c.stats.purchases === 1 ? "compra" : "compras"} · {ago(c.stats.daysSinceLast)}
                  </span>
                  {c.stats.balance > 0 && <span className="block font-medium text-sale">Debe {formatCOP(c.stats.balance)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function exportCsv(rows: CustomerSummary[]) {
  const head = [
    "Nombre", "Celular", "Tipo documento", "Documento", "Correo", "Ciudad", "Dirección", "Barrio", "Cumpleaños", "Etiquetas",
    "Pedidos", "Compras", "Total comprado", "Ticket promedio", "Primera compra", "Última compra", "Días sin comprar", "Saldo", "Acepta novedades",
  ];
  const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
  const lines = rows.map((c) => [
    c.name, c.phone, c.documentType, c.documentNumber, c.email, c.city, c.address, c.neighborhood, c.birthday ?? "", c.tags.join(" | "),
    c.stats.orders, c.stats.purchases, c.stats.purchased, c.stats.avgTicket, day(c.stats.firstOrderAt), day(c.stats.lastOrderAt),
    c.stats.daysSinceLast ?? "", c.stats.balance, c.marketingConsentAt ? "Sí" : "No",
  ]);
  // Punto y coma y BOM para que Excel en español lo abra con tildes y columnas correctas
  const csv = [head, ...lines].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `clientas-femshoes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------- Ficha de la clienta ---------------- */

function CustomerView({ id, onBack }: { id: string; onBack: () => void }) {
  const [c, setC] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getCustomer(await token(), id);
    if (res.ok) setC(res.data);
    else setError(res.error);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!c) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-ink-soft">← Clientas</button>
        {error ? <p className="text-sm text-sale">{error}</p> : <p className="py-10 text-center text-sm text-muted">Cargando ficha…</p>}
      </div>
    );
  }

  const s = c.stats;
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-ink-soft">← Clientas</button>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight">{c.name || "(Sin nombre)"}</h1>
          <p className="text-sm text-muted">
            {formatPhone(c.phone)} · Clienta desde {shortDate(c.createdAt)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {c.marketingConsentAt ? `Acepta novedades por WhatsApp desde ${shortDate(c.marketingConsentAt)}` : "No ha autorizado mensajes de novedades"}
          </p>
        </div>
        <a href={whatsappLink(c.phone)} target="_blank" rel="noopener" aria-label="Escribir por WhatsApp" className="btn min-h-10 shrink-0 bg-[#25D366] px-3 text-white">
          <WhatsAppIcon width={18} height={18} />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Kpi label="Total comprado" value={formatCOP(s.purchased)} />
        <Kpi label="Compras" value={`${s.purchases}${s.orders > s.purchases ? ` (+${s.orders - s.purchases} en curso)` : ""}`} />
        <Kpi label="Ticket promedio" value={s.avgTicket ? formatCOP(s.avgTicket) : "—"} />
        <Kpi label="Saldo por cobrar" value={formatCOP(s.balance)} tone={s.balance > 0 ? "text-sale" : undefined} />
        <Kpi label="Primera compra" value={shortDate(s.firstOrderAt)} />
        <Kpi label="Última compra" value={`${shortDate(s.lastOrderAt)}`} hint={s.daysSinceLast !== null ? ago(s.daysSinceLast) : undefined} />
      </div>

      {(c.topSizes.length > 0 || c.topColors.length > 0) && (
        <div className="space-y-2 border border-line bg-white p-3 text-sm">
          <p className="eyebrow text-[0.62rem]">Preferencias (según lo comprado)</p>
          <Prefs label="Tallas" items={c.topSizes} />
          <Prefs label="Colores" items={c.topColors} />
          <Prefs label="Modelos" items={c.topModels} />
        </div>
      )}

      <CustomerForm
        key={c.id + c.name + c.notes + c.tags.join()}
        c={c}
        onSaved={() => {
          setSaved("Datos guardados.");
          load();
        }}
      />
      {saved && <p className="text-sm text-[#2f6b3f]">{saved}</p>}

      <div className="space-y-2">
        <h2 className="text-2xl">Pedidos ({c.orders.length})</h2>
        <ul className="divide-y divide-line border-y border-line">
          {c.orders.map((o) => (
            <li key={o.id}>
              <button onClick={() => setOpen(open === o.id ? null : o.id)} className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm">
                <span>
                  <span className="font-medium">{orderCode(o.number)}</span>
                  <span className="block text-xs text-muted">
                    {shortDate(o.createdAt)} · {statusLabel(o.status)} · {o.totalPairs} {o.totalPairs === 1 ? "par" : "pares"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-right">
                    <span className="block">{formatCOP(o.finance!.total)}</span>
                    {o.finance!.balance > 0 && o.status !== "cancelado" && <span className="block text-xs text-sale">Saldo {formatCOP(o.finance!.balance)}</span>}
                  </span>
                  {o.status !== "cancelado" && <PaymentBadge total={o.finance!.total} paid={o.finance!.paid} />}
                </span>
              </button>
              {open === o.id && (
                <div className="mb-3 border border-line bg-white">
                  <ul className="divide-y divide-line px-3 text-xs">
                    {o.items.map((i, n) => (
                      <li key={n} className="flex justify-between gap-2 py-2">
                        <span>
                          {i.name} · {i.color} · Talla {i.size}
                          {i.sku && <span className="block font-mono text-[0.65rem] text-muted">{i.sku}</span>}
                        </span>
                        <span className="shrink-0">{i.qty} × {formatCOP(i.price ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                  <OrderBilling order={o} onChanged={load} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="border border-line bg-white p-3">
      <p className="text-[0.68rem] uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-base font-medium ${tone ?? ""}`}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Prefs({ label, items }: { label: string; items: { label: string; qty: number }[] }) {
  if (items.length === 0) return null;
  return (
    <p className="text-xs text-ink-soft">
      <span className="text-muted">{label}: </span>
      {items.map((i) => `${i.label} (${i.qty})`).join(" · ")}
    </p>
  );
}

function CustomerForm({ c, onSaved }: { c: CustomerDetail; onSaved: () => void }) {
  const [f, setF] = useState({
    name: c.name,
    documentType: c.documentType,
    documentNumber: c.documentNumber,
    email: c.email,
    city: c.city,
    address: c.address,
    neighborhood: c.neighborhood,
    birthday: c.birthday ?? "",
    tags: c.tags,
    notes: c.notes,
  });
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  function addTag(t: string) {
    const tag = t.trim();
    if (tag && !f.tags.includes(tag)) set("tags", [...f.tags, tag]);
    setNewTag("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await updateCustomer(await token(), c.id, { ...f, birthday: f.birthday || null });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setError("");
    onSaved();
  }

  return (
    <form onSubmit={save} className="space-y-3 border border-line bg-white p-3">
      <p className="eyebrow text-[0.62rem]">Datos de la clienta</p>
      <L text="Nombre"><input required value={f.name} onChange={(e) => set("name", e.target.value)} className="field" /></L>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <L text="Documento">
          <select value={f.documentType} onChange={(e) => set("documentType", e.target.value)} className="field" aria-label="Tipo de documento">
            {documentTypes.map((d) => <option key={d.value} value={d.value}>{d.value || "—"}</option>)}
          </select>
        </L>
        <L text="Número"><input value={f.documentNumber} onChange={(e) => set("documentNumber", e.target.value)} className="field" inputMode="numeric" /></L>
      </div>
      <L text="Correo"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className="field" /></L>
      <div className="grid grid-cols-2 gap-2">
        <L text="Ciudad"><input value={f.city} onChange={(e) => set("city", e.target.value)} className="field" /></L>
        <L text="Barrio"><input value={f.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} className="field" /></L>
      </div>
      <L text="Dirección"><input value={f.address} onChange={(e) => set("address", e.target.value)} className="field" /></L>
      <L text="Cumpleaños"><input type="date" value={f.birthday} onChange={(e) => set("birthday", e.target.value)} className="field" /></L>
      <div>
        <p className="mb-1 text-xs text-ink-soft">Etiquetas</p>
        <div className="flex flex-wrap gap-1.5">
          {f.tags.map((t) => (
            <button key={t} type="button" onClick={() => set("tags", f.tags.filter((x) => x !== t))} className="eyebrow bg-ink px-2 py-1 text-[0.58rem] text-white" aria-label={`Quitar etiqueta ${t}`}>
              {t} ✕
            </button>
          ))}
          {suggestedTags.filter((t) => !f.tags.includes(t)).map((t) => (
            <button key={t} type="button" onClick={() => addTag(t)} className="eyebrow border border-line px-2 py-1 text-[0.58rem] text-ink-soft">
              + {t}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(newTag))} placeholder="Otra etiqueta" className="field" />
          <button type="button" onClick={() => addTag(newTag)} className="btn min-h-12 shrink-0 border border-line px-3">Agregar</button>
        </div>
      </div>
      <L text="Notas internas"><textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} className="field" placeholder="Preferencias, horarios de entrega, acuerdos…" /></L>
      {error && <p className="text-sm text-sale">{error}</p>}
      <button disabled={busy} className="btn w-full bg-ink text-white">{busy ? "Guardando…" : "Guardar datos"}</button>
    </form>
  );
}

function L({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-ink-soft">{text}</span>
      {children}
    </label>
  );
}
