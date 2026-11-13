import Image from "next/image";

type Props = {
  src?: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  fit?: "cover" | "contain"; // contain: muestra la foto completa sin recortar
};

/** Imagen de producto en proporción 4:5. Las ilustraciones SVG de ejemplo no se optimizan. */
export function ProductImage({ src, alt, sizes = "50vw", priority, className = "", fit = "cover" }: Props) {
  if (!src) {
    return <div className={`aspect-[4/5] w-full bg-mist ${className}`} aria-label={alt} />;
  }
  return (
    <div className={`relative aspect-[4/5] w-full overflow-hidden bg-mist ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={src.endsWith(".svg")}
        className={fit === "contain" ? "object-contain" : "object-cover"}
      />
    </div>
  );
}
