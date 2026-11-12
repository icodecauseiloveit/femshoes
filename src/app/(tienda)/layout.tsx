import type { ReactNode } from "react";
import { CartDrawer } from "@/components/cart-drawer";
import { CartProvider } from "@/components/cart-provider";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { getCategories } from "@/lib/catalog";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const categories = await getCategories();
  return (
    <CartProvider>
      <Header categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer categories={categories} />
      <CartDrawer />
      <WhatsAppButton />
    </CartProvider>
  );
}
