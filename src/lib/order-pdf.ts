import { store } from "./config";
import { formatCOP } from "./format";
import { orderCode, statusLabel, type OrderView } from "./orders";

/** Carga una imagen y la convierte en JPEG (recortada a 4:5) para el PDF. */
function loadImage(src: string): Promise<string | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = 400, h = 500;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#f1e9df";
        ctx.fillRect(0, 0, w, h);
        const iw = img.naturalWidth || w, ih = img.naturalHeight || h;
        const scale = Math.max(w / iw, h / ih);
        const dw = iw * scale, dh = ih * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Genera y descarga el PDF de un pedido. Muestra precios y datos de la clienta solo si vienen en el pedido. */
export async function downloadOrderPdf(order: OrderView) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const code = orderCode(order.number);
  const full = order.subtotal !== undefined;
  const W = 210, M = 15;
  let y = 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(20);
  doc.text(store.name.toUpperCase(), M, y);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(store.tagline, M, y + 5);
  doc.setTextColor(20);
  doc.setFontSize(14);
  doc.text(`Pedido ${code}`, W - M, y, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(90);
  const date = new Date(order.createdAt).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });
  doc.text(`${date} · ${statusLabel(order.status)}`, W - M, y + 5, { align: "right" });
  doc.setTextColor(20);
  y += 12;
  doc.setDrawColor(220);
  doc.line(M, y, W - M, y);
  y += 8;

  if (full && order.customer) {
    const c = order.customer;
    doc.setFontSize(10);
    doc.text("Datos de envío", M, y);
    doc.setFontSize(9);
    doc.setTextColor(70);
    const lines = [
      `${c.name} · ${c.phone}`,
      `${c.address}${c.neighborhood ? `, barrio ${c.neighborhood}` : ""} · ${c.city}`,
      `Pago: ${c.payment}`,
      ...(c.notes ? [`Notas: ${c.notes}`] : []),
    ];
    lines.forEach((l, i) => doc.text(doc.splitTextToSize(l, W - 2 * M)[0], M, y + 5 + i * 4.5));
    doc.setTextColor(20);
    y += 8 + lines.length * 4.5;
    doc.line(M, y, W - M, y);
    y += 6;
  }

  // Encabezado de la tabla
  const col = { img: M, name: M + 28, size: 118, color: 133, qty: full ? 160 : 185, price: 195 };
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("PRODUCTO", col.name, y);
  doc.text("TALLA", col.size, y);
  doc.text("COLOR", col.color, y);
  doc.text("CANT.", col.qty, y, { align: full ? "left" : "right" });
  if (full) doc.text("SUBTOTAL", W - M, y, { align: "right" });
  doc.setTextColor(20);
  y += 4;

  const images = await Promise.all(order.items.map((i) => loadImage(i.image)));
  const rowH = 32;
  order.items.forEach((item, idx) => {
    if (y + rowH > 280) {
      doc.addPage();
      y = 20;
    }
    const img = images[idx];
    if (img) doc.addImage(img, "JPEG", col.img, y, 24, 30);
    else {
      doc.setFillColor(241, 233, 223);
      doc.rect(col.img, y, 24, 30, "F");
    }
    const mid = y + 16;
    doc.setFontSize(10);
    const nameLines = doc.splitTextToSize(item.name, col.size - col.name - 4) as string[];
    doc.text(nameLines, col.name, mid - 2);
    if (item.sku) {
      doc.setFontSize(7.5);
      doc.setTextColor(110);
      doc.text(item.sku, col.name, mid - 2 + nameLines.length * 4.5);
      doc.setTextColor(20);
    }
    doc.setFontSize(10);
    doc.text(String(item.size), col.size, mid);
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(item.color || "-", (full ? col.qty : col.qty - 15) - col.color - 2), col.color, mid);
    doc.setFontSize(10);
    doc.text(String(item.qty), full ? col.qty + 3 : col.qty, mid, { align: full ? "left" : "right" });
    if (full && item.price !== undefined) {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`${formatCOP(item.price)} c/u`, W - M, mid - 4, { align: "right" });
      doc.setTextColor(20);
      doc.setFontSize(10);
      doc.text(formatCOP(item.price * item.qty), W - M, mid + 1, { align: "right" });
    }
    y += rowH + 2;
    doc.setDrawColor(235);
    doc.line(M, y - 1, W - M, y - 1);
  });

  y += 6;
  doc.setFontSize(11);
  doc.text(`Total de pares: ${order.totalPairs}`, W - M, y, { align: "right" });
  if (full && order.subtotal !== undefined) {
    y += 6;
    doc.text(`Subtotal: ${formatCOP(order.subtotal)}`, W - M, y, { align: "right" });
  }

  doc.save(`pedido-${code}.pdf`);
}
