-- ============================================================
-- FemShoes · Foto de portada del producto
-- Ejecutar una sola vez después de 010_roles_personalizados.sql
--
-- Cada modelo puede tener una foto de portada propia (catálogo, inicio, categorías),
-- aparte de las fotos de cada color. Si no tiene, se usa la del primer color.
-- ============================================================

alter table public.products add column if not exists cover_image text;

-- El historial también registra cuando se cambia la portada
create or replace function public.product_changes(o public.products, n public.products)
returns jsonb
language plpgsql stable as $$
declare
  res jsonb := '[]'::jsonb;
  ov jsonb;
  nv jsonb;
  vid text;
  label text;
  s record;
begin
  -- Campos del modelo
  if o.name is distinct from n.name then res := res || jsonb_build_object('label', 'Nombre', 'from', o.name, 'to', n.name); end if;
  if o.slug is distinct from n.slug then res := res || jsonb_build_object('label', 'Enlace', 'from', o.slug, 'to', n.slug); end if;
  if o.category is distinct from n.category then res := res || jsonb_build_object('label', 'Categoría', 'from', o.category, 'to', n.category); end if;
  if o.description is distinct from n.description then res := res || jsonb_build_object('label', 'Descripción', 'from', o.description, 'to', n.description, 'kind', 'long'); end if;
  if o.material is distinct from n.material then res := res || jsonb_build_object('label', 'Materiales', 'from', o.material, 'to', n.material); end if;
  if o.price is distinct from n.price then res := res || jsonb_build_object('label', 'Precio', 'from', o.price, 'to', n.price, 'kind', 'money'); end if;
  if o.compare_at_price is distinct from n.compare_at_price then res := res || jsonb_build_object('label', 'Precio antes', 'from', o.compare_at_price, 'to', n.compare_at_price, 'kind', 'money'); end if;
  if o.active is distinct from n.active then res := res || jsonb_build_object('label', 'Visible en la tienda', 'from', o.active, 'to', n.active, 'kind', 'bool'); end if;
  if o.featured is distinct from n.featured then res := res || jsonb_build_object('label', 'Destacado', 'from', o.featured, 'to', n.featured, 'kind', 'bool'); end if;
  if o.is_new is distinct from n.is_new then res := res || jsonb_build_object('label', 'Nuevo', 'from', o.is_new, 'to', n.is_new, 'kind', 'bool'); end if;
  if o.cover_image is distinct from n.cover_image then
    res := res || jsonb_build_object('label', 'Foto de portada',
      'from', case when o.cover_image is null then 'sin portada' else 'foto anterior' end,
      'to', case when n.cover_image is null then 'sin portada' else 'foto nueva' end);
  end if;
  if o.shared_images is distinct from n.shared_images then
    res := res || jsonb_build_object('label', 'Fotos generales', 'from', coalesce(array_length(o.shared_images, 1), 0), 'to', coalesce(array_length(n.shared_images, 1), 0), 'kind', 'count');
  end if;

  -- Colores: agregados, quitados y cambios dentro de cada uno
  for vid in
    select distinct x ->> 'id' from jsonb_array_elements(coalesce(o.variants, '[]') || coalesce(n.variants, '[]')) x
  loop
    ov := null;
    nv := null;
    select x into ov from jsonb_array_elements(coalesce(o.variants, '[]')) x where x ->> 'id' = vid limit 1;
    select x into nv from jsonb_array_elements(coalesce(n.variants, '[]')) x where x ->> 'id' = vid limit 1;
    if ov is null then
      res := res || jsonb_build_object('label', 'Color agregado', 'to', (nv ->> 'color') || coalesce(' (' || (nv ->> 'code') || ')', ''));
    elsif nv is null then
      res := res || jsonb_build_object('label', 'Color eliminado', 'from', (ov ->> 'color') || coalesce(' (' || (ov ->> 'code') || ')', ''));
    else
      label := coalesce(nv ->> 'color', '');
      if ov ->> 'color' is distinct from nv ->> 'color' then res := res || jsonb_build_object('label', 'Nombre del color', 'from', ov ->> 'color', 'to', nv ->> 'color'); end if;
      if ov ->> 'hex' is distinct from nv ->> 'hex' then res := res || jsonb_build_object('label', 'Tono ' || label, 'from', ov ->> 'hex', 'to', nv ->> 'hex', 'kind', 'hex'); end if;
      if ov -> 'images' is distinct from nv -> 'images' then
        res := res || jsonb_build_object('label', 'Fotos ' || label, 'from', jsonb_array_length(coalesce(ov -> 'images', '[]')), 'to', jsonb_array_length(coalesce(nv -> 'images', '[]')), 'kind', 'count');
      end if;
      -- Pares por talla
      for s in
        select coalesce(a.size, b.size) as size, a.stock as was, b.stock as now
        from (select (x ->> 'size')::int size, (x ->> 'stock')::int stock from jsonb_array_elements(coalesce(ov -> 'sizes', '[]')) x) a
        full join (select (x ->> 'size')::int size, (x ->> 'stock')::int stock from jsonb_array_elements(coalesce(nv -> 'sizes', '[]')) x) b
          on a.size = b.size
        where a.stock is distinct from b.stock
        order by 1
      loop
        res := res || jsonb_build_object('label', 'Pares ' || label || ' talla ' || s.size, 'from', s.was, 'to', s.now, 'kind', 'stock');
      end loop;
    end if;
  end loop;
  return res;
end;
$$;
