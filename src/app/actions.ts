"use server";

import { updateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";

/** Refresca el catálogo de la tienda después de guardar cambios en /admin. */
export async function refreshCatalog() {
  updateTag(CATALOG_TAG);
}
