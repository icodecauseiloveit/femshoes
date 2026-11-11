-- ============================================================
-- FemShoes · Pedidos y rol distribuidor
-- Ejecutar una sola vez después de 002_roles.sql
-- ============================================================

-- 1) Nuevo rol: distribuidor (solo ve pedidos confirmados, sin precios ni datos de la clienta)
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check
  check (role in ('superadmin', 'admin', 'distribuidor'));

-- El catálogo y las fotos solo los gestionan superadmin y admin (no el distribuidor)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where email = auth.jwt() ->> 'email' and role in ('superadmin', 'admin')
  );
$$;

-- 2) Pedidos
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'confirmado', 'despachado', 'cancelado')),
  customer_name text not null,
  customer_phone text not null,
  city text not null,
  address text not null,
  neighborhood text not null default '',
  payment_method text not null default '',
  notes text not null default '',
  items jsonb not null,            -- [{productId, slug, name, image, size, color, qty, price}]
  total_pairs integer not null,
  subtotal integer not null,       -- COP
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create index if not exists orders_status_created_idx on public.orders (status, created_at desc);

-- Sin políticas: nadie lee ni escribe pedidos con la llave pública.
-- Todo pasa por el servidor de la tienda (service role), que filtra según el rol.
alter table public.orders enable row level security;

-- 3) Inventario: se descuenta al confirmar y se devuelve al cancelar o volver a pendiente
alter table public.orders add column if not exists stock_applied boolean not null default false;

create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  item jsonb;
  want_applied boolean := p_status in ('confirmado', 'despachado');
  current_stock integer;
  product_name text;
begin
  if p_status not in ('pendiente', 'confirmado', 'despachado', 'cancelado') then
    raise exception 'Estado no válido';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if want_applied and not o.stock_applied then
    -- Verificar existencias de todos los pares antes de descontar
    for item in select * from jsonb_array_elements(o.items) loop
      select p.name, coalesce((
        select (s ->> 'stock')::int from jsonb_array_elements(p.sizes) s
        where (s ->> 'size')::int = (item ->> 'size')::int
      ), 0)
      into product_name, current_stock
      from public.products p
      where p.id = (item ->> 'productId')::uuid
      for update;

      if product_name is null then
        raise exception 'El producto % ya no existe', item ->> 'name';
      end if;
      if current_stock < (item ->> 'qty')::int then
        raise exception 'Stock insuficiente: % talla % (quedan %)', product_name, item ->> 'size', current_stock;
      end if;
    end loop;

    for item in select * from jsonb_array_elements(o.items) loop
      update public.products p set sizes = (
        select jsonb_agg(
          case when (s ->> 'size')::int = (item ->> 'size')::int
            then jsonb_set(s, '{stock}', to_jsonb((s ->> 'stock')::int - (item ->> 'qty')::int))
            else s end)
        from jsonb_array_elements(p.sizes) s)
      where p.id = (item ->> 'productId')::uuid;
    end loop;
    o.stock_applied := true;

  elsif not want_applied and o.stock_applied then
    -- Devolver los pares al inventario (si el producto aún existe)
    for item in select * from jsonb_array_elements(o.items) loop
      update public.products p set sizes = (
        select jsonb_agg(
          case when (s ->> 'size')::int = (item ->> 'size')::int
            then jsonb_set(s, '{stock}', to_jsonb((s ->> 'stock')::int + (item ->> 'qty')::int))
            else s end)
        from jsonb_array_elements(p.sizes) s)
      where p.id = (item ->> 'productId')::uuid;
    end loop;
    o.stock_applied := false;
  end if;

  update public.orders
  set status = p_status, stock_applied = o.stock_applied
  where id = p_order_id;
end;
$$;

-- Solo el servidor (service role) puede cambiar estados
revoke all on function public.set_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, text) to service_role;
