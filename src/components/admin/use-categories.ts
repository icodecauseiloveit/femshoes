"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultCategories, type Category } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";

type Row = { slug: string; label: string; sort_order: number; active: boolean; code?: string | null };

/** Categorías para el panel (incluye las ocultas). En modo de ejemplo usa las categorías por defecto. */
export function useAdminCategories() {
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("categories").select("*").order("sort_order", { ascending: true });
    if (error) setError(error.message);
    else {
      setError("");
      setCategories(
        (data as Row[]).map((r) => ({ slug: r.slug, label: r.label, sortOrder: r.sort_order, active: r.active, code: r.code ?? undefined })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  return { categories, loading, error, reload };
}
