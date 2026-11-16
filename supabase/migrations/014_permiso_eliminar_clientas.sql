-- ============================================================
-- FemShoes · Permiso "Eliminar clientas" en los roles
-- Ejecutar una sola vez después de 013_eliminar_clientas.sql
--
-- Nuevo permiso clientas_eliminar, que se marca en la sección Roles.
-- Solo lo tiene el Superadmin; ningún otro rol lo trae marcado.
-- ============================================================

alter table public.roles drop constraint if exists roles_permissions_check;
alter table public.roles add constraint roles_permissions_check check (
  permissions <@ array['productos', 'productos_publicar', 'productos_eliminar', 'categorias',
                       'pedidos', 'despachos', 'clientas', 'clientas_eliminar']::text[]
);

update public.roles
set permissions = array_append(permissions, 'clientas_eliminar'), updated_at = now()
where slug = 'superadmin' and not ('clientas_eliminar' = any(permissions));
