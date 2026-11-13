"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ProductImage } from "./product-image";

export type HeroSlide = { slug: string; name: string; image: string };

const INTERVAL = 5000;
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Carrusel de la portada con los productos destacados. Avanza solo cada 5 s (la línea del
 * destacado actual se va llenando), es cíclico, se puede deslizar con el dedo y se pausa
 * mientras se toca o se pasa el mouse. Los controles van debajo de la foto para no taparla.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0); // reinicia la línea de progreso al cambiar
  const [paused, setPaused] = useState(false); // pausa temporal (mouse encima o dedo tocando)
  const [stopped, setStopped] = useState(false); // pausa elegida con el botón
  const many = slides.length > 1;

  const goTo = useCallback(
    (i: number) => {
      const el = scroller.current;
      if (!el) return;
      const n = (i + slides.length) % slides.length;
      // Con "reducir movimiento" activo en el equipo, cambia sin animación de deslizamiento
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: n * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
      setIndex(n);
      setCycle((c) => c + 1);
    },
    [slides.length],
  );

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const n = Math.round(el.scrollLeft / el.clientWidth);
    if (n !== index && Math.abs(el.scrollLeft - n * el.clientWidth) < 2) {
      setIndex(n);
      setCycle((c) => c + 1);
    }
  }

  if (slides.length === 0) return null;
  const running = many && !paused && !stopped;
  const current = slides[index] ?? slides[0];

  return (
    <div
      className="order-1 min-w-0 md:order-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => window.setTimeout(() => setPaused(false), 1500)}
      aria-roledescription="carrusel"
      aria-label="Productos destacados"
    >
      <div ref={scroller} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
        {slides.map((s, i) => (
          <Link
            key={s.slug}
            href={`/producto/${s.slug}`}
            className="block w-full shrink-0 snap-center"
            aria-roledescription="diapositiva"
            aria-label={`${i + 1} de ${slides.length}: ${s.name}`}
          >
            {/* contain: el zapato se ve completo en celular y tablet, sin recortes */}
            <ProductImage
              src={s.image}
              alt={s.name}
              priority={i === 0}
              fit="contain"
              sizes="(min-width: 768px) 50vw, 100vw"
              className="aspect-square"
            />
          </Link>
        ))}
      </div>

      {/* Pie del carrusel: 01 / 03 · nombre — líneas de progreso — pausa ‹ › */}
      <div className="flex h-12 items-center gap-4 border-t border-line/70 px-5 md:px-0">
        <Link href={`/producto/${current.slug}`} className="flex min-w-0 flex-1 items-baseline gap-3">
          {many && (
            <span className="font-display text-base tabular-nums tracking-wide text-ink">
              {pad(index + 1)}
              <span className="px-1 text-muted">/</span>
              <span className="text-muted">{pad(slides.length)}</span>
            </span>
          )}
          <span className="eyebrow truncate text-[0.62rem] text-ink-soft">{current.name}</span>
        </Link>

        {many && (
          <>
            <div className="hidden items-center gap-1.5 lg:flex" aria-hidden>
              {slides.map((s, i) => (
                <span key={s.slug} className="relative h-px w-7 overflow-hidden bg-ink/15">
                  {i < index && <span className="absolute inset-0 bg-ink/50" />}
                  {i === index && (
                    <span
                      key={cycle}
                      className="absolute inset-y-0 left-0 bg-ink"
                      style={{
                        animation: `hero-progress ${INTERVAL}ms linear forwards`,
                        animationPlayState: running ? "running" : "paused",
                      }}
                      onAnimationEnd={() => running && goTo(index + 1)}
                    />
                  )}
                </span>
              ))}
            </div>
            {/* En celular y tablet, una sola línea fina que se llena */}
            <span className="relative h-px w-10 shrink-0 overflow-hidden bg-ink/15 lg:hidden" aria-hidden>
              <span
                key={cycle}
                className="absolute inset-y-0 left-0 bg-ink"
                style={{ animation: `hero-progress ${INTERVAL}ms linear forwards`, animationPlayState: running ? "running" : "paused" }}
                onAnimationEnd={() => running && goTo(index + 1)}
              />
            </span>

            <div className="flex items-center">
              <IconButton label={stopped ? "Reanudar carrusel" : "Pausar carrusel"} onClick={() => setStopped((v) => !v)}>
                {stopped ? (
                  <path d="M9 7.5v9l7.5-4.5z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                ) : (
                  <path d="M10 8v8M14 8v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                )}
              </IconButton>
              <IconButton label="Destacado anterior" onClick={() => goTo(index - 1)}>
                <path d="M14 7l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </IconButton>
              <IconButton label="Destacado siguiente" onClick={() => goTo(index + 1)}>
                <path d="M10 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </IconButton>
            </div>
          </>
        )}
      </div>

      {/* Puntos para lectores de pantalla y teclado (ocultos a la vista) */}
      {many && (
        <div className="sr-only">
          {slides.map((s, i) => (
            <button key={s.slug} onClick={() => goTo(i)} aria-label={`Ver destacado ${i + 1}`} aria-current={i === index} />
          ))}
        </div>
      )}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-10 place-items-center text-ink transition-opacity hover:opacity-60"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
