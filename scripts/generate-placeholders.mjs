// Genera ilustraciones SVG de ejemplo para los productos de muestra.
// Uso: node scripts/generate-placeholders.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), "public", "products");
mkdirSync(out, { recursive: true });

// Siluetas en un lienzo de 800x1000; el suelo está en y=700.
const shapes = {
  tacones: (c, s) => `
    <path d="M140 688 C140 650 175 628 230 622 C300 615 365 596 425 556 C478 520 525 470 565 432 C590 410 625 408 645 428 L655 440 L652 478 C628 488 616 512 612 545 L604 700 L586 700 L580 560 C552 590 512 630 462 660 C412 690 350 700 290 700 L160 700 C148 700 140 696 140 688 Z" fill="${c}"/>
    <path d="M232 624 C300 640 380 620 440 566" fill="none" stroke="${s}" stroke-width="6" stroke-linecap="round" opacity=".55"/>
    <path d="M150 696 L300 700 C360 700 420 688 470 656" fill="none" stroke="${s}" stroke-width="5" opacity=".35"/>`,
  sandalias: (c, s) => `
    <path d="M130 690 C130 676 150 668 190 666 L420 660 C480 640 540 590 585 560 C605 548 630 552 640 570 L640 588 C622 596 614 615 612 640 L606 700 L590 700 L584 650 C560 670 520 690 470 696 L170 702 C145 702 130 698 130 690 Z" fill="${c}"/>
    <path d="M210 666 C230 600 300 590 330 664" fill="none" stroke="${c}" stroke-width="22" stroke-linecap="round"/>
    <path d="M330 662 C360 600 420 590 450 650" fill="none" stroke="${c}" stroke-width="18" stroke-linecap="round"/>
    <path d="M520 600 C540 520 610 500 640 560" fill="none" stroke="${c}" stroke-width="16" stroke-linecap="round"/>
    <circle cx="628" cy="552" r="9" fill="${s}" opacity=".7"/>`,
  botas: (c, s) => `
    <path d="M150 690 C150 655 185 632 245 626 C320 618 380 600 420 560 L430 250 C430 228 448 214 470 214 L600 214 C622 214 636 230 636 252 L640 470 C640 520 632 560 630 600 L626 700 L582 700 L578 640 C540 680 470 700 380 700 L170 700 C158 700 150 697 150 690 Z" fill="${c}"/>
    <path d="M600 230 L604 600" stroke="${s}" stroke-width="5" opacity=".5" stroke-dasharray="2 14" stroke-linecap="round"/>
    <path d="M430 300 L636 300" stroke="${s}" stroke-width="5" opacity=".35"/>`,
  planos: (c, s) => `
    <path d="M130 690 C130 645 175 615 250 606 C330 598 400 596 470 600 C540 604 600 610 640 630 C668 645 676 672 670 690 L668 700 L150 702 C138 702 130 698 130 690 Z" fill="${c}"/>
    <path d="M262 612 C340 650 470 650 600 618" fill="none" stroke="${s}" stroke-width="6" stroke-linecap="round" opacity=".5"/>
    <path d="M276 624 C290 610 310 610 318 626 C306 640 286 640 276 624 Z" fill="${s}" opacity=".6"/>`,
  tenis: (c, s) => `
    <path d="M120 680 C120 630 160 600 230 590 C290 580 330 560 370 520 L420 470 C440 452 470 448 495 456 L600 490 C640 502 664 530 668 570 L672 650 L120 660 Z" fill="${c}"/>
    <path d="M110 655 L680 640 C690 640 696 650 694 664 L690 690 C688 700 680 704 670 704 L130 706 C116 706 108 696 110 684 Z" fill="${s}"/>
    <path d="M380 512 L470 560 M405 488 L495 535 M432 466 L520 512" stroke="${s}" stroke-width="10" stroke-linecap="round"/>
    <path d="M160 640 C260 610 420 600 660 610" fill="none" stroke="${s}" stroke-width="5" opacity=".5"/>`,
};

export const placeholderProducts = [
  ["stiletto-noir", "tacones", "#1c1a19", "#f3ece4"],
  ["pump-nude-satin", "tacones", "#d4ae93", "#f6efe8"],
  ["sandalia-luna-dorada", "sandalias", "#b08d57", "#f4eee6"],
  ["sandalia-aurora", "sandalias", "#8a4b3d", "#f5ede6"],
  ["bota-milano", "botas", "#3a2c26", "#efe7de"],
  ["botin-siena", "botas", "#8c5a3c", "#f3ebe2"],
  ["balerina-perla", "planos", "#f4ede4", "#dccbb8"],
  ["mocasin-roma", "planos", "#5b3a2e", "#f3ece4"],
  ["tenis-marfil", "tenis", "#f7f2ea", "#e5dbd0"],
  ["tenis-oro-rosa", "tenis", "#d9b9a0", "#f4ede6"],
];

function svg(kind, color, bg, variant) {
  const accent = "#ffffff";
  const sole = kind === "tenis" ? "#2a2522" : accent;
  const detail = kind === "tenis" ? sole : accent;
  const transform =
    variant === 0
      ? ""
      : `transform="translate(800 0) scale(-1 1) translate(-60 -120) scale(1.18)"`;
  const bg2 = variant === 0 ? bg : shade(bg, -8);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <rect width="800" height="1000" fill="${bg2}"/>
  <g transform="translate(0 ${kind === "botas" ? -60 : -140})">
  <ellipse cx="400" cy="712" rx="300" ry="22" fill="#000" opacity=".08"/>
  <g ${transform}>${shapes[kind](color, detail)}</g>
  </g>
</svg>`;
}

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (255 * pct) / 100)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

for (const [slug, kind, color, bg] of placeholderProducts) {
  for (const v of [0, 1]) {
    writeFileSync(join(out, `${slug}-${v + 1}.svg`), svg(kind, color, bg, v));
  }
}
console.log(`Generadas ${placeholderProducts.length * 2} ilustraciones en public/products`);
