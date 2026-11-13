import { legacyVariants, withSummary, type Product, type ProductColor, type ProductInput, type SizeStock } from "./types";

type Sample = Omit<ProductInput, "variants" | "sharedImages"> & { id: string; colors: ProductColor[]; sizes: SizeStock[]; images: string[] };

// Productos de ejemplo que se muestran mientras Supabase no esté conectado.
const sizes = (stock: Record<number, number>): SizeStock[] =>
  Object.entries(stock).map(([size, s]) => ({ size: Number(size), stock: s }));

const imgs = (slug: string) => [`/products/${slug}-1.svg`, `/products/${slug}-2.svg`];

const samples: Sample[] = [
  {
    id: "ej-1",
    slug: "stiletto-noir",
    name: "Stiletto Noir",
    category: "tacones",
    description:
      "El clásico que nunca falla. Punta fina, tacón de 10 cm y un acabado en charol que eleva cualquier look, de la oficina a la noche.",
    material: "Charol de cuero · Plantilla acolchada · Suela de cuero",
    price: 389900,
    compareAtPrice: null,
    colors: [{ name: "Negro", hex: "#1c1a19" }],
    sizes: sizes({ 35: 2, 36: 4, 37: 5, 38: 3, 39: 2, 40: 0 }),
    images: imgs("stiletto-noir"),
    featured: true,
    isNew: false,
    active: true,
  },
  {
    id: "ej-2",
    slug: "pump-nude-satin",
    name: "Pump Nude Satin",
    category: "tacones",
    description:
      "Tono nude que alarga visualmente la pierna. Satín suave al tacto, tacón de 8 cm y horma cómoda para eventos largos.",
    material: "Satín · Forro en cuero · Tacón forrado",
    price: 349900,
    compareAtPrice: 419900,
    colors: [{ name: "Nude", hex: "#d4ae93" }],
    sizes: sizes({ 35: 1, 36: 3, 37: 3, 38: 2, 39: 1 }),
    images: imgs("pump-nude-satin"),
    featured: true,
    isNew: true,
    active: true,
  },
  {
    id: "ej-3",
    slug: "sandalia-luna-dorada",
    name: "Sandalia Luna Dorada",
    category: "sandalias",
    description:
      "Tiras finas en metalizado dorado y tacón de 9 cm. La pieza perfecta para bodas, grados y noches de verano en la costa.",
    material: "Cuero metalizado · Hebilla ajustable",
    price: 329900,
    compareAtPrice: null,
    colors: [{ name: "Dorado", hex: "#b08d57" }],
    sizes: sizes({ 35: 2, 36: 2, 37: 4, 38: 4, 39: 2, 40: 1 }),
    images: imgs("sandalia-luna-dorada"),
    featured: true,
    isNew: true,
    active: true,
  },
  {
    id: "ej-4",
    slug: "sandalia-aurora",
    name: "Sandalia Aurora",
    category: "sandalias",
    description:
      "Diseño de tiras cruzadas en cuero color terracota. Tacón medio de 7 cm, ideal para el día a día con un toque sofisticado.",
    material: "Cuero napa · Suela antideslizante",
    price: 279900,
    compareAtPrice: 319900,
    colors: [{ name: "Terracota", hex: "#8a4b3d" }],
    sizes: sizes({ 36: 2, 37: 3, 38: 3, 39: 1 }),
    images: imgs("sandalia-aurora"),
    featured: false,
    isNew: false,
    active: true,
  },
  {
    id: "ej-5",
    slug: "bota-milano",
    name: "Bota Milano",
    category: "botas",
    description:
      "Bota a media pierna en cuero chocolate, cremallera interna y tacón bloque de 6 cm. Elegancia y firmeza en cada paso.",
    material: "Cuero liso · Forro textil · Tacón bloque",
    price: 459900,
    compareAtPrice: null,
    colors: [{ name: "Chocolate", hex: "#3a2c26" }],
    sizes: sizes({ 35: 1, 36: 2, 37: 3, 38: 3, 39: 2, 40: 1 }),
    images: imgs("bota-milano"),
    featured: true,
    isNew: false,
    active: true,
  },
  {
    id: "ej-6",
    slug: "botin-siena",
    name: "Botín Siena",
    category: "botas",
    description:
      "Botín en gamuza color camel con caña ajustada. Combina con jeans, vestidos y faldas midi.",
    material: "Gamuza · Plantilla memory foam",
    price: 399900,
    compareAtPrice: 449900,
    colors: [{ name: "Camel", hex: "#8c5a3c" }],
    sizes: sizes({ 36: 2, 37: 2, 38: 3, 39: 2 }),
    images: imgs("botin-siena"),
    featured: false,
    isNew: true,
    active: true,
  },
  {
    id: "ej-7",
    slug: "balerina-perla",
    name: "Balerina Perla",
    category: "planos",
    description:
      "Balerina en cuero perlado con moño delicado. Ligera, flexible y lista para acompañarte todo el día.",
    material: "Cuero perlado · Suela flexible",
    price: 229900,
    compareAtPrice: null,
    colors: [{ name: "Perla", hex: "#f4ede4" }],
    sizes: sizes({ 35: 3, 36: 4, 37: 5, 38: 4, 39: 2, 40: 1 }),
    images: imgs("balerina-perla"),
    featured: false,
    isNew: false,
    active: true,
  },
  {
    id: "ej-8",
    slug: "mocasin-roma",
    name: "Mocasín Roma",
    category: "planos",
    description:
      "Mocasín de inspiración italiana en cuero café, con costuras a mano. Un básico atemporal con actitud.",
    material: "Cuero graso · Costura a mano",
    price: 269900,
    compareAtPrice: null,
    colors: [{ name: "Café", hex: "#5b3a2e" }],
    sizes: sizes({ 36: 2, 37: 3, 38: 3, 39: 2, 40: 1 }),
    images: imgs("mocasin-roma"),
    featured: false,
    isNew: false,
    active: true,
  },
  {
    id: "ej-9",
    slug: "tenis-marfil",
    name: "Tenis Marfil",
    category: "tenis",
    description:
      "Tenis minimalistas en cuero marfil con suela en contraste. Comodidad premium para tu ritmo urbano.",
    material: "Cuero · Suela de caucho · Plantilla removible",
    price: 299900,
    compareAtPrice: null,
    colors: [{ name: "Marfil", hex: "#f7f2ea" }],
    sizes: sizes({ 35: 3, 36: 4, 37: 5, 38: 5, 39: 3, 40: 2, 41: 1 }),
    images: imgs("tenis-marfil"),
    featured: true,
    isNew: true,
    active: true,
  },
  {
    id: "ej-10",
    slug: "tenis-oro-rosa",
    name: "Tenis Oro Rosa",
    category: "tenis",
    description:
      "El tono oro rosa que ilumina tus outfits casuales. Cuero suave y suela ligera para caminar sin pausa.",
    material: "Cuero metalizado · Suela EVA",
    price: 309900,
    compareAtPrice: 359900,
    colors: [{ name: "Oro rosa", hex: "#d9b9a0" }],
    sizes: sizes({ 35: 0, 36: 2, 37: 3, 38: 2, 39: 1 }),
    images: imgs("tenis-oro-rosa"),
    featured: false,
    isNew: false,
    active: true,
  },
];

export const sampleProducts: Product[] = samples.map(({ colors, sizes, images, ...rest }) => {
  const variants = legacyVariants(colors, sizes, images);
  // Ejemplo de un modelo con dos colores, cada uno con sus fotos y tallas
  if (rest.slug === "stiletto-noir") {
    variants.push({
      id: "v2",
      color: "Nude",
      hex: "#d4ae93",
      images: imgs("pump-nude-satin"),
      sizes: [
        { size: 35, stock: 0 },
        { size: 36, stock: 2 },
        { size: 37, stock: 1 },
        { size: 38, stock: 0 },
        { size: 39, stock: 3 },
      ],
    });
  }
  return withSummary({ ...rest, variants, sharedImages: [] });
});
