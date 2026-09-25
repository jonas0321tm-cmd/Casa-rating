-- Arreglo puntual: permite que las políticas de seguridad puedan revisar
-- allowed_users sin exponer esa tabla directamente por la API.
-- Correr una sola vez en el SQL Editor (ya corriste schema.sql antes).

alter table allowed_users enable row level security;

create or replace function is_allowed_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from allowed_users where email = auth.jwt() ->> 'email'
  );
$$;

drop policy if exists "allowed users full access" on brokers;
drop policy if exists "allowed users full access" on criteria;
drop policy if exists "allowed users full access" on properties;
drop policy if exists "allowed users full access" on ratings;

create policy "allowed users full access" on brokers
  for all using (is_allowed_user()) with check (is_allowed_user());

create policy "allowed users full access" on criteria
  for all using (is_allowed_user()) with check (is_allowed_user());

create policy "allowed users full access" on properties
  for all using (is_allowed_user()) with check (is_allowed_user());

create policy "allowed users full access" on ratings
  for all using (is_allowed_user()) with check (is_allowed_user());
