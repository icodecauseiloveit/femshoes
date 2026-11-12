-- 005: variantes por color (fotos y existencias por talla de cada color)
--
-- products.variants = [{ "id": "a1b2c3d4", "color": "Negro", "hex": "#111111",
--                        "images": ["https://..."], "sizes": [{"size": 37, "stock": 4}] }]
--
-- Las columnas colors, sizes e images se conservan como resumen (tallas sumadas entre
-- colores), así la tienda anterior sigue funcionando mientras se despliega la nueva.

alter table public.products
  add column if not exists variants jsonb not null default '[]'::jsonb;

-- Productos existentes: el primer color se queda con las fotos y el inventario; los demás
-- colores (si los hay) quedan con las mismas fotos y sin existencias para repartirlas en /admin.
update public.products p
set variants = (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', 'v' || c.ord,
      'color', coalesce(nullif(trim(c.value ->> 'name'), ''), 'Único'),
      'hex', coalesce(nullif(c.value ->> 'hex', ''), '#141210'),
      'images', to_jsonb(p.images),
      'sizes', case when c.ord = 1 then p.sizes
                    else coalesce((select jsonb_agg(jsonb_build_object('size', (s ->> 'size')::int, 'stock', 0))
                                   from jsonb_array_elements(p.sizes) s), '[]'::jsonb) end
    ) order by c.ord), '[]'::jsonb)
  from (
    select value, ord from jsonb_array_elements(
      case when jsonb_array_length(p.colors) > 0 then p.colors
           else '[{"name":"Único","hex":"#141210"}]'::jsonb end
    ) with ordinality as t(value, ord)
  ) c
)
where jsonb_array_length(p.variants) = 0;

-- Recalcula el resumen de tallas (suma entre colores) a partir de las variantes
create or replace function public.product_sizes_summary(v jsonb)
returns jsonb
language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('size', size, 'stock', stock) order by size), '[]'::jsonb)
  from (
    select (s ->> 'size')::int as size, sum((s ->> 'stock')::int)::int as stock
    from jsonb_array_elements(v) var, jsonb_array_elements(var -> 'sizes') s
    group by 1
  ) t;
$$;

-- Índice de la variante de un renglón del pedido: por id, luego por nombre del color.
-- Los pedidos anteriores a esta migración (sin variantId) usan el primer color, que es
-- el que recibió todo el inventario al migrar.
create or replace function public.order_item_variant_index(p_variants jsonb, p_item jsonb)
returns integer
language sql immutable as $$
  select coalesce(
    (select (ord - 1)::int from jsonb_array_elements(p_variants) with ordinality v(val, ord)
      where val ->> 'id' = p_item ->> 'variantId' limit 1),
    (select (ord - 1)::int from jsonb_array_elements(p_variants) with ordinality v(val, ord)
      where lower(trim(val ->> 'color')) = lower(trim(p_item ->> 'color')) limit 1),
    case when p_item ->> 'variantId' is null and jsonb_array_length(p_variants) > 0 then 0 end
  );
$$;

create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  item jsonb;
  want_applied boolean := p_status in ('confirmado', 'despachado');
  prod public.products%rowtype;
  vi integer;
  current_stock integer;
  delta integer;
  new_variants jsonb;
begin
  if p_status not in ('pendiente', 'confirmado', 'despachado', 'cancelado') then
    raise exception 'Estado no válido';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if want_applied and not o.stock_applied then
    -- Verificar existencias (color + talla) de todos los pares antes de descontar
    for item in select * from jsonb_array_elements(o.items) loop
      select * into prod from public.products where id = (item ->> 'productId')::uuid for update;
      if not found then
        raise exception 'El producto % ya no existe', item ->> 'name';
      end if;
      vi := public.order_item_variant_index(prod.variants, item);
      if vi is null then
        raise exception 'El color % de % ya no existe', item ->> 'color', prod.name;
      end if;
      select coalesce((
        select (s ->> 'stock')::int from jsonb_array_elements(prod.variants -> vi -> 'sizes') s
        where (s ->> 'size')::int = (item ->> 'size')::int
      ), 0) into current_stock;
      if current_stock < (item ->> 'qty')::int then
        raise exception 'Stock insuficiente: % % talla % (quedan %)',
          prod.name, prod.variants -> vi ->> 'color', item ->> 'size', current_stock;
      end if;
    end loop;
    delta := -1;
  elsif not want_applied and o.stock_applied then
    delta := 1;
  end if;

  if delta is not null then
    for item in select * from jsonb_array_elements(o.items) loop
      select * into prod from public.products where id = (item ->> 'productId')::uuid for update;
      if not found then
        continue; -- al devolver, si el producto ya no existe no hay a dónde devolver
      end if;
      vi := public.order_item_variant_index(prod.variants, item);
      if vi is null then
        continue;
      end if;
      new_variants := jsonb_set(
        prod.variants,
        array[vi::text, 'sizes'],
        coalesce((
          select jsonb_agg(
            case when (s ->> 'size')::int = (item ->> 'size')::int
              then jsonb_set(s, '{stock}', to_jsonb(greatest(0, (s ->> 'stock')::int + delta * (item ->> 'qty')::int)))
              else s end)
          from jsonb_array_elements(prod.variants -> vi -> 'sizes') s
        ), '[]'::jsonb)
      );
      update public.products
      set variants = new_variants, sizes = public.product_sizes_summary(new_variants)
      where id = prod.id;
    end loop;
    o.stock_applied := (delta = -1);
  end if;

  update public.orders
  set status = p_status, stock_applied = o.stock_applied
  where id = p_order_id;
end;
$$;

-- Solo el servidor (service role) puede cambiar estados
revoke all on function public.set_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, text) to service_role;
