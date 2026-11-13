"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductImage } from "./product-image";

export type HeroSlide = { slug: string; name: string; image: string };

const INTERVAL = 5000;

/**
 * Carrusel de la portada con los productos destacados: avanza solo cada 5 s, se puede
 * deslizar con el dedo y se pausa mientras la clienta lo toca o pasa el mouse.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false); // pausa temporal (mouse encima o dedo tocando)
  const [stopped, setStopped] = useState(false); // pausa elegida con el botón
  const many = slides.length > 1;

  const goTo = useCallback((i: number) => {
    const el = scroller.current;
    if (!el) return;
    const n = (i + slides.length) % slides.length;
    // Con "reducir movimiento" activo en el equipo, cambia sin animación de deslizamiento
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: n * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }, [slides.length]);

  // Avance automático y cíclico (después del último vuelve al primero)
  useEffect(() => {
    if (!many || paused || stopped) return;
    const t = window.setInterval(() => goTo(index + 1), INTERVAL);
    return () => window.clearInterval(t);
  }, [many, paused, stopped, index, goTo]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  if (slides.length === 0) return null;

  return (
    <div
      className="relative order-1 min-w-0 md:order-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => window.setTimeout(() => setPaused(false), INTERVAL)}
      aria-roledescription="carrusel"
      aria-label="Productos destacados"
    >
      <div ref={scroller} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
        {slides.map((s, i) => (
          <Link
            key={s.slug}
            href={`/producto/${s.slug}`}
            className="relative block w-full shrink-0 snap-center"
            aria-roledescription="diapositiva"
            aria-label={`${i + 1} de ${slides.length}: ${s.name}`}
          >
            <ProductImage
              src={s.image}
              alt={s.name}
              priority={i === 0}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="aspect-[5/4] md:aspect-[4/5]"
            />
            <span className="absolute left-4 top-4 max-w-[70%] truncate bg-white/90 px-3 py-2 text-sm backdrop-blur-sm md:bottom-6 md:left-6 md:top-auto md:max-w-[45%]">
              {s.name}
            </span>
          </Link>
        ))}
      </div>

      {many && (
        // Controles abajo, fuera del zapato: ❚❚  ‹ • • • ›
        <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-full bg-white/85 px-1.5 py-1 backdrop-blur-sm md:bottom-6 md:right-6">
          <button
            onClick={() => setStopped((v) => !v)}
            aria-label={stopped ? "Reanudar carrusel" : "Pausar carrusel"}
            className="grid size-7 place-items-center rounded-full text-[0.6rem] text-ink"
          >
            {stopped ? "▶" : "❚❚"}
          </button>
          <button onClick={() => goTo(index - 1)} aria-label="Destacado anterior" className="grid size-7 place-items-center text-lg leading-none text-ink">
            ‹
          </button>
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.slug}
                onClick={() => goTo(i)}
                aria-label={`Ver destacado ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-ink" : "w-1.5 bg-ink/30"}`}
              />
            ))}
          </div>
          <button onClick={() => goTo(index + 1)} aria-label="Destacado siguiente" className="grid size-7 place-items-center text-lg leading-none text-ink">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
