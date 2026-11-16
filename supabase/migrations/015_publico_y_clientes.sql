-- ============================================================
-- ChuzChuz (antes FemShoes) · Público por producto y permisos "clientes"
-- Ejecutar una sola vez después de 014_permiso_eliminar_clientas.sql
--
-- * products.audiences: para quién es cada producto (uno o varios):
--   mujeres, hombres, ninas, ninos. Los productos actuales quedan como "mujeres".
-- * Los permisos clientas / clientas_eliminar pasan a llamarse clientes / clientes_eliminar.
-- * El historial registra los cambios de público.
-- ============================================================

alter table public.products add column if not exists audiences text[] not null default '{}';
alter table public.products drop constraint if exists products_audiences_check;
alter table public.products add constraint products_audiences_check
  check (audiences <@ array['mujeres', 'hombres', 'ninas', 'ninos']::text[]);
create index if not exists products_audiences_idx on public.products using gin (audiences);

-- Los productos que ya existen eran de mujer
update public.products set audiences = array['mujeres'] where audiences = '{}';

-- Permisos: clientas -> clientes
alter table public.roles drop constraint if exists roles_permissions_check;
update public.roles
set permissions = array_replace(array_replace(permissions, 'clientas_eliminar', 'clientes_eliminar'), 'clientas', 'clientes'),
    updated_at = now()
where permissions && array['clientas', 'clientas_eliminar']::text[];
alter table public.roles add constraint roles_permissions_check check (
  permissions <@ array['productos', 'productos_publicar', 'productos_eliminar', 'categorias',
                       'pedidos', 'despachos', 'clientes', 'clientes_eliminar']::text[]
);

-- El historial también registra el público
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
  if o.audiences is distinct from n.audiences then
    res := res || jsonb_build_object('label', 'Público',
      'from', (select coalesce(string_agg(case x when 'mujeres' then 'Mujeres' when 'hombres' then 'Hombres' when 'ninas' then 'Niñas' when 'ninos' then 'Niños' else x end, ', '), 'sin público') from unnest(o.audiences) x),
      'to', (select coalesce(string_agg(case x when 'mujeres' then 'Mujeres' when 'hombres' then 'Hombres' when 'ninas' then 'Niñas' when 'ninos' then 'Niños' else x end, ', '), 'sin público') from unnest(n.audiences) x));
  end if;
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
