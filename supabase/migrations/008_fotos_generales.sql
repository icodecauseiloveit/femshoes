-- 008: fotos generales del modelo
-- Se muestran con todos los colores, después de las fotos propias del color elegido
-- (suela, tacón, caja, fotos puestas…). Las fotos de cada color siguen en variants[].images.

alter table public.products
  add column if not exists shared_images text[] not null default '{}';
