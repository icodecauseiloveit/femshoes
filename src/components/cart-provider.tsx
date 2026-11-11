"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  size: number;
  color: string;
  image: string;
  qty: number;
  maxQty: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  ready: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (productId: string, size: number, qty: number) => void;
  remove: (productId: string, size: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "femshoes-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Cargar el carrito guardado en este teléfono
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setItems(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, ready]);

  const add = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId && i.size === item.size);
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, qty: Math.min(i.qty + qty, item.maxQty) } : i,
        );
      }
      return [...prev, { ...item, qty: Math.min(qty, item.maxQty) }];
    });
    setIsOpen(true);
  }, []);

  const setQty = useCallback((productId: string, size: number, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.productId === productId && i.size === size
            ? { ...i, qty: Math.max(0, Math.min(qty, i.maxQty)) }
            : i,
        )
        .filter((i) => i.qty > 0),
    );
  }, []);

  const remove = useCallback((productId: string, size: number) => {
    setItems((prev) => prev.filter((i) => !(i.productId === productId && i.size === size)));
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.qty * i.price, 0),
      ready,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add,
      setQty,
      remove,
      clear: () => setItems([]),
    }),
    [items, ready, isOpen, add, setQty, remove],
  );

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart() {
  const ctx = use(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
