-- Arreglo: guarda el nombre real de cada usuario (Jonathan T / Michelle M)
-- para que la tabla comparativa muestre su nombre real y pueda encontrar
-- sus calificaciones (antes usaba un perfil de prueba "Tú"/"Tu pareja" que
-- nunca coincidía con el usuario real de Supabase).
-- Correr una sola vez en el SQL Editor.

create table if not exists profiles (
  id uuid primary key,
  name text not null,
  color text not null,
  updated_at bigint not null
);

alter table profiles enable row level security;

create policy "allowed users can read all profiles" on profiles
  for select using (is_allowed_user());

create policy "users can write their own profile" on profiles
  for insert with check (auth.uid() = id and is_allowed_user());

create policy "users can update their own profile" on profiles
  for update using (auth.uid() = id and is_allowed_user())
  with check (auth.uid() = id and is_allowed_user());
