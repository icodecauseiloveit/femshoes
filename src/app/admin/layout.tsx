import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { store } from "@/lib/config";

export const metadata: Metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/admin" className="font-display text-xl tracking-[0.08em]">
            {store.name.toUpperCase()} <span className="eyebrow ml-1 text-[0.6rem] text-muted">Admin</span>
          </Link>
          <Link href="/" className="eyebrow text-[0.62rem] text-ink-soft">
            Ver tienda →
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
