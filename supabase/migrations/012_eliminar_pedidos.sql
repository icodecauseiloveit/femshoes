-- ============================================================
-- FemShoes · Eliminar pedidos (solo superadmin)
-- Ejecutar una sola vez después de 011_foto_portada.sql
--
-- Al eliminar un pedido:
--   * si ya había descontado inventario (confirmado o despachado), se pueden devolver
--     los pares (queda en el historial de productos como "Inventario");
--   * sus pagos se borran con él (order_payments tiene on delete cascade);
--   * queda una copia completa en order_deletions con motivo, usuario y fecha.
-- ============================================================

create table if not exists public.order_deletions (
  id bigint generated always as identity primary key,
  order_id uuid not null,
  order_number bigint not null,
  status text not null,
  snapshot jsonb not null,   -- el pedido completo y sus pagos tal como estaban
  restocked boolean not null default false,
  reason text not null,
  actor text not null,
  deleted_at timestamptz not null default now()
);
create index if not exists order_deletions_deleted_idx on public.order_deletions (deleted_at desc);

alter table public.order_deletions enable row level security;
drop policy if exists "Superadmin ve pedidos eliminados" on public.order_deletions;
create policy "Superadmin ve pedidos eliminados" on public.order_deletions
  for select using (public.is_superadmin());
revoke insert, update, delete on public.order_deletions from anon, authenticated;

create or replace function public.delete_order(p_order_id uuid, p_reason text, p_restock boolean, p_actor text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  pays jsonb;
  did_restock boolean := false;
begin
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Escribe el motivo de la eliminación';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  -- Devolver los pares al inventario (usa la misma lógica que cancelar el pedido)
  if o.stock_applied and p_restock then
    perform set_config('app.log_actor', coalesce(nullif(btrim(p_actor), ''), 'sistema'), true);
    perform set_config('app.log_source', 'pedido', true);
    perform set_config('app.log_reason',
      left('Pedido FS-' || lpad(o.number::text, 4, '0') || ' eliminado (devuelve inventario): ' || btrim(p_reason), 500), true);
    perform public.set_order_status(p_order_id, 'cancelado');
    did_restock := true;
  end if;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at), '[]'::jsonb) into pays
  from public.order_payments p where p.order_id = p_order_id;

  insert into public.order_deletions (order_id, order_number, status, snapshot, restocked, reason, actor)
  values (o.id, o.number, o.status, to_jsonb(o) || jsonb_build_object('payments', pays),
          did_restock, left(btrim(p_reason), 500), coalesce(nullif(btrim(p_actor), ''), 'sistema'));

  delete from public.orders where id = p_order_id;
end;
$$;

revoke all on function public.delete_order(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.delete_order(uuid, text, boolean, text) to service_role;
