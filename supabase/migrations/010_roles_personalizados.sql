-- ============================================================
-- FemShoes · Roles personalizados con permisos
-- Ejecutar una sola vez después de 009_historial_productos.sql
--
-- Los roles dejan de ser fijos: cada rol tiene una lista de permisos
-- que el superadmin marca desde el panel. El rol "superadmin" es del
-- sistema: tiene todo, no se edita ni se borra, y es el único que
-- gestiona usuarios, roles y ve el historial de productos.
-- ============================================================

create table if not exists public.roles (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  description text not null default '',
  permissions text[] not null default '{}',
  system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Permisos válidos (deben coincidir con src/lib/roles.ts)
alter table public.roles drop constraint if exists roles_permissions_check;
alter table public.roles add constraint roles_permissions_check check (
  permissions <@ array['productos', 'productos_publicar', 'productos_eliminar', 'categorias',
                       'pedidos', 'despachos', 'clientas']::text[]
);

insert into public.roles (slug, name, description, permissions, system) values
  ('superadmin', 'Superadmin', 'Acceso total: también usuarios, roles e historial de productos',
     array['productos', 'productos_publicar', 'productos_eliminar', 'categorias', 'pedidos', 'despachos', 'clientas'], true),
  ('admin', 'Administrador', 'Gestiona productos, pedidos, clientas y cartera',
     array['productos', 'productos_publicar', 'productos_eliminar', 'categorias', 'pedidos', 'clientas'], false),
  ('distribuidor', 'Distribuidor', 'Ve pedidos confirmados, descarga su PDF y los marca como despachados',
     array['despachos'], false),
  ('carga_productos', 'Carga de productos', 'Crea y edita productos (fotos, precios, colores e inventario). Lo que crea queda oculto hasta que alguien lo publique',
     array['productos'], false)
on conflict (slug) do nothing;

-- El rol de cada persona apunta a la tabla de roles
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins drop constraint if exists admins_role_fkey;
alter table public.admins add constraint admins_role_fkey
  foreign key (role) references public.roles(slug) on update cascade on delete restrict;

alter table public.roles enable row level security;
drop policy if exists "Equipo ve los roles" on public.roles;
create policy "Equipo ve los roles" on public.roles
  for select using (exists (select 1 from public.admins where email = auth.jwt() ->> 'email'));
-- Crear, editar y borrar roles: solo desde el servidor (service role), validado como superadmin.
revoke insert, update, delete on public.roles from anon, authenticated;

-- ¿La persona que llama tiene este permiso?
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a join public.roles r on r.slug = a.role
    where a.email = auth.jwt() ->> 'email' and (r.slug = 'superadmin' or p = any(r.permissions))
  );
$$;
grant execute on function public.has_perm(text) to anon, authenticated;

-- Compatibilidad: "admin del catálogo" = puede cargar productos
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_perm('productos');
$$;

-- ---------- Productos ----------
drop policy if exists "Admins gestionan productos" on public.products;
drop policy if exists "Cargan productos" on public.products;
drop policy if exists "Editan productos" on public.products;
drop policy if exists "Eliminan productos" on public.products;
create policy "Cargan productos" on public.products
  for insert with check (public.has_perm('productos'));
create policy "Editan productos" on public.products
  for update using (public.has_perm('productos')) with check (public.has_perm('productos'));
create policy "Eliminan productos" on public.products
  for delete using (public.has_perm('productos_eliminar'));

-- Ocultar/publicar exige su propio permiso. Quien solo carga productos los deja
-- ocultos al crearlos. No aplica a cambios hechos por el servidor (pedidos).
create or replace function public.products_guard_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' or public.has_perm('productos_publicar') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.active := false;
  elsif new.active is distinct from old.active then
    raise exception 'No tienes permiso para ocultar o publicar productos';
  end if;
  return new;
end;
$$;
drop trigger if exists products_guard_visibility on public.products;
create trigger products_guard_visibility before insert or update on public.products
  for each row execute function public.products_guard_visibility();

-- Eliminar con motivo (009) ahora exige el permiso de eliminar
create or replace function public.delete_product(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('productos_eliminar') then
    raise exception 'No tienes permiso para eliminar productos';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Escribe el motivo de la eliminación';
  end if;
  perform set_config('app.log_reason', left(btrim(p_reason), 500), true);
  delete from public.products where id = p_id;
  if not found then
    raise exception 'El producto no existe';
  end if;
end;
$$;

-- ---------- Categorías ----------
drop policy if exists "Admins gestionan categorías" on public.categories;
create policy "Admins gestionan categorías" on public.categories
  for all using (public.has_perm('categorias')) with check (public.has_perm('categorias'));
-- Quien carga productos necesita ver también las categorías ocultas
drop policy if exists "Categorías visibles" on public.categories;
create policy "Categorías visibles" on public.categories
  for select using (active or public.has_perm('productos') or public.has_perm('categorias'));

-- ---------- Historial de productos: solo superadmin ----------
drop policy if exists "Equipo ve el historial" on public.product_logs;
drop policy if exists "Superadmin ve el historial" on public.product_logs;
create policy "Superadmin ve el historial" on public.product_logs
  for select using (public.is_superadmin());
