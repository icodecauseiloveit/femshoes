-- 007: base de clientas, pagos de pedidos y cartera
--
-- * customers: una ficha por clienta, identificada por su celular (solo dígitos).
--   Cada pedido nuevo se vincula solo a su clienta (o la crea).
-- * orders: envío, descuento, total, fecha de despacho y autorización de mercadeo.
--   total = subtotal (productos) + envío - descuento
-- * order_payments: pagos y abonos de cada pedido. saldo = total - pagos.
--   La clienta paga al recibir el producto a conformidad, por eso la cartera se cuenta
--   desde la fecha de despacho.
--
-- Todo se maneja desde el servidor (service role); RLS activo sin políticas públicas.

-- ---------- Clientas ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^[0-9]{7,15}$'),
  name text not null default '',
  document_type text not null default '' check (document_type in ('', 'CC', 'CE', 'NIT', 'PAS')),
  document_number text not null default '',
  email text not null default '',
  city text not null default '',
  address text not null default '',
  neighborhood text not null default '',
  birthday date,
  tags text[] not null default '{}',
  notes text not null default '',
  marketing_consent_at timestamptz, -- autorizó recibir novedades y ofertas
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;

drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

-- Celular solo con dígitos; los números colombianos de 10 dígitos llevan el 57 delante
create or replace function public.normalize_phone(p text)
returns text
language sql immutable as $$
  select case
    when d ~ '^3[0-9]{9}$' then '57' || d
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x;
$$;

-- ---------- Pedidos: campos comerciales ----------
alter table public.orders add column if not exists customer_id uuid references public.customers (id) on delete set null;
alter table public.orders add column if not exists shipping_cost integer not null default 0 check (shipping_cost >= 0);
alter table public.orders add column if not exists discount integer not null default 0 check (discount >= 0);
alter table public.orders add column if not exists dispatched_at timestamptz;
alter table public.orders add column if not exists marketing_consent boolean not null default false;
alter table public.orders add column if not exists total integer generated always as (greatest(0, subtotal + shipping_cost - discount)) stored;

create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);

-- Vincula cada pedido nuevo a su clienta por el celular (la crea si no existe)
create or replace function public.orders_link_customer()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ph text := public.normalize_phone(new.customer_phone);
  cid uuid;
begin
  if new.customer_id is null and ph ~ '^[0-9]{7,15}$' then
    insert into public.customers (phone, name, city, address, neighborhood, marketing_consent_at)
    values (ph, new.customer_name, new.city, new.address, new.neighborhood,
            case when new.marketing_consent then now() end)
    on conflict (phone) do update set
      -- Se conservan los datos editados en /admin; solo se completan los vacíos
      name = case when public.customers.name = '' then excluded.name else public.customers.name end,
      city = excluded.city,
      address = excluded.address,
      neighborhood = excluded.neighborhood,
      marketing_consent_at = coalesce(public.customers.marketing_consent_at, excluded.marketing_consent_at)
    returning id into cid;
    new.customer_id := cid;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_link_customer on public.orders;
create trigger orders_link_customer before insert on public.orders
  for each row execute function public.orders_link_customer();

-- Pedidos existentes: crear y vincular sus clientas (del más antiguo al más reciente)
do $$
declare
  o record;
  ph text;
  cid uuid;
begin
  for o in select * from public.orders where customer_id is null order by created_at loop
    ph := public.normalize_phone(o.customer_phone);
    continue when ph !~ '^[0-9]{7,15}$';
    insert into public.customers (phone, name, city, address, neighborhood, created_at)
    values (ph, o.customer_name, o.city, o.address, o.neighborhood, o.created_at)
    on conflict (phone) do update set
      name = excluded.name, city = excluded.city, address = excluded.address, neighborhood = excluded.neighborhood
    returning id into cid;
    update public.orders set customer_id = cid where id = o.id;
  end loop;
end $$;

-- Fecha de despacho: la cartera empieza a contar desde que la clienta recibe el producto
create or replace function public.orders_dispatch_date()
returns trigger
language plpgsql as $$
begin
  if new.status = 'despachado' and old.status is distinct from 'despachado' then
    new.dispatched_at := coalesce(new.dispatched_at, now());
  elsif new.status in ('pendiente', 'confirmado') then
    new.dispatched_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_dispatch_date on public.orders;
create trigger orders_dispatch_date before update of status on public.orders
  for each row execute function public.orders_dispatch_date();

update public.orders set dispatched_at = updated_at where status = 'despachado' and dispatched_at is null;

-- ---------- Pagos ----------
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount integer not null check (amount > 0),
  paid_at date not null default ((now() at time zone 'America/Bogota')::date),
  method text not null default '',
  reference text not null default '',
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists order_payments_order_idx on public.order_payments (order_id);
alter table public.order_payments enable row level security;

-- Resumen financiero por pedido: total, pagado y saldo
create or replace view public.order_balances with (security_invoker = true) as
select
  o.id as order_id,
  o.customer_id,
  o.status,
  o.total,
  coalesce(p.paid, 0)::integer as paid,
  (o.total - coalesce(p.paid, 0))::integer as balance,
  p.last_paid_at
from public.orders o
left join (
  select order_id, sum(amount) as paid, max(paid_at) as last_paid_at
  from public.order_payments group by order_id
) p on p.order_id = o.id;

revoke all on public.customers, public.order_payments, public.order_balances from anon, authenticated;
