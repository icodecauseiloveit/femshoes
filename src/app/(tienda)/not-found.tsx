import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <p className="eyebrow text-gold">Error 404</p>
      <h1 className="mt-3 text-4xl">No encontramos esta página</h1>
      <p className="mt-3 text-sm text-muted">Puede que el producto ya no esté disponible.</p>
      <Link href="/tienda" className="btn mt-7 bg-ink text-white">
        Ver colección
      </Link>
    </div>
  );
}
