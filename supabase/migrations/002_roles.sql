-- ============================================================
-- FemShoes · Roles del equipo (superadmin / admin)
-- Ejecutar una sola vez después de schema.sql
-- ============================================================

-- Rol y vínculo con el usuario de Supabase Auth
alter table public.admins
  add column if not exists role text not null default 'admin',
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('superadmin', 'admin'));

update public.admins a set user_id = u.id
from auth.users u
where u.email = a.email and a.user_id is null;

-- >>> Correo de la primera superadmin <<<
update public.admins set role = 'superadmin' where email = 'gbaldrich16@gmail.com';

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where email = auth.jwt() ->> 'email' and role = 'superadmin'
  );
$$;

-- Cada persona ve su propio registro; las superadmins ven todo el equipo.
-- Las altas, cambios y bajas se hacen solo desde el servidor (service role).
drop policy if exists "Admins se ven a sí mismas" on public.admins;
drop policy if exists "Equipo visible" on public.admins;
create policy "Equipo visible" on public.admins
  for select using (email = auth.jwt() ->> 'email' or public.is_superadmin());
