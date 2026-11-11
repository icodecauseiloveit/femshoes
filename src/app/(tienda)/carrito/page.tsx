import type { Metadata } from "next";
import { Checkout } from "@/components/checkout";

export const metadata: Metadata = { title: "Finalizar pedido" };

export default function CartPage() {
  return <Checkout />;
}
