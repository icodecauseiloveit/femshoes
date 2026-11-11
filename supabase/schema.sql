-- ============================================================
-- FemShoes · Esquema de base de datos para Supabase
-- Ejecuta este archivo completo en: Supabase > SQL Editor > New query
-- ============================================================

-- 1) Tabla de productos
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (category in ('tacones','sandalias','botas','planos','tenis')),
  description text default '',
  material text default '',
  price integer not null check (price >= 0),           -- en pesos colombianos (COP)
  compare_at_price integer check (compare_at_price >= 0), -- precio antes del descuento (opcional)
  colors jsonb not null default '[]',   -- [{"name":"Negro","hex":"#111111"}]
  sizes jsonb not null default '[]',    -- [{"size":36,"stock":3}]
  images text[] not null default '{}',  -- URLs públicas de las fotos
  featured boolean not null default false,
  is_new boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- 2) Equipo: solo estos correos pueden entrar a /admin
--    role: 'superadmin' (productos + usuarios) o 'admin' (solo productos)
--    Después de este archivo ejecuta también migrations/002_roles.sql
create table if not exists public.admins (
  email text primary key
);

-- >>> CAMBIA ESTE CORREO por el de la cuenta que usarás en /admin <<<
insert into public.admins (email) values ('tu-correo@ejemplo.com') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = auth.jwt() ->> 'email');
$$;

-- 3) Seguridad (Row Level Security)
alter table public.products enable row level security;
alter table public.admins enable row level security;

drop policy if exists "Productos activos visibles para todos" on public.products;
create policy "Productos activos visibles para todos" on public.products
  for select using (active or public.is_admin());

drop policy if exists "Admins gestionan productos" on public.products;
create policy "Admins gestionan productos" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins se ven a sí mismas" on public.admins;
create policy "Admins se ven a sí mismas" on public.admins
  for select using (email = auth.jwt() ->> 'email');

-- 4) Almacenamiento de fotos (bucket público "productos")
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

drop policy if exists "Fotos públicas" on storage.objects;
create policy "Fotos públicas" on storage.objects
  for select using (bucket_id = 'productos');

drop policy if exists "Admins suben fotos" on storage.objects;
create policy "Admins suben fotos" on storage.objects
  for insert with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "Admins editan fotos" on storage.objects;
create policy "Admins editan fotos" on storage.objects
  for update using (bucket_id = 'productos' and public.is_admin());

drop policy if exists "Admins borran fotos" on storage.objects;
create policy "Admins borran fotos" on storage.objects
  for delete using (bucket_id = 'productos' and public.is_admin());
