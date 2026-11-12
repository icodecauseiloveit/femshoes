-- ============================================================
-- FemShoes · Categorías editables desde /admin
-- Ejecutar una sola vez después de 003_pedidos.sql
-- ============================================================

create table if not exists public.categories (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Categorías iniciales (las que ya usa la tienda)
insert into public.categories (slug, label, sort_order) values
  ('tacones', 'Tacones', 1),
  ('sandalias', 'Sandalias', 2),
  ('botas', 'Botas', 3),
  ('planos', 'Planos', 4),
  ('tenis', 'Tenis', 5)
on conflict (slug) do nothing;

-- Cualquier categoría que ya tenga un producto y no esté en la lista
insert into public.categories (slug, label, sort_order)
select distinct p.category, initcap(replace(p.category, '-', ' ')), 100
from public.products p
where p.category not in (select slug from public.categories)
on conflict (slug) do nothing;

-- Los productos ahora apuntan a la tabla de categorías (en vez de una lista fija).
-- No se puede borrar una categoría que tenga productos.
alter table public.products drop constraint if exists products_category_check;
alter table public.products drop constraint if exists products_category_fkey;
alter table public.products add constraint products_category_fkey
  foreign key (category) references public.categories (slug) on update cascade on delete restrict;

alter table public.categories enable row level security;

drop policy if exists "Categorías visibles" on public.categories;
create policy "Categorías visibles" on public.categories
  for select using (active or public.is_admin());

drop policy if exists "Admins gestionan categorías" on public.categories;
create policy "Admins gestionan categorías" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());
