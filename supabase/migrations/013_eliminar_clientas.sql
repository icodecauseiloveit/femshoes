-- ============================================================
-- FemShoes · Eliminar clientas (solo superadmin)
-- Ejecutar una sola vez después de 012_eliminar_pedidos.sql
--
-- Se borra la ficha de la clienta (documento, correo, cumpleaños, etiquetas, notas y
-- autorización de mensajes). Sus pedidos se conservan: quedan sin vincular
-- (orders.customer_id pasa a null) con el nombre y celular escritos en cada pedido,
-- y siguen en la cartera. Si vuelve a comprar, se crea una ficha nueva.
-- La constancia no guarda datos personales: solo motivo, usuario, fecha y cuántos pedidos tenía.
-- ============================================================

create table if not exists public.customer_deletions (
  id bigint generated always as identity primary key,
  customer_id uuid not null,
  orders_count integer not null default 0,
  reason text not null,
  actor text not null,
  deleted_at timestamptz not null default now()
);

alter table public.customer_deletions enable row level security;
drop policy if exists "Superadmin ve clientas eliminadas" on public.customer_deletions;
create policy "Superadmin ve clientas eliminadas" on public.customer_deletions
  for select using (public.is_superadmin());
revoke insert, update, delete on public.customer_deletions from anon, authenticated;

create or replace function public.delete_customer(p_customer_id uuid, p_reason text, p_actor text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Escribe el motivo de la eliminación';
  end if;
  perform 1 from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'Clienta no encontrada';
  end if;
  select count(*) into n from public.orders where customer_id = p_customer_id;

  insert into public.customer_deletions (customer_id, orders_count, reason, actor)
  values (p_customer_id, n, left(btrim(p_reason), 500), coalesce(nullif(btrim(p_actor), ''), 'sistema'));

  delete from public.customers where id = p_customer_id; -- los pedidos quedan con customer_id null
end;
$$;

revoke all on function public.delete_customer(uuid, text, text) from public, anon, authenticated;
grant execute on function public.delete_customer(uuid, text, text) to service_role;
