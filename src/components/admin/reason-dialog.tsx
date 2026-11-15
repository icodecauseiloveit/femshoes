"use client";

import { useState } from "react";

/** Ventana que pide el motivo antes de una acción sobre un producto (ocultar, publicar, eliminar). */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<string | void>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return setError("Escribe el motivo.");
    setBusy(true);
    const err = await onConfirm(reason.trim());
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Cancelar" className="absolute inset-0 bg-ink/50" onClick={onCancel} />
      <form
        onSubmit={submit}
        className="animate-fade-up absolute inset-x-0 bottom-0 space-y-4 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[26rem] md:-translate-x-1/2 md:-translate-y-1/2"
      >
        <h2 className="text-2xl">{title}</h2>
        {description && <p className="text-sm text-ink-soft">{description}</p>}
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">Motivo (queda en el historial)</span>
          <textarea
            autoFocus
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className="field"
            placeholder="Ej.: modelo descontinuado por el fabricante"
          />
        </label>
        {error && <p className="text-sm text-sale">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn flex-1 border border-line-strong">Cancelar</button>
          <button disabled={busy} className={`btn flex-1 text-white ${danger ? "bg-sale" : "bg-ink"}`}>
            {busy ? "Guardando…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
