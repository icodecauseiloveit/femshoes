-- 009: historial (log) de productos
--
-- Cada creación, edición, cambio de visibilidad, movimiento de inventario por pedidos y
-- eliminación queda registrado con: qué cambió (antes → después), motivo, usuario y fecha.
-- Lo escribe la base de datos con triggers, así ningún cambio se escapa del historial.
--
-- Cómo llega el motivo:
--  * Al guardar desde /admin, el panel envía products.change_reason; un trigger lo pasa al
--    historial y lo deja vacío en el producto.
--  * Para eliminar se usa delete_product(id, motivo).
--  * Los pedidos usan set_order_status(id, estado, usuario), que anota el pedido como motivo.

create table if not exists public.product_logs (
  id bigint generated always as identity primary key,
  product_id uuid,                 -- sin llave foránea: el historial se conserva aunque se borre el producto
  product_code text,
  product_name text not null default '',
  action text not null check (action in ('creado', 'editado', 'ocultado', 'publicado', 'inventario', 'eliminado')),
  changes jsonb not null default '[]',   -- [{ "label": "Precio", "from": 112300, "to": 109000, "kind": "money" }]
  reason text,
  actor text not null default 'sistema', -- correo de quien hizo el cambio
  actor_role text,
  snapshot jsonb,                  -- producto completo al crearlo o eliminarlo
  created_at timestamptz not null default now()
);

create index if not exists product_logs_product_idx on public.product_logs (product_id, created_at desc);
create index if not exists product_logs_created_idx on public.product_logs (created_at desc);

alter table public.product_logs enable row level security;
drop policy if exists "Equipo ve el historial" on public.product_logs;
create policy "Equipo ve el historial" on public.product_logs for select using (public.is_admin());
revoke insert, update, delete on public.product_logs from anon, authenticated;

alter table public.products add column if not exists change_reason text;

-- ---------- Cambios legibles entre dos versiones de un producto ----------
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

-- ---------- Triggers ----------
-- Antes de guardar: toma el motivo enviado por el panel y lo deja vacío en el producto
create or replace function public.products_take_reason()
returns trigger
language plpgsql as $$
begin
  if coalesce(trim(new.change_reason), '') <> '' then
    perform set_config('app.log_reason', left(trim(new.change_reason), 500), true);
  end if;
  new.change_reason := null;
  return new;
end;
$$;

drop trigger if exists products_take_reason on public.products;
create trigger products_take_reason before insert or update on public.products
  for each row execute function public.products_take_reason();

-- Después de guardar o borrar: escribe el historial
create or replace function public.products_write_log()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ch jsonb;
  act text;
  who text := coalesce(nullif(current_setting('app.log_actor', true), ''), auth.jwt() ->> 'email', 'sistema');
  why text := nullif(current_setting('app.log_reason', true), '');
  rol text;
  only_stock boolean;
begin
  select role into rol from public.admins where email = lower(who);

  if tg_op = 'INSERT' then
    insert into public.product_logs (product_id, product_code, product_name, action, reason, actor, actor_role, snapshot)
    values (new.id, new.code, new.name, 'creado', why, who, rol, to_jsonb(new) - 'change_reason');
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.product_logs (product_id, product_code, product_name, action, reason, actor, actor_role, snapshot)
    values (old.id, old.code, old.name, 'eliminado', why, who, rol, to_jsonb(old) - 'change_reason');
    return old;
  end if;

  ch := public.product_changes(old, new);
  if jsonb_array_length(ch) = 0 then
    return new; -- nada relevante cambió (por ejemplo, solo la fecha de actualización)
  end if;

  select bool_and((c ->> 'kind') = 'stock') into only_stock from jsonb_array_elements(ch) c;
  act := case
    when only_stock and current_setting('app.log_source', true) = 'pedido' then 'inventario'
    when jsonb_array_length(ch) = 1 and ch -> 0 ->> 'label' = 'Visible en la tienda' then
      case when new.active then 'publicado' else 'ocultado' end
    else 'editado'
  end;

  insert into public.product_logs (product_id, product_code, product_name, action, changes, reason, actor, actor_role)
  values (new.id, new.code, new.name, act, ch, why, who, rol);
  return new;
end;
$$;

drop trigger if exists products_write_log on public.products;
create trigger products_write_log after insert or update or delete on public.products
  for each row execute function public.products_write_log();

-- ---------- Eliminar con motivo ----------
create or replace function public.delete_product(p_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'No tienes permiso para eliminar productos';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Escribe el motivo de la eliminación';
  end if;
  perform set_config('app.log_reason', left(trim(p_reason), 500), true);
  delete from public.products where id = p_id;
  if not found then
    raise exception 'El producto no existe';
  end if;
end;
$$;

revoke all on function public.delete_product(uuid, text) from public, anon;
grant execute on function public.delete_product(uuid, text) to authenticated;

-- ---------- Pedidos: quién movió el inventario y por qué ----------
create or replace function public.set_order_status(p_order_id uuid, p_status text, p_actor text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  num bigint;
begin
  select number into num from public.orders where id = p_order_id;
  perform set_config('app.log_actor', coalesce(nullif(trim(p_actor), ''), 'sistema'), true);
  perform set_config('app.log_source', 'pedido', true);
  perform set_config('app.log_reason',
    'Pedido FS-' || lpad(coalesce(num, 0)::text, 4, '0') || ' pasó a ' || p_status ||
    case when p_status in ('confirmado', 'despachado') then ' (descuenta inventario)' else ' (devuelve inventario)' end,
    true);
  perform public.set_order_status(p_order_id, p_status);
end;
$$;

revoke all on function public.set_order_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, text, text) to service_role;
