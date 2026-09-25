-- Casa Rating: esquema de Supabase para sincronizar entre los dos perfiles.
-- Correr esto una vez en el SQL Editor de tu proyecto de Supabase.

create table if not exists brokers (
  id uuid primary key,
  name text not null,
  phone text,
  agency text,
  notes text,
  created_at bigint not null
);

create table if not exists criteria (
  id text primary key,
  name text not null,
  weight numeric not null,
  sort_order integer not null,
  active boolean not null default true
);

create table if not exists properties (
  id uuid primary key,
  url text not null,
  title text not null,
  description text,
  images text[] not null default '{}',
  price numeric,
  currency text,
  m2 numeric,
  bedrooms integer,
  bathrooms integer,
  zone text,
  address text,
  broker_id uuid references brokers(id) on delete set null,
  created_by uuid not null,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists ratings (
  id uuid primary key,
  property_id uuid not null references properties(id) on delete cascade,
  criterion_id text not null references criteria(id) on delete cascade,
  user_id uuid not null,
  stars integer not null check (stars between 1 and 5),
  created_at bigint not null,
  updated_at bigint not null,
  unique (property_id, criterion_id, user_id)
);

-- Nombre para mostrar de cada usuario (ej. "Jonathan T", "Michelle M").
-- Cada quien escribe su propia fila al entrar por primera vez.
create table if not exists profiles (
  id uuid primary key,
  name text not null,
  color text not null,
  updated_at bigint not null
);

-- Fila por cada uno de los dos usuarios autorizados. Solo ellos podrán
-- leer/escribir datos. La app usa usuario/contraseña (no correo real): cada
-- nombre de usuario se convierte internamente en un correo sintético
-- "<nombre-en-minusculas-sin-acentos>@casa-rating.local" (ver
-- src/lib/username.ts). Los de abajo corresponden a "Jonathan T" y
-- "Michelle M" -- si alguien crea su cuenta con otro nombre de usuario,
-- agrega aquí su correo sintético con el mismo patrón.
create table if not exists allowed_users (
  email text primary key
);

insert into allowed_users (email) values
  ('jonathan-t@casa-rating.local'),
  ('michelle-m@casa-rating.local')
on conflict do nothing;

alter table brokers enable row level security;
alter table criteria enable row level security;
alter table properties enable row level security;
alter table ratings enable row level security;
alter table allowed_users enable row level security;
alter table profiles enable row level security;

-- allowed_users se consulta desde las políticas de abajo, pero no queremos
-- exponerla directo por la API. security definer hace que esta función
-- pueda leerla saltándose RLS, aunque quien la llame (anon/authenticated)
-- no tenga permiso de leer la tabla directamente.
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

create policy "allowed users full access" on brokers
  for all using (is_allowed_user())
  with check (is_allowed_user());

create policy "allowed users full access" on criteria
  for all using (is_allowed_user())
  with check (is_allowed_user());

create policy "allowed users full access" on properties
  for all using (is_allowed_user())
  with check (is_allowed_user());

create policy "allowed users full access" on ratings
  for all using (is_allowed_user())
  with check (is_allowed_user());

create policy "allowed users can read all profiles" on profiles
  for select using (is_allowed_user());

create policy "users can write their own profile" on profiles
  for insert with check (auth.uid() = id and is_allowed_user());

create policy "users can update their own profile" on profiles
  for update using (auth.uid() = id and is_allowed_user())
  with check (auth.uid() = id and is_allowed_user());
