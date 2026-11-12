-- 006: código interno (SKU) por categoría, modelo, color y talla
--
--   TAC-0012-NEG-37
--   │   │    │   └─ talla
--   │   │    └───── código del color (variants[].code, 2-4 letras/dígitos)
--   │   └────────── consecutivo del modelo (global, nunca se repite)
--   └────────────── código de la categoría (categories.code)
--
-- El código del modelo y el de cada color se asignan al crearlos y no cambian después,
-- aunque se renombre el producto, el color o se mueva de categoría.

-- Sugiere un código de 2-4 caracteres a partir de un texto ("Dorado champán" -> "DOR")
create or replace function public.code_from_text(t text)
returns text
language sql immutable as $$
  select case when length(c) >= 2 then c else rpad(c, 2, 'X') end
  from (
    select upper(left(regexp_replace(
      translate(lower(coalesce(t, '')), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'),
      '[^a-z0-9]', '', 'g'), 3)) as c
  ) x;
$$;

-- ---------- Categorías ----------
alter table public.categories add column if not exists code text;

create or replace function public.categories_assign_code()
returns trigger
language plpgsql as $$
declare
  base text;
  cand text;
  n integer := 2;
begin
  if tg_op = 'INSERT' and coalesce(trim(new.code), '') = '' then
    base := public.code_from_text(new.label);
    cand := base;
    while exists (select 1 from public.categories where code = cand) loop
      cand := left(base, 2) || n;
      n := n + 1;
    end loop;
    new.code := cand;
  end if;
  new.code := upper(trim(new.code));
  return new;
end;
$$;

-- Asignar códigos a las categorías existentes, en el orden de la tienda
do $$
declare
  c record;
  base text;
  cand text;
  n integer;
begin
  for c in select slug, label from public.categories where code is null order by sort_order, slug loop
    base := public.code_from_text(c.label);
    cand := base;
    n := 2;
    while exists (select 1 from public.categories where code = cand) loop
      cand := left(base, 2) || n;
      n := n + 1;
    end loop;
    update public.categories set code = cand where slug = c.slug;
  end loop;
end $$;

alter table public.categories alter column code set not null;
alter table public.categories drop constraint if exists categories_code_format;
alter table public.categories add constraint categories_code_format check (code ~ '^[A-Z0-9]{2,4}$');
alter table public.categories drop constraint if exists categories_code_key;
alter table public.categories add constraint categories_code_key unique (code);

drop trigger if exists categories_assign_code on public.categories;
create trigger categories_assign_code before insert or update on public.categories
  for each row execute function public.categories_assign_code();

-- ---------- Productos y colores ----------
create sequence if not exists public.product_code_seq;
alter table public.products add column if not exists code text;

-- Completa y protege los códigos de los colores de un producto:
--  * un color que ya existía conserva su código;
--  * un color nuevo sin código recibe uno sugerido por su nombre;
--  * no puede haber dos colores con el mismo código en el mismo modelo.
create or replace function public.product_variant_codes(p_new jsonb, p_old jsonb)
returns jsonb
language plpgsql as $$
declare
  v jsonb;
  result jsonb := '[]'::jsonb;
  used text[] := '{}';
  old_code text;
  code text;
  base text;
  n integer;
begin
  for v in select * from jsonb_array_elements(coalesce(p_new, '[]'::jsonb)) loop
    select o ->> 'code' into old_code
    from jsonb_array_elements(coalesce(p_old, '[]'::jsonb)) o
    where o ->> 'id' = v ->> 'id' and coalesce(o ->> 'code', '') <> ''
    limit 1;

    if old_code is not null then
      code := old_code;
    elsif coalesce(trim(v ->> 'code'), '') <> '' then
      code := upper(trim(v ->> 'code'));
      if code !~ '^[A-Z0-9]{2,4}$' then
        raise exception 'El código de color "%" no es válido (2 a 4 letras o números)', code;
      end if;
    else
      base := public.code_from_text(v ->> 'color');
      code := base;
      n := 2;
      while code = any (used) loop
        code := left(base, 2) || n;
        n := n + 1;
      end loop;
    end if;

    if code = any (used) then
      raise exception 'Hay dos colores con el código % en el mismo producto', code;
    end if;
    used := used || code;
    result := result || jsonb_build_array(v || jsonb_build_object('code', code));
  end loop;
  return result;
end;
$$;

create or replace function public.products_assign_codes()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cat_code text;
begin
  if tg_op = 'INSERT' then
    select code into cat_code from public.categories where slug = new.category;
    new.code := coalesce(cat_code, 'GEN') || '-' || lpad(nextval('public.product_code_seq')::text, 4, '0');
    new.variants := public.product_variant_codes(new.variants, '[]'::jsonb);
  else
    new.code := old.code; -- el código del modelo no cambia
    new.variants := public.product_variant_codes(new.variants, old.variants);
  end if;
  return new;
end;
$$;

-- Asignar códigos a los productos existentes en el orden en que se crearon
do $$
declare
  p record;
  cat_code text;
begin
  for p in select id, category, variants from public.products where code is null order by created_at, id loop
    select code into cat_code from public.categories where slug = p.category;
    update public.products
    set code = coalesce(cat_code, 'GEN') || '-' || lpad(nextval('public.product_code_seq')::text, 4, '0'),
        variants = public.product_variant_codes(p.variants, '[]'::jsonb)
    where id = p.id;
  end loop;
end $$;

alter table public.products alter column code set not null;
alter table public.products drop constraint if exists products_code_key;
alter table public.products add constraint products_code_key unique (code);

drop trigger if exists products_assign_codes on public.products;
create trigger products_assign_codes before insert or update on public.products
  for each row execute function public.products_assign_codes();

-- ---------- Pedidos existentes: guardar el código completo en cada renglón ----------
do $$
declare
  o record;
  item jsonb;
  new_items jsonb;
  prod public.products%rowtype;
  vi integer;
begin
  for o in select id, items from public.orders loop
    new_items := '[]'::jsonb;
    for item in select * from jsonb_array_elements(o.items) loop
      if coalesce(item ->> 'sku', '') = '' then
        select * into prod from public.products where id = (item ->> 'productId')::uuid;
        if found then
          vi := public.order_item_variant_index(prod.variants, item);
          if vi is not null then
            item := item || jsonb_build_object(
              'sku', prod.code || '-' || (prod.variants -> vi ->> 'code') || '-' || (item ->> 'size'),
              'variantId', coalesce(item ->> 'variantId', prod.variants -> vi ->> 'id'));
          end if;
        end if;
      end if;
      new_items := new_items || jsonb_build_array(item);
    end loop;
    update public.orders set items = new_items where id = o.id;
  end loop;
end $$;
