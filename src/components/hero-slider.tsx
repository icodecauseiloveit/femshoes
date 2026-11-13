"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatCOP } from "@/lib/format";
import { ProductImage } from "./product-image";

export type HeroSlide = { slug: string; name: string; price: number; compareAtPrice: number | null; image: string };

const INTERVAL = 5000;

/**
 * Carrusel de la portada con los productos destacados: avanza solo cada 5 s, se puede
 * deslizar con el dedo y se pausa mientras la clienta lo toca o pasa el mouse.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const many = slides.length > 1;

  const goTo = useCallback((i: number) => {
    const el = scroller.current;
    if (!el) return;
    const n = (i + slides.length) % slides.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  }, [slides.length]);

  // Avance automático (no se activa si la persona pidió reducir el movimiento)
  useEffect(() => {
    if (!many || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => goTo(index + 1), INTERVAL);
    return () => window.clearInterval(t);
  }, [many, paused, index, goTo]);

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
            <span className="absolute bottom-4 left-4 max-w-[62%] bg-white/90 px-3 py-2 backdrop-blur-sm md:bottom-6 md:left-6">
              <span className="block truncate text-sm">{s.name}</span>
              <span className="flex items-baseline gap-2 text-xs">
                <span className={s.compareAtPrice && s.compareAtPrice > s.price ? "text-sale" : "text-ink-soft"}>{formatCOP(s.price)}</span>
                {s.compareAtPrice && s.compareAtPrice > s.price && (
                  <span className="text-muted line-through">{formatCOP(s.compareAtPrice)}</span>
                )}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {many && (
        <>
          <div className="absolute bottom-6 right-4 flex gap-1.5 md:bottom-8 md:right-6">
            {slides.map((s, i) => (
              <button
                key={s.slug}
                onClick={() => goTo(i)}
                aria-label={`Ver destacado ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-ink" : "w-1.5 bg-ink/30"}`}
              />
            ))}
          </div>
          <button
            onClick={() => goTo(index - 1)}
            aria-label="Destacado anterior"
            className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-lg md:flex"
          >
            ‹
          </button>
          <button
            onClick={() => goTo(index + 1)}
            aria-label="Destacado siguiente"
            className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-lg md:flex"
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
