import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import type { OrdersReport } from "@/app/admin/orders-actions";
import { formatCOP } from "./format";
import { orderCode, statusLabel } from "./orders";

const INK: [number, number, number] = [20, 18, 16];
const SAND: [number, number, number] = [241, 233, 223];
const IVORY: [number, number, number] = [250, 247, 242];
const MUTED: [number, number, number] = [110, 104, 98];

const tz = "America/Bogota";
const dateTime = new Intl.DateTimeFormat("es-CO", { timeZone: tz, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const longDate = (d: string) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${d}T00:00:00Z`));

type Line = { sku: string; name: string; color: string; size: number; qty: number; price: number; value: number };

function linesOf(order: OrdersReport["orders"][number]): Line[] {
  return order.items.map((i) => {
    const price = i.price ?? 0;
    return { sku: i.sku || "—", name: i.name, color: i.color || "—", size: i.size, qty: i.qty, price, value: price * i.qty };
  });
}

/** Consolidado por modelo y color: pares y valor, de mayor a menor valor. */
export function consolidateByModelColor(report: OrdersReport) {
  const map = new Map<string, { code: string; name: string; color: string; orders: Set<string>; qty: number; value: number }>();
  for (const o of report.orders) {
    for (const i of o.items) {
      // Clave estable: modelo + color (el código sin la talla, o el id si es un pedido antiguo)
      const code = i.sku ? i.sku.split("-").slice(0, -1).join("-") : "";
      const key = code || `${i.productId}|${i.variantId ?? i.color}`;
      const row = map.get(key) ?? { code: code || "—", name: i.name, color: i.color || "—", orders: new Set(), qty: 0, value: 0 };
      row.orders.add(o.id);
      row.qty += i.qty;
      row.value += (i.price ?? 0) * i.qty;
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => b.value - a.value || b.qty - a.qty);
}

export function buildOrdersReportPdf(report: OrdersReport) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const period = report.from === report.to ? longDate(report.from) : `${longDate(report.from)} al ${longDate(report.to)}`;
  const states = report.statuses.map(statusLabel).join(", ");

  const pageDecor = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text("FEMSHOES", M, 14);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Reporte de pedidos", M, 18.5);
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(period, W - M, 13, { align: "right" });
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Estados: ${states}`, W - M, 17.5, { align: "right" });
    doc.setDrawColor(225, 216, 205);
    doc.line(M, 21.5, W - M, 21.5);
    // Pie de página
    doc.setFontSize(7);
    doc.text(`Generado el ${dateTime.format(new Date(report.generatedAt))} por ${report.generatedBy}`, M, H - 6);
    doc.text(`Página ${doc.getNumberOfPages()} de {total}`, W - M, H - 6, { align: "right" });
  };

  const tableBase = {
    margin: { top: 26, left: M, right: M, bottom: 12 },
    theme: "plain" as const,
    styles: { font: "helvetica", fontSize: 8, textColor: INK, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }, lineColor: [232, 225, 216] as [number, number, number], lineWidth: { bottom: 0.1 } },
    headStyles: { fillColor: INK, textColor: IVORY, fontStyle: "bold" as const, fontSize: 7.5 },
    didDrawPage: pageDecor,
  };

  // ---------- Detalle por pedido ----------
  let totalQty = 0;
  let totalValue = 0;
  const body: RowInput[] = [];
  for (const o of report.orders) {
    const lines = linesOf(o);
    const qty = lines.reduce((s, l) => s + l.qty, 0);
    const value = lines.reduce((s, l) => s + l.value, 0);
    totalQty += qty;
    totalValue += value;
    body.push([
      {
        content: `${orderCode(o.number)}   ·   ${dateTime.format(new Date(o.createdAt))}   ·   ${o.customer.name}   ·   ${o.customer.city}   ·   ${statusLabel(o.status)}`,
        colSpan: 7,
        styles: { fillColor: SAND, fontStyle: "bold", fontSize: 8 },
      },
    ]);
    for (const l of lines) {
      body.push([
        { content: l.sku, styles: { font: "courier", fontSize: 7.5 } },
        l.name,
        l.color,
        { content: String(l.size), styles: { halign: "center" } },
        { content: String(l.qty), styles: { halign: "center" } },
        { content: formatCOP(l.price), styles: { halign: "right" } },
        { content: formatCOP(l.value), styles: { halign: "right" } },
      ]);
    }
    body.push([
      { content: `Total ${orderCode(o.number)}`, colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
      { content: String(qty), styles: { halign: "center", fontStyle: "bold" } },
      "",
      { content: formatCOP(value), styles: { halign: "right", fontStyle: "bold" } },
    ]);
  }

  doc.setFontSize(11);
  autoTable(doc, {
    ...tableBase,
    head: [
      [{ content: "DETALLE POR PEDIDO", colSpan: 7, styles: { fillColor: IVORY, textColor: INK, fontSize: 10, cellPadding: { top: 0, bottom: 3, left: 0, right: 0 } } }],
      ["Código", "Modelo", "Color", { content: "Talla", styles: { halign: "center" } }, { content: "Cant.", styles: { halign: "center" } }, { content: "Valor unit.", styles: { halign: "right" } }, { content: "Subtotal", styles: { halign: "right" } }],
    ],
    body: body.length
      ? body
      : [[{ content: "No hay pedidos en este período con los estados elegidos.", colSpan: 7, styles: { halign: "center", textColor: MUTED } }]],
    foot: [
      [
        { content: `TOTAL GENERAL · ${report.orders.length} ${report.orders.length === 1 ? "pedido" : "pedidos"}`, colSpan: 4, styles: { halign: "right" } },
        { content: String(totalQty), styles: { halign: "center" } },
        "",
        { content: formatCOP(totalValue), styles: { halign: "right" } },
      ],
    ],
    footStyles: { fillColor: INK, textColor: IVORY, fontStyle: "bold", fontSize: 9 },
    showFoot: "lastPage",
    columnStyles: { 0: { cellWidth: 38 }, 3: { cellWidth: 16 }, 4: { cellWidth: 16 }, 5: { cellWidth: 30 }, 6: { cellWidth: 32 } },
  });

  // ---------- Consolidado por modelo y color ----------
  const rows = consolidateByModelColor(report);
  // Sigue en la misma página si cabe el título y unas filas; si no, en una nueva
  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 26;
  const sameRoom = lastY + 40 < H - 12;
  if (!sameRoom) doc.addPage();
  autoTable(doc, {
    ...tableBase,
    startY: sameRoom ? lastY + 10 : 26,
    head: [
      [{ content: "CONSOLIDADO POR MODELO Y COLOR", colSpan: 7, styles: { fillColor: IVORY, textColor: INK, fontSize: 10, cellPadding: { top: 0, bottom: 3, left: 0, right: 0 } } }],
      ["Código", "Modelo", "Color", { content: "Pedidos", styles: { halign: "center" } }, { content: "Pares", styles: { halign: "center" } }, { content: "Valor", styles: { halign: "right" } }, { content: "% del valor", styles: { halign: "right" } }],
    ],
    body: rows.length
      ? rows.map((r) => [
          { content: r.code, styles: { font: "courier", fontSize: 7.5 } },
          r.name,
          r.color,
          { content: String(r.orders.size), styles: { halign: "center" } },
          { content: String(r.qty), styles: { halign: "center" } },
          { content: formatCOP(r.value), styles: { halign: "right" } },
          { content: totalValue ? `${((r.value / totalValue) * 100).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` : "—", styles: { halign: "right" } },
        ])
      : [[{ content: "Sin datos.", colSpan: 7, styles: { halign: "center", textColor: MUTED } }]],
    foot: [
      [
        { content: "TOTAL", colSpan: 4, styles: { halign: "right" } },
        { content: String(totalQty), styles: { halign: "center" } },
        { content: formatCOP(totalValue), styles: { halign: "right" } },
        { content: totalValue ? "100 %" : "—", styles: { halign: "right" } },
      ],
    ],
    footStyles: { fillColor: INK, textColor: IVORY, fontStyle: "bold", fontSize: 9 },
    showFoot: "lastPage",
    columnStyles: { 0: { cellWidth: 32 }, 3: { cellWidth: 20 }, 4: { cellWidth: 20 }, 5: { cellWidth: 34 }, 6: { cellWidth: 26 } },
  });

  doc.putTotalPages("{total}");
  return { doc, filename: `reporte-pedidos_${report.from}_${report.to}.pdf`, totals: { orders: report.orders.length, qty: totalQty, value: totalValue } };
}

export function downloadOrdersReport(report: OrdersReport) {
  const { doc, filename } = buildOrdersReportPdf(report);
  doc.save(filename);
}
