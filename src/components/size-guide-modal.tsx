"use client";

import { useEffect, useRef } from "react";
import { measureTip, sizeGuide } from "@/lib/size-guide";
import { CloseIcon } from "./icons";

type Props = {
  open: boolean;
  onClose: () => void;
  color: string;
  sizes: number[]; // tallas del modelo
  stockOf: (size: number) => number; // pares en el color elegido
  selected: number | null;
  onSelect: (size: number) => void;
};

/** Guía de tallas en ventana sobre la ficha: compara medidas y elige la talla sin salir del producto. */
export function SizeGuideModal({ open, onClose, color, sizes, stockOf, selected, onSelect }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Solo al abrir: bloquear el scroll de atrás, enfocar "Cerrar" y escuchar Escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;
  const rows = sizeGuide.filter((r) => sizes.includes(r.co));

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Guía de tallas">
      <button aria-label="Cerrar guía de tallas" className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-fade-up absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto bg-white pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[30rem] md:-translate-x-1/2 md:-translate-y-1/2">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <h2 className="text-2xl">Guía de tallas</h2>
          <button ref={closeRef} onClick={onClose} aria-label="Cerrar" className="-mr-2 p-2">
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm leading-relaxed text-ink-soft">{measureTip}</p>
          <p className="eyebrow text-[0.62rem]">
            Toca tu talla · <span className="normal-case tracking-normal text-ink-soft">color {color}</span>
          </p>
          <table className="w-full text-center text-sm">
            <thead className="eyebrow bg-mist text-[0.58rem]">
              <tr>
                <th className="py-2.5">Colombia</th>
                <th>Pie</th>
                <th>EE. UU.</th>
                <th>Europa</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const stock = stockOf(r.co);
                const out = stock === 0;
                const active = selected === r.co && !out;
                return (
                  <tr
                    key={r.co}
                    onClick={() => !out && onSelect(r.co)}
                    className={out ? "text-muted" : active ? "cursor-pointer bg-ink text-white" : "cursor-pointer hover:bg-mist"}
                  >
                    <td className="py-3 font-medium">{r.co}</td>
                    <td>{r.cm} cm</td>
                    <td>{r.us}</td>
                    <td>{r.eu}</td>
                    <td className="pr-2 text-right">
                      {out ? (
                        <span className="text-xs">Agotada</span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(r.co);
                          }}
                          aria-pressed={active}
                          aria-label={`Elegir talla ${r.co}`}
                          className={`btn min-h-8 px-3 text-[0.62rem] ${active ? "border border-white text-white" : "border border-ink text-ink"}`}
                        >
                          {active ? "Elegida" : "Elegir"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-muted">Medidas aproximadas; pueden variar según la horma de cada modelo.</p>
          <button onClick={onClose} className="btn w-full bg-ink text-white">
            {selected ? `Listo · talla ${selected}` : "Cerrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
